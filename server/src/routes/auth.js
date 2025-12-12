const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// In-memory storage for auth config (simple session-like behavior)
// In a production multi-user app, this would be per-session/token.
// Here we assume single-user behavior for the desktop app.
global.dockerAuth = null;

router.post('/login', async (req, res) => {
    const { username, password, serveraddress } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const authConfig = {
        username,
        password,
        serveraddress: serveraddress || 'https://index.docker.io/v1/'
    };

    try {
        // Verify credentials
        await docker.checkAuth(authConfig);

        // Store on success
        global.dockerAuth = authConfig;

        console.log(`User ${username} logged in to ${authConfig.serveraddress}`);
        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error('Login failed:', error);
        res.status(401).json({ error: 'Authentication failed: ' + error.message });
    }
});

router.post('/logout', (req, res) => {
    global.dockerAuth = null;
    res.json({ message: 'Logged out' });
});

module.exports = router;
