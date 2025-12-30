const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// List images
router.get('/', async (req, res) => {
    try {
        const images = await docker.listImages();
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get currently pulling images
router.get('/pulling', (req, res) => {
    res.json(Array.from(global.pullingImages));
});

// Pull image (Background)
router.post('/pull', async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image name required' });

    if (global.pullingImages.has(image)) {
        return res.json({ message: 'Pull already in progress', image });
    }

    try {
        global.pullingImages.add(image);
        global.io.emit('docker_pull_start', { image });

        const options = {
            ...(global.dockerAuth ? { authconfig: global.dockerAuth } : {})
        };

        // Respond immediately
        res.json({ message: 'Pull started', image });

        docker.pull(image, options, (err, stream) => {
            if (err) {
                global.pullingImages.delete(image);
                global.io.emit('docker_pull_error', { image, error: err.message });
                console.error('Pull init error', err);
                return;
            }

            docker.modem.followProgress(stream, onFinished, onProgress);

            function onFinished(err, output) {
                global.pullingImages.delete(image);
                if (err) {
                    global.io.emit('docker_pull_error', { image, error: err.message });
                    console.error('Pull finish error:', err);
                } else {
                    global.io.emit('docker_pull_complete', { image, output });
                    global.io.emit('images_changed'); // Notify clients to refresh image list
                }
            }

            function onProgress(event) {
                global.io.emit('docker_pull_progress', { image, event });
            }
        });

    } catch (error) {
        global.pullingImages.delete(image);
        res.status(500).json({ error: error.message });
    }
});

// Remove image
router.delete('/:id', (req, res) => {
    const id = req.params.id;
    const force = req.query.force === 'true';
    res.json({ message: 'Remove image action queuing...' });

    (async () => {
        try {
            // Proactive check
            const image = docker.getImage(id);
            let fullImageId = id;
            try {
                const imageInfo = await image.inspect();
                fullImageId = imageInfo.Id;
            } catch (e) {
                // If inspect fails, it might not exist, let remove() handle it
            }

            const containers = await docker.listContainers({ all: true });
            const conflict = containers.find(c => c.ImageID === fullImageId);

            if (conflict) {
                const name = conflict.Names && conflict.Names.length > 0
                    ? conflict.Names[0].replace(/^\//, '')
                    : conflict.Id.substring(0, 12);

                const errorMessage = `image has been used by container [${name}]`;
                global.io.emit('action_status', { type: 'error', message: errorMessage, id });
                return;
            }

            await image.remove({ force: force });
            global.io.emit('action_status', { type: 'success', message: `Image removed`, id });
            global.io.emit('images_changed');
        } catch (error) {
            let errorMessage = error.message;
            if (error.statusCode === 409 || errorMessage.includes('conflict')) {
                const match = errorMessage.match(/container\s+([a-fA-F0-9]{12,})/);
                if (match && match[1]) {
                    errorMessage = `image has been used by container ${match[1]}`;
                }
            }
            global.io.emit('action_status', { type: 'error', message: `Remove image failed: ${errorMessage}`, id });
        }
    })();
});

// Search Docker Hub images
router.get('/search', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        const results = await docker.searchImages({ term });
        res.json(results);
    } catch (error) {
        console.error('Error searching images:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
