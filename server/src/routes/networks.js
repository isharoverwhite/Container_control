const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// List networks
router.get('/', async (req, res) => {
    try {
        const networks = await docker.listNetworks();
        res.json(networks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
