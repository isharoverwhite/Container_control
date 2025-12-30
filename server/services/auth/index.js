const express = require('express');
const Docker = require('dockerode');
const fs = require('fs');
const path = require('path');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

const AUTH_FILE = path.join(__dirname, '../../.docker-auth.json');

app.post('/login', async (req, res) => {
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
        await docker.checkAuth(authConfig);
        fs.writeFileSync(AUTH_FILE, JSON.stringify(authConfig));
        console.log(`User ${username} logged in`);
        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error('Login failed:', error);
        res.status(401).json({ error: 'Authentication failed: ' + error.message });
    }
});

app.post('/login/device', async (req, res) => {
    const userCode = 'ABCD-1234';
    const verificationUri = 'https://docker.com/device';
    res.json({
        user_code: userCode,
        verification_uri: verificationUri,
        expires_in: 300
    });
});

app.post('/login/device/poll', async (req, res) => {
    // Mock success
    const authConfig = {
        username: 'mock_user',
        password: 'mock_token',
        serveraddress: 'https://index.docker.io/v1/'
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authConfig));
    res.json({ message: 'Login successful' });
});

app.post('/logout', (req, res) => {
    if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE);
    res.json({ message: 'Logged out' });
});

const PORT = 3005;
app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
