const express = require('express');
const Docker = require('dockerode');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

// List networks
app.get('/', async (req, res) => {
    try {
        const networks = await docker.listNetworks();
        res.json(networks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3007;
app.listen(PORT, () => {
    console.log(`Networks Service running on port ${PORT}`);
});
