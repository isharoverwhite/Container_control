const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
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

    res.json({ message: 'Stack up action queuing...' });

    (async () => {
        try {
            await runCommand('docker compose up -d', stackPath);
            emit('action_status', { type: 'success', message: `Stack started`, id: name });
        } catch (err) {
            emit('action_status', { type: 'error', message: `Stack up failed: ${err.message}`, id: name });
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
            await runCommand('docker compose down', stackPath);
            emit('action_status', { type: 'success', message: `Stack stopped`, id: name });
        } catch (err) {
            emit('action_status', { type: 'error', message: `Stack down failed: ${err.message}`, id: name });
        }
    })();
});

const PORT = 3004;
app.listen(PORT, () => {
    console.log(`Stacks Service running on port ${PORT}`);
});
