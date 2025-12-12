const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// List volumes
router.get('/', async (req, res) => {
    try {
        const result = await docker.listVolumes();
        res.json(result.Volumes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Inspect volume
router.get('/:name', async (req, res) => {
    try {
        const volume = docker.getVolume(req.params.name);
        const data = await volume.inspect();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove volume
router.delete('/:name', async (req, res) => {
    try {
        const volume = docker.getVolume(req.params.name);
        await volume.remove();
        res.json({ message: 'Volume removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create volume
router.post('/', async (req, res) => {
    try {
        const { name, driver, driverOpts, labels } = req.body;
        const options = {
            Name: name,
            Driver: driver || 'local',
            DriverOpts: driverOpts, // e.g., { type: 'none', device: '/home/user/data', o: 'bind' }
            Labels: labels
        };
        const volume = await docker.createVolume(options);
        res.json(volume);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
