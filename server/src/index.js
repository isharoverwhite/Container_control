const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Docker = require('dockerode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for now, lock down later
        methods: ["GET", "POST", "DELETE", "PUT"]
    }
});

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const containerRoutes = require('./routes/containers');
const imageRoutes = require('./routes/images');
const volumeRoutes = require('./routes/volumes');
const stackRoutes = require('./routes/stacks');

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.use('/api/containers', containerRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/volumes', volumeRoutes);
app.use('/api/stacks', stackRoutes);
const networkRoutes = require('./routes/networks');
app.use('/api/networks', networkRoutes);
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const { exec } = require('child_process');

// Helper to run command promise
const runCmd = (cmd) => new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
        resolve({ err, stdout: stdout.trim(), stderr: stderr.trim() });
    });
});

// Basic health check
app.get('/api/system/info', async (req, res) => {
    try {
        const info = await docker.info();

        // GPU Detection
        let gpu = { vendor: 'none', model: '', supported: false };

        // 1. Check Nvidia
        const nvidia = await runCmd('which nvidia-smi');
        if (!nvidia.err) {
            gpu.vendor = 'nvidia';
            gpu.supported = true;
            // Get model
            const nModel = await runCmd('nvidia-smi --query-gpu=name --format=csv,noheader');
            gpu.model = nModel.stdout;
        } else {
            // 2. Check Generic (AMD/Intel) via lspci
            const pci = await runCmd('lspci | grep -i vga');
            if (pci.stdout) {
                // Example: "00:02.0 VGA compatible controller: Intel Corporation HD Graphics 620 (rev 02)"
                const line = pci.stdout;
                if (line.toLowerCase().includes('intel')) {
                    gpu.vendor = 'intel';
                    gpu.model = line.split(': ').pop(); // Rough parse
                    gpu.supported = false; // Intel needs /dev/dri mapping, disabling per user request for simplicity unless specific
                } else if (line.toLowerCase().includes('amd') || line.toLowerCase().includes('ati')) {
                    gpu.vendor = 'amd';
                    gpu.model = line.split(': ').pop();
                    gpu.supported = true; // User asked to enable for AMD
                } else {
                    gpu.vendor = 'other';
                    gpu.model = line;
                }
            }
        }

        res.json({ ...info, gpu });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Socket handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('subscribe_logs', async (containerId) => {
        console.log(`Client ${socket.id} subscribed to logs for ${containerId}`);
        try {
            const container = docker.getContainer(containerId);

            // Get stream
            const stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                tail: 50
            });

            // Stream data to socket
            stream.on('data', (chunk) => {
                // Docker log streams have 8-byte header, might need stripping if using raw stream
                // But for simplicity sending raw chunk first, or convert to string
                socket.emit('log_chunk', { containerId, chunk: chunk.toString('utf8') });
            });

            stream.on('end', () => {
                socket.emit('log_end', { containerId });
            });

            // Cleanup on disconnect or unsubscribe handling needed (simplified here)
            socket.on('disconnect', () => {
                stream.destroy();
            });

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });
});
