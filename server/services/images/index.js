const express = require('express');
const Docker = require('dockerode');
const fs = require('fs');
const path = require('path');
const { emit } = require('../../shared/eventBus');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

global.pullingImages = new Set();
global.dockerAuth = null;

const AUTH_FILE = path.join(__dirname, '../../.docker-auth.json');

// List images
app.get('/', async (req, res) => {
    try {
        const images = await docker.listImages();
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get pulling
app.get('/pulling', (req, res) => {
    res.json(Array.from(global.pullingImages));
});

// Pull image
app.post('/pull', async (req, res) => {
    const { image } = req.body;
    console.log('Images Service: Pull request received for', image);
    if (!image) return res.status(400).json({ error: 'Image name required' });

    if (global.pullingImages.has(image)) {
        console.log('Images Service: Pull already in progress for', image);
        return res.json({ message: 'Pull already in progress', image });
    }

    try {
        global.pullingImages.add(image);
        console.log('Images Service: Emitting docker_pull_start for', image);
        emit('docker_pull_start', { image });

        let authConfig = null;
        if (fs.existsSync(AUTH_FILE)) {
            try {
                authConfig = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
                console.log('Images Service: Using auth config');
            } catch (e) { console.error('Error reading auth file', e); }
        }

        const options = {
            ...(authConfig ? { authconfig: authConfig } : {})
        };

        res.json({ message: 'Pull started', image });

        docker.pull(image, options, (err, stream) => {
            if (err) {
                global.pullingImages.delete(image);
                console.error('Images Service: Pull init error', err);
                emit('docker_pull_error', { image, error: err.message });
                return;
            }

            console.log('Images Service: Pull stream started for', image);
            docker.modem.followProgress(stream, onFinished, onProgress);

            function onFinished(err, output) {
                global.pullingImages.delete(image);
                if (err) {
                    console.error('Images Service: Pull finish error:', err);
                    emit('docker_pull_error', { image, error: err.message });
                } else {
                    console.log('Images Service: Pull completed for', image);
                    emit('docker_pull_complete', { image, output });
                    emit('images_changed');
                }
            }

            function onProgress(event) {
                console.log('Images Service: Progress event for', image, event.status);
                emit('docker_pull_progress', { image, event });
            }
        });
    } catch (error) {
        console.error('Images Service: Pull exception', error);
        global.pullingImages.delete(image);
        res.status(500).json({ error: error.message });
    }
});

// Remove image
app.delete('/:id', async (req, res) => {
    const id = req.params.id;
    const force = req.query.force === 'true';

    try {
        const image = docker.getImage(id);
        let fullImageId = id;

        try {
            const imageInfo = await image.inspect();
            fullImageId = imageInfo.Id;
        } catch (e) {
            // If inspect fails, maybe image doesn't exist
            return res.status(404).json({ error: 'Image not found or invalid' });
        }

        // Check conflicts manually to provide better error
        const containers = await docker.listContainers({ all: true });
        const conflicts = containers.filter(c => c.ImageID === fullImageId);

        if (conflicts.length > 0) {
            const names = conflicts.map(c =>
                c.Names && c.Names.length > 0 ? c.Names[0].replace(/^\//, '') : c.Id.substring(0, 12)
            );
            return res.status(409).json({
                error: `Image is being used by container(s): ${names.join(', ')}`,
                conflictContainers: names
            });
        }

        await image.remove({ force: force });
        res.json({ message: 'Image removed' });
        emit('action_status', { type: 'success', message: `Image removed`, id });
        emit('images_changed');

    } catch (error) {
        let errorMessage = error.message;
        // In case manual check missed something but Docker rejected it
        if (error.statusCode === 409 || errorMessage.includes('conflict')) {
            const match = errorMessage.match(/container\s+([a-fA-F0-9]{12,})/);
            if (match && match[1]) {
                errorMessage = `image has been used by container ${match[1]}`;
            }
            return res.status(409).json({ error: errorMessage });
        }

        console.error('Remove image error:', error);
        res.status(500).json({ error: errorMessage });
        emit('action_status', { type: 'error', message: `Remove image failed: ${errorMessage}`, id });
    }
});

// Search
app.get('/search', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term) return res.status(400).json({ error: 'Search term is required' });
        const results = await docker.searchImages({ term });
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Images Service running on port ${PORT}`);
});
