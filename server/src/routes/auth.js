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

// Device Login Init (Mock Phase 1)
router.post('/login/device', async (req, res) => {
    // In a real implementation, this would call Docker Hub OAuth Device Flow
    // or execute a custom command that outputs the code.
    // For now, we simulate the flow as requested.

    // 1. Execute command (Placeholder)
    // const result = await runCmd('docker login --device ...'); 

    // 2. Return code
    const userCode = 'ABCD-1234';
    const verificationUri = 'https://docker.com/device'; // Example

    res.json({
        user_code: userCode,
        verification_uri: verificationUri,
        expires_in: 300
    });
});

// Device Login Poll (Mock Phase 2)
router.post('/login/device/poll', async (req, res) => {
    // Check if user has authorized.
    // In real flow, we'd exchange device code for token.

    // Simulating "waiting"
    // res.status(400).json({ error: 'authorization_pending' });

    // Simulating "success" (Auto-success for demo if needed, or wait for user action?)
    // Since we can't really do it, we'll just fail or mock success immediately for UX testing?
    // Let's return pending, the user might want to assert success manually? 
    // Or we just mock success.

    // Mock Success:
    global.dockerAuth = {
        // We'd ideally get a token here
        username: 'mock_user',
        password: 'mock_token',
        serveraddress: 'https://index.docker.io/v1/'
    };

    res.json({ message: 'Login successful' });
});

router.post('/logout', (req, res) => {
    global.dockerAuth = null;
    res.json({ message: 'Logged out' });
});

module.exports = router;
