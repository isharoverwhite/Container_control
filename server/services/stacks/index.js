const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { emit } = require('../../shared/eventBus');
const app = express();

app.use(express.json());

// Adjust path to point to server/stacks
const STACKS_DIR = path.join(__dirname, '../../stacks');

if (!fs.existsSync(STACKS_DIR)) {
    fs.mkdirSync(STACKS_DIR, { recursive: true });
}

const runCommand = (cmd, cwd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd }, (error, stdout, stderr) => {
            if (error) {
                return reject({ error, stderr });
            }
            resolve(stdout || stderr);
        });
    });
};

const runCommandStreaming = (cmd, args, cwd, stackName) => {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, shell: true });

        child.stdout.on('data', (data) => {
            const line = data.toString();
            // console.log(`[Stack ${stackName}]`, line);
            emit('stack_log', { name: stackName, line });
        });

        child.stderr.on('data', (data) => {
            const line = data.toString();
            // console.error(`[Stack ${stackName} Err]`, line);
            emit('stack_log', { name: stackName, line, isError: true });
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
    });
};

// List stacks
app.get('/', (req, res) => {
    try {
        const stacks = fs.readdirSync(STACKS_DIR).filter(file => {
            return fs.statSync(path.join(STACKS_DIR, file)).isDirectory();
        });
        res.json(stacks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Stack
app.post('/', (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Name and content required' });

    const stackPath = path.join(STACKS_DIR, name);
    if (fs.existsSync(stackPath)) {
        return res.status(409).json({ error: 'Stack already exists' });
    }

    try {
        fs.mkdirSync(stackPath, { recursive: true });
        fs.writeFileSync(path.join(stackPath, 'docker-compose.yml'), content);
        res.json({ message: 'Stack created', name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Stack Content
app.get('/:name', (req, res) => {
    const stackPath = path.join(STACKS_DIR, req.params.name, 'docker-compose.yml');
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    try {
        const content = fs.readFileSync(stackPath, 'utf8');
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Stack
app.delete('/:name', (req, res) => {
    const name = req.params.name;
    const stackPath = path.join(STACKS_DIR, name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    res.json({ message: 'Delete stack action queuing...' });

    (async () => {
        try {
            // 1. Run docker compose down
            emit('action_status', { type: 'info', message: `Bringing down stack ${name}...`, id: name });
            await runCommandStreaming('docker compose', ['down', '--rmi', 'all', '--volumes', '--remove-orphans'], stackPath, name);

            // 2. Remove directory
            fs.rmSync(stackPath, { recursive: true, force: true });

            emit('action_status', { type: 'success', message: `Stack deleted`, id: name });
            emit('stacks_changed');
        } catch (error) {
            emit('action_status', { type: 'error', message: `Delete stack failed: ${error.message}`, id: name });
        }
    })();
});

// Action: Up
app.post('/:name/up', (req, res) => {
    const name = req.params.name;
    const stackPath = path.join(STACKS_DIR, name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    res.json({ message: 'Stack up action initiated' });

    (async () => {
        try {
            emit('stack_log', { name, line: 'Starting deployment...' });
            await runCommandStreaming('docker compose', ['up', '-d'], stackPath, name);

            emit('stack_log', { name, line: 'Deployment successful!' });
            emit('action_status', { type: 'success', message: `Stack started`, id: name });
            emit('stack_action_complete', { name, success: true, action: 'up' });
        } catch (err) {
            emit('stack_log', { name, line: `Deployment failed: ${err.message}`, isError: true });
            emit('action_status', { type: 'error', message: `Stack up failed: ${err.message}`, id: name });
            emit('stack_action_complete', { name, success: false, action: 'up', error: err.message });
        }
    })();
});

// Action: Down
app.post('/:name/down', (req, res) => {
    const name = req.params.name;
    const stackPath = path.join(STACKS_DIR, name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    res.json({ message: 'Stack down action queuing...' });

    (async () => {
        try {
            emit('stack_log', { name, line: 'Stopping stack...' });
            await runCommandStreaming('docker compose', ['down'], stackPath, name);

            emit('stack_log', { name, line: 'Stack stopped successfully.' });
            emit('action_status', { type: 'success', message: `Stack stopped`, id: name });
            emit('stack_action_complete', { name, success: true, action: 'down' });
        } catch (err) {
            console.error(err);
            emit('stack_log', { name, line: `Stop failed: ${err.message}`, isError: true });
            emit('action_status', { type: 'error', message: `Stack down failed: ${err.message}`, id: name });
            emit('stack_action_complete', { name, success: false, action: 'down', error: err.message });
        }
    })();
});

const PORT = 3004;
app.listen(PORT, () => {
    console.log(`Stacks Service running on port ${PORT}`);
});
