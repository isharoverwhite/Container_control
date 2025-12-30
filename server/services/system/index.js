const express = require('express');
const Docker = require('dockerode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');
const os = require('os');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

const runCmd = (cmd) => new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
        resolve({ err, stdout: stdout.trim(), stderr: stderr.trim() });
    });
});

const isRunningInDocker = () => {
    try {
        if (fs.existsSync('/.dockerenv')) return true;
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
        return cgroup.includes('docker');
    } catch (e) {
        return false;
    }
};

app.get('/info', async (req, res) => {
    try {
        const info = await docker.info();
        let gpu = { vendor: 'none', model: '', supported: false };

        const nvidia = await runCmd('which nvidia-smi');
        if (!nvidia.err) {
            gpu.vendor = 'nvidia';
            gpu.supported = true;
            const nModel = await runCmd('nvidia-smi --query-gpu=name --format=csv,noheader');
            gpu.model = nModel.stdout;
        } else {
            const pci = await runCmd('lspci | grep -i vga');
            if (pci.stdout) {
                const line = pci.stdout;
                if (line.toLowerCase().includes('intel')) {
                    gpu.vendor = 'intel';
                    gpu.model = line.split(': ').pop();
                    gpu.supported = false;
                } else if (line.toLowerCase().includes('amd') || line.toLowerCase().includes('ati')) {
                    gpu.vendor = 'amd';
                    gpu.model = line.split(': ').pop();
                    gpu.supported = true;
                } else {
                    gpu.vendor = 'other';
                    gpu.model = line;
                }
            }
        }

        const executionMode = isRunningInDocker() ? 'Docker Container' : 'Native (Node.js)';

        res.json({ ...info, gpu, executionMode, executionDir: process.cwd() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

let historyBuffer = [];
const initHistory = async () => {
    try {
        const info = await docker.info();
        const volData = await docker.listVolumes();
        const volumes = volData.Volumes ? volData.Volumes.length : 0;

        const now = Date.now();
        // Generate last 24h mock data
        for (let i = 24; i >= 0; i--) {
            historyBuffer.push({
                timestamp: now - (i * 3600 * 1000),
                containers: Math.max(0, info.Containers + Math.floor(Math.random() * 4) - 2),
                images: Math.max(0, info.Images + Math.floor(Math.random() * 2) - 1),
                volumes: Math.max(0, volumes),
                stacks: 0
            });
        }
    } catch (e) {
        console.error('Failed to init history:', e);
    }
};

initHistory();

// Record hourly (for demo, we won't actually wait an hour, just rely on mock + live updates if we added a timer)
// But for "Create" events, we'd need event listening which is complex.
// For now, static mock buffer is fine for the UI demo.

app.get('/history', (req, res) => {
    res.json(historyBuffer);
});

const PORT = 3006;
app.listen(PORT, () => {
    console.log(`System Service running on port ${PORT}`);
});
