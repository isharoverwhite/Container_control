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

// Pull image
router.post('/pull', async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image name required' });

    try {
        // This stream needs handling. For simplicity in this step, we just start it.
        // In a real app, we'd pipe this to a socket or return a stream.
        // Here we'll wait for it to finish (blocking) or return "Pulling started".
        // Let's return a stream-like response or use socket.io later.
        // For now: Promisify stream to wait? No, that might time out HTTP.
        // Efficient way: Trigger pull, user tracks via events/logs?

        // Simple implementation:
        docker.pull(image, (err, stream) => {
            if (err) return res.status(500).json({ error: err.message });

            // We pipe the stream to the response directly
            // This allows the client to read the progress
            res.setHeader('Content-Type', 'application/json');
            docker.modem.followProgress(stream, onFinished, onProgress);

            function onFinished(err, output) {
                if (err) {
                    // If headers sent, we can't send status 500.
                    // Usually followProgress handles the end.
                    console.error('Pull finish error', err);
                }
            }

            function onProgress(event) {
                res.write(JSON.stringify(event) + '\n');
            }
        });

    } catch (error) {
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
