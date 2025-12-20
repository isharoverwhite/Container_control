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
router.delete('/:name', (req, res) => {
    const name = req.params.name;
    res.json({ message: 'Remove volume action queuing...' });

    (async () => {
        try {
            const volume = docker.getVolume(name);
            await volume.remove();
            global.io.emit('action_status', { type: 'success', message: `Volume removed`, id: name });
            global.io.emit('volumes_changed');
        } catch (error) {
            global.io.emit('action_status', { type: 'error', message: `Remove volume failed: ${error.message}`, id: name });
        }
    })();
});

// Create volume
router.post('/', (req, res) => {
    const { name, driver, driverOpts, labels } = req.body;
    res.json({ message: 'Create volume action queuing...' });

    (async () => {
        try {
            const options = {
                Name: name,
                Driver: driver || 'local',
                DriverOpts: driverOpts,
                Labels: labels
            };
            const volume = await docker.createVolume(options);
            global.io.emit('action_status', { type: 'success', message: `Volume created`, id: volume.name });
            global.io.emit('volumes_changed');
        } catch (error) {
            global.io.emit('action_status', { type: 'error', message: `Create volume failed: ${error.message}` });
        }
    })();
});

module.exports = router;
