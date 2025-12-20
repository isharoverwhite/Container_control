const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const STACKS_DIR = path.join(__dirname, '../../stacks');

// Helper to run shell command
const runCommand = (cmd, cwd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd }, (error, stdout, stderr) => {
            // docker compose often prints to stderr for status updates, so treat it as info unless error code
            if (error) {
                return reject({ error, stderr });
            }
            resolve(stdout || stderr);
        });
    });
};

// List stacks
router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(STACKS_DIR)) {
            return res.json([]);
        }
        const stacks = fs.readdirSync(STACKS_DIR).filter(file => {
            return fs.statSync(path.join(STACKS_DIR, file)).isDirectory();
        });
        // Maybe verify if docker-compose.yml exists inside
        res.json(stacks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Stack
router.post('/', (req, res) => {
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
router.get('/:name', (req, res) => {
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
router.delete('/:name', (req, res) => {
    const name = req.params.name;
    const stackPath = path.join(STACKS_DIR, name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    res.json({ message: 'Delete stack action queuing...' });

    (async () => {
        try {
            fs.rmSync(stackPath, { recursive: true, force: true });
            global.io.emit('action_status', { type: 'success', message: `Stack deleted`, id: name });
            global.io.emit('stacks_changed');
        } catch (error) {
            global.io.emit('action_status', { type: 'error', message: `Delete stack failed: ${error.message}`, id: name });
        }
    })();
});

// Action: Up
router.post('/:name/up', (req, res) => {
    const name = req.params.name;
    const stackPath = path.join(STACKS_DIR, name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    res.json({ message: 'Stack up action queuing...' });

    (async () => {
        try {
            const output = await runCommand('docker compose up -d', stackPath);
            global.io.emit('action_status', { type: 'success', message: `Stack started`, id: name });
        } catch (err) {
            global.io.emit('action_status', { type: 'error', message: `Stack up failed: ${err.message}`, id: name });
        }
    })();
});

// Action: Down
router.post('/:name/down', (req, res) => {
    const name = req.params.name;
    const stackPath = path.join(STACKS_DIR, name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    res.json({ message: 'Stack down action queuing...' });

    (async () => {
        try {
            const output = await runCommand('docker compose down', stackPath);
            global.io.emit('action_status', { type: 'success', message: `Stack stopped`, id: name });
        } catch (err) {
            global.io.emit('action_status', { type: 'error', message: `Stack down failed: ${err.message}`, id: name });
        }
    })();
});

module.exports = router;
