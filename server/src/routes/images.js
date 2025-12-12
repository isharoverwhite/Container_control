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
router.delete('/:id', async (req, res) => {
    try {
        const image = docker.getImage(req.params.id);
        await image.remove({ force: req.query.force === 'true' });
        res.json({ message: 'Image removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
