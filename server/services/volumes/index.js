const express = require('express');
const Docker = require('dockerode');
const { emit } = require('../../shared/eventBus');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

// List volumes
app.get('/', async (req, res) => {
    try {
        const result = await docker.listVolumes();
        res.json(result.Volumes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Inspect volume
app.get('/:name', async (req, res) => {
    try {
        const volume = docker.getVolume(req.params.name);
        const data = await volume.inspect();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove volume
app.delete('/:name', async (req, res) => {
    const name = req.params.name;

    try {
        const volume = docker.getVolume(name);

        // Check availability
        try {
            await volume.inspect();
        } catch (e) {
            return res.status(404).json({ error: 'Volume not found' });
        }

        // Check usage
        const containers = await docker.listContainers({ all: true });
        const usedBy = [];
        containers.forEach(c => {
            if (c.Mounts) {
                const uses = c.Mounts.some(m => m.Type === 'volume' && m.Name === name);
                if (uses) {
                    const cName = c.Names && c.Names.length > 0 ? c.Names[0].replace(/^\//, '') : c.Id.substring(0, 12);
                    usedBy.push(cName);
                }
            }
        });

        if (usedBy.length > 0) {
            return res.status(409).json({
                error: `Volume is in use by container(s): ${usedBy.join(', ')}`,
                containers: usedBy
            });
        }

        await volume.remove();
        res.json({ message: 'Volume removed' });
        emit('action_status', { type: 'success', message: `Volume removed`, id: name });
        emit('volumes_changed');
    } catch (error) {
        if (error.statusCode === 409 || (error.message && error.message.includes('in use'))) {
            return res.status(409).json({ error: `Volume is in use: ${error.message}` });
        }
        res.status(500).json({ error: error.message });
        emit('action_status', { type: 'error', message: `Remove volume failed: ${error.message}`, id: name });
    }
});

// Create volume
app.post('/', (req, res) => {
    const { name, driver, driverOpts, labels } = req.body;
    console.log('Volumes Service: Create request received', { name, driver, driverOpts, labels });
    res.json({ message: 'Create volume action queuing...' });

    (async () => {
        try {
            const options = {
                Name: name,
                Driver: driver || 'local',
                DriverOpts: driverOpts,
                Labels: labels
            };
            console.log('Volumes Service: Creating volume with options:', options);
            const volume = await docker.createVolume(options);
            console.log('Volumes Service: Volume created successfully:', volume.name);
            emit('action_status', { type: 'success', message: `Volume created`, id: volume.name });
            emit('volumes_changed');
        } catch (error) {
            console.error('Volumes Service: Error creating volume:', error);
            emit('action_status', { type: 'error', message: `Create volume failed: ${error.message}` });
        }
    })();
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Volumes Service running on port ${PORT}`);
});
