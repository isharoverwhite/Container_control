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
router.delete('/:name', async (req, res) => {
    const stackPath = path.join(STACKS_DIR, req.params.name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    // Maybe define if we should down it first? User responsibility usually.
    try {
        fs.rmSync(stackPath, { recursive: true, force: true });
        res.json({ message: 'Stack deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Action: Up
router.post('/:name/up', async (req, res) => {
    const stackPath = path.join(STACKS_DIR, req.params.name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    try {
        // Try 'docker compose' (v2) first, fallback to 'docker-compose' could be added
        const output = await runCommand('docker compose up -d', stackPath);
        res.json({ message: 'Stack started', output });
    } catch (err) {
        res.status(500).json({ error: err.message, details: err.stderr });
    }
});

// Action: Down
router.post('/:name/down', async (req, res) => {
    const stackPath = path.join(STACKS_DIR, req.params.name);
    if (!fs.existsSync(stackPath)) return res.status(404).json({ error: 'Stack not found' });

    try {
        const output = await runCommand('docker compose down', stackPath);
        res.json({ message: 'Stack stopped', output });
    } catch (err) {
        res.status(500).json({ error: err.message, details: err.stderr });
    }
});

module.exports = router;
