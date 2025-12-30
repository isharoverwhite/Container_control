const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../../.env');
require('dotenv').config({ path: envPath });

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Server } = require('socket.io');
const http = require('http');
const https = require('https');
const cors = require('cors');
const { execSync } = require('child_process');
const crypto = require('crypto');

// --- Setup Server ---
const app = express();
app.use(cors());
// --- Auto-Generate Certificates & Secret Key ---
const certPath = path.join(__dirname, '../../cert.pem');
const keyPath = path.join(__dirname, '../../key.pem');
// 1. Generate SSL Certs if missing
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Gateway: SSL Certificates missing. Generating new self-signed pair...');
    try {
        // macOS/Linux openssl command
        execSync(`openssl req -nodes -new -x509 -keyout "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=localhost"`);
        console.log('Gateway: ✓ Certificates generated (cert.pem, key.pem)');
    } catch (e) {
        console.error('Gateway: ✗ Failed to generate certificates. Ensure openssl is installed.', e.message);
    }
}

// 2. Generate Secret Key if missing
let secretKey = process.env.SECRET_KEY;
if (!secretKey) {
    console.log('Gateway: SECRET_KEY not found in env. Generating new one...');
    secretKey = crypto.randomBytes(16).toString('hex'); // 32 chars
    process.env.SECRET_KEY = secretKey;

    try {
        const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (!envContent.includes('SECRET_KEY=')) {
            fs.appendFileSync(envPath, `\nSECRET_KEY=${secretKey}\n`);
            console.log('Gateway: ✓ Saved new SECRET_KEY to .env');
        }
    } catch (e) {
        console.error('Gateway: Failed to write to .env', e);
    }
}

console.log('\n===============================================================');
console.log(`Gateway: 🔑 SECRET KEY: ${secretKey}`);
console.log('===============================================================\n');

let server;
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
    server = https.createServer(httpsOptions, app);
    console.log('Gateway: Initialized with HTTPS 🔒');
} else {
    server = http.createServer(app);
    console.log('Gateway: Initialized with HTTP (Insecure) ⚠️');
}

// --- Socket.IO ---
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "DELETE", "PUT"],
        allowedHeaders: ["x-secret-key"],
    },
    pingTimeout: 60000, // 60s to avoid frequent disconnects on mobile
    pingInterval: 25000
});

const rateLimitStore = new Map();

const logToCsv = (deviceName, deviceId, ip, status) => {
    const timestamp = new Date().toISOString();
    let formattedIp = ip;
    if (formattedIp.startsWith('::ffff:')) {
        formattedIp = formattedIp.substring(7);
    }
    const line = `${timestamp},${deviceName || 'Unknown'},${deviceId || 'Unknown'},${formattedIp},${status}\n`;
    fs.appendFile(LOG_FILE, line, (err) => {
        if (err) console.error('Failed to write to log file:', err);
    });
};

// Socket Auth Middleware
io.use((socket, next) => {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) return next();

    const clientKey = socket.handshake.auth.token || socket.handshake.headers['x-secret-key'];
    const ip = socket.handshake.address || socket.conn.remoteAddress;

    console.log(`Gateway: Socket handshake from ${ip}. Key provided: ${clientKey ? 'Yes' : 'No'}`);

    if (clientKey !== secretKey) {
        console.log(`Gateway: ✗ Socket Auth Failed for ${ip}. Key mismatch. Expected: ${secretKey.substring(0, 4)}... Got: ${clientKey ? clientKey.substring(0, 4) + '...' : 'None'}`);
        return next(new Error("Invalid Secret Key"));
    }

    // IP Check (Blacklist & Pending)
    // Normalize IP
    let normalizedIp = ip;
    if (normalizedIp.startsWith('::ffff:')) normalizedIp = normalizedIp.substring(7);

    // Simplification: Check exact match first
    let clientState = rateLimitStore.get(normalizedIp);
    if (!clientState && rateLimitStore.get(ip)) {
        clientState = rateLimitStore.get(ip);
    }

    if (clientState) {
        const now = Date.now();
        if (clientState.banUntil > now) {
            console.log(`Gateway: ✗ Socket Auth Failed for ${ip}. Banned.`);
            return next(new Error("Device Banned"));
        }
        if (approvalMode && !clientState.approved) {
            console.log(`Gateway: ✗ Socket Auth Failed for ${ip}. Pending.`);
            return next(new Error("Device Pending Approval"));
        }
    }

    console.log(`Gateway: ✓ Socket Auth Success for ${ip}`);
    next();
});

const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// --- Internal Event Bus Endpoint ---
// Services call this to emit events to clients
app.post('/internal/emit', express.json(), (req, res) => {
    const { event, data } = req.body;
    console.log(`Gateway: Received event '${event}' from service`, data ? JSON.stringify(data).substring(0, 100) : '');
    if (event) {
        io.emit(event, data);
        const count = io.sockets.sockets.size;
        const engineCount = io.engine?.clientsCount;
        const ids = Array.from(io.sockets.sockets.keys());
        console.log(`Gateway: ✓ Broadcasted '${event}' to Sockets: ${count} (Engine: ${engineCount}) IDs: ${ids.join(',')}`);
        res.json({ status: 'ok' });
    } else {
        console.log('Gateway: ✗ Missing event name');
        res.status(400).json({ error: 'Missing event name' });
    }
});

io.on('connection', (socket) => {
    console.log(`Gateway: Client connected ${socket.id} (Total: ${io.engine.clientsCount})`);

    socket.on('disconnect', (reason) => {
        console.log(`Gateway: Client disconnected ${socket.id} Reason: ${reason} (Remaining: ${io.engine.clientsCount})`);
    });

    // Log Streaming Logic (Centralized in Gateway for direct socket access)
    socket.on('subscribe_logs', async (containerId) => {
        console.log(`Client ${socket.id} subscribed to logs for ${containerId}`);
        try {
            const container = docker.getContainer(containerId);
            const stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                tail: 50
            });

            stream.on('data', (chunk) => {
                socket.emit('log_chunk', { containerId, chunk: chunk.toString('utf8') });
            });

            stream.on('end', () => {
                socket.emit('log_end', { containerId });
            });

            socket.on('disconnect', () => {
                if (stream) stream.destroy();
            });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Exec Terminal Logic
    socket.on('subscribe_exec', async (containerId) => {
        console.log(`Client ${socket.id} requesting exec for ${containerId}`);
        try {
            const container = docker.getContainer(containerId);

            const exec = await container.exec({
                Cmd: ['/bin/sh'],
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true
            });

            const stream = await exec.start({ hijack: true, stdin: true });

            // Handle Output (Docker -> Client)
            stream.on('data', (chunk) => {
                socket.emit('exec_output', { containerId, data: chunk.toString('utf8') });
            });

            // Handle Input (Client -> Docker)
            const inputHandler = (data) => {
                if (data.containerId === containerId && stream) {
                    stream.write(data.input);
                }
            };

            // Handle Resize
            const resizeHandler = (data) => {
                if (data.containerId === containerId && exec) {
                    exec.resize({ h: data.rows, w: data.cols });
                }
            }

            socket.on('exec_input', inputHandler);
            socket.on('exec_resize', resizeHandler);

            // Cleanup
            const cleanup = () => {
                if (stream) stream.end();
                socket.off('exec_input', inputHandler);
                socket.off('exec_resize', resizeHandler);
            };

            socket.on('disconnect', cleanup);
            socket.on('unsubscribe_exec', cleanup);

            stream.on('end', () => {
                socket.emit('exec_end', { containerId });
                cleanup();
            });

        } catch (error) {
            console.error('Exec error:', error);
            socket.emit('error', { message: `Exec failed: ${error.message}` });
        }
    });
});

// --- Device Management & Logging ---
const LOG_FILE = path.join(__dirname, '../../connection_logs.csv');

// Initialize CSV if needed
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'Timestamp,DeviceName,DeviceID,IP,Status\n');
}



// --- Auth Middleware (Moved Up) ---
let approvalMode = false; // "Approval Mode" feature

const authMiddleware = (req, res, next) => {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) return next();

    // Skip auth for internal endpoints
    if (req.path.startsWith('/internal')) return next();

    const ip = req.ip || req.connection.remoteAddress;
    const deviceId = req.headers['x-device-id'] || 'Unknown';
    const deviceName = req.headers['x-device-name'] || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const now = Date.now();

    // Get Client State or Init
    const clientState = rateLimitStore.get(ip) || {
        fails: 0,
        banUntil: 0,
        lastSeen: 0,
        approved: !approvalMode, // If approval mode is ON, default to Pending (false). Else Approved (true).
        deviceId,
        deviceName,
        userAgent,
        notifiedPending: false // New field for pending notification
    };

    // Always update metadata
    clientState.userAgent = userAgent;
    clientState.deviceId = deviceId;
    clientState.deviceName = deviceName;

    // 1. Check Ban Status (Blacklist)
    if (clientState.banUntil > now) {
        const waitSeconds = Math.ceil((clientState.banUntil - now) / 1000);
        logToCsv(deviceId, ip, `Rejected (Banned for ${waitSeconds}s)`);
        rateLimitStore.set(ip, clientState);
        return res.status(403).json({
            error: `Too many failed attempts. Try again in ${waitSeconds} seconds.`
        });
    }

    // 2. verify Secret Key
    const clientKey = req.headers['x-secret-key'];
    if (!clientKey || clientKey !== secretKey) {
        clientState.fails += 1;
        let statusMsg = `Login: fail [${clientState.fails}/5]`;

        if (clientState.fails >= 5) {
            const banDuration = 5 * 60 * 1000;
            clientState.banUntil = now + banDuration;
            clientState.fails = 0;
            statusMsg = `Login: fail (Banned for 5 min)`;
        }

        rateLimitStore.set(ip, clientState);
        logToCsv(deviceName, deviceId, ip, statusMsg);

        return res.status(403).json({ error: 'Forbidden: Invalid Secret Key' });
    }

    // 3. Check Approval Status (Whitelist/ApproveList)
    if (approvalMode && !clientState.approved) {
        // Pending Approval

        // Notify Admin via Socket (Once per pending session start)
        if (!clientState.notifiedPending) {
            console.log(`Gateway: Emitting pending notification for ${ip}`);
            // Need access to 'io'. io is defined above? 
            // Logic check: io is defined at line 70. authMiddleware is defined at line 200.
            // Yes, io is in scope.
            io.emit('device_pending', {
                ip,
                deviceName,
                deviceId,
                timestamp: now
            });
            clientState.notifiedPending = true;
        }

        rateLimitStore.set(ip, clientState);
        logToCsv(deviceName, deviceId, ip, 'Pending Approval');
        return res.status(403).json({ error: 'Device Pending Approval' });
    }

    // Success (Authenticated & Approved)
    if (clientState.fails > 0) {
        clientState.fails = 0;
        clientState.banUntil = 0;
    }

    const SESSION_TIMEOUT = 5 * 60 * 1000;
    if (!clientState.lastSeen || (now - clientState.lastSeen > SESSION_TIMEOUT)) {
        logToCsv(deviceName, deviceId, ip, 'Login: yes');
    }

    clientState.lastSeen = now;
    rateLimitStore.set(ip, clientState);

    next();
};

// Request logging middleware
app.use((req, res, next) => {
    console.log(`Gateway: ${req.method} ${req.path}`);
    next();
});

// Protect all /api routes
app.use('/api', authMiddleware);

// --- Device Management Endpoints (Protected) ---

app.get('/api/devices', (req, res) => {
    const requesterIp = req.ip || req.connection.remoteAddress;
    const devices = Array.from(rateLimitStore.entries()).map(([ip, data]) => ({
        ip,
        ...data,
        isCurrent: ip === requesterIp
    }));
    res.json(devices);
});

app.get('/api/devices/settings', (req, res) => {
    res.json({ approvalMode });
});

app.post('/api/devices/settings', express.json(), (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === 'boolean') {
        approvalMode = enabled;
        console.log(`Gateway: Approval Mode set to ${enabled}`);
    }
    res.json({ approvalMode });
});

app.post('/api/devices/approve', express.json(), (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });

    if (rateLimitStore.has(ip)) {
        const data = rateLimitStore.get(ip);
        data.approved = true;
        rateLimitStore.set(ip, data);
        console.log(`Gateway: Approved device ${ip}`);
    }
    res.json({ status: 'approved' });
});

app.post('/api/devices/block', express.json(), (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });

    const requesterIp = req.ip || req.connection.remoteAddress;
    if (ip === requesterIp) {
        return res.status(400).json({ error: 'You cannot block your own device!' });
    }

    const clientState = rateLimitStore.get(ip) || { fails: 0, banUntil: 0, lastSeen: 0, approved: !approvalMode };
    clientState.banUntil = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    rateLimitStore.set(ip, clientState);

    // Force disconnect sockets for this IP
    if (io && io.sockets) {
        io.sockets.sockets.forEach((s) => {
            let sIp = s.handshake.address || s.conn.remoteAddress;
            if (sIp === ip || sIp === `::ffff:${ip}` || (sIp.startsWith('::ffff:') && sIp.substring(7) === ip)) {
                console.log(`Gateway: Blocking socket ${s.id} (${ip})`);
                s.emit('force_logout', { reason: 'Device blocked' });
                s.disconnect(true);
            }
        });
    }

    res.json({ message: `Blocked IP ${ip}` });
});

app.post('/api/devices/unblock', express.json(), (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });

    if (rateLimitStore.has(ip)) {
        const clientState = rateLimitStore.get(ip);
        clientState.banUntil = 0;
        clientState.fails = 0;
        // Do we reset approval? 
        // If unblocking, user usually intends to allow access.
        // Assuming unblock preserves approval state, or sets it to approved?
        // Let's leave approval state as is, unless implicit.
        // User asked "blocked devices... new connection...".
        // Use case: Unblock a banned device. It should probably be restored to approved if it was approved.
    }
    res.json({ message: `Unblocked IP ${ip}` });
});

app.post('/api/devices/delete', express.json(), (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });

    if (rateLimitStore.has(ip)) {
        // Disconnect connected sockets for this IP
        if (io && io.sockets) {
            io.sockets.sockets.forEach((s) => {
                let sIp = s.handshake.address || s.conn.remoteAddress;
                // Normalize IP matching logic
                if (sIp === ip || sIp === `::ffff:${ip}` || (sIp.startsWith('::ffff:') && sIp.substring(7) === ip)) {
                    console.log(`Gateway: Forcing logout for socket ${s.id} (${ip})`);
                    s.emit('force_logout', { reason: 'Device deleted' });
                    s.disconnect(true);
                }
            });
        }

        rateLimitStore.delete(ip);
        console.log(`Gateway: Deleted device session ${ip}`);
    }
    res.json({ message: `Deleted device ${ip}` });
});

// Docker Hub API Proxy (to avoid CORS issues in WebUI)
app.get('/api/dockerhub/search', async (req, res) => {
    const { query, page_size = 10 } = req.query;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        const fetch = require('node-fetch');
        const response = await fetch(
            `https://hub.docker.com/v2/search/repositories?query=${encodeURIComponent(query)}&page_size=${page_size}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Docker Hub search error:', error);
        res.status(500).json({ error: 'Failed to search Docker Hub' });
    }
});

app.get('/api/dockerhub/tags/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    const { page_size = 20 } = req.query;

    try {
        const fetch = require('node-fetch');
        // Docker Hub API V2 requires namespace. 'library' is the namespace for official images.
        // The URL should be: /v2/repositories/{namespace}/{repository}/tags
        const namespace = owner === 'library' ? 'library' : owner;
        const response = await fetch(
            `https://hub.docker.com/v2/repositories/${namespace}/${repo}/tags?page_size=${page_size}`
        );

        if (!response.ok) {
            const text = await response.text();
            console.error(`Docker Hub API Error ${response.status}:`, text);
            throw new Error(`Docker Hub API ${response.status}: ${text}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Docker Hub tags error:', error);
        res.status(500).json({ error: `Failed to fetch tags: ${error.message}` });
    }
});

app.get('/api/dockerhub/repo/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;

    try {
        const fetch = require('node-fetch');
        const namespace = owner === 'library' ? 'library' : owner;
        const response = await fetch(
            `https://hub.docker.com/v2/repositories/${namespace}/${repo}/`
        );

        if (!response.ok) {
            // It's possible the repo doesn't exist or is private
            if (response.status === 404) return res.json({});
            throw new Error(`Docker Hub API ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Docker Hub repo info error:', error);
        res.status(500).json({ error: `Failed to fetch repo info: ${error.message}` });
    }
});

// --- Proxies ---
const services = {
    '/api/containers': 'http://localhost:3001',
    '/api/images': 'http://localhost:3002',
    '/api/volumes': 'http://localhost:3003',
    '/api/stacks': 'http://localhost:3004',
    '/api/auth': 'http://localhost:3005',
    '/api/system': 'http://localhost:3006',
    '/api/networks': 'http://localhost:3007',
    '/webui': 'http://localhost:8080'
};

Object.entries(services).forEach(([route, target]) => {
    app.use(route, createProxyMiddleware({
        target,
        changeOrigin: true,
        changeOrigin: true,
        // ws: true, // Disabled to prevent MaxListenersExceeded (Gateway handles WS now)
        pathRewrite: {
            // Keep the path as is, the services should handle /api/resource or we strip it?
            // Usually simpler to strip /api/resource or keep it.
            // Let's decide: Services will be mounted on root '/' but represent the resource.
            // So /api/containers -> localhost:3001/
            [`^${route}`]: '',
        },
        onError: (err, req, res) => {
            console.error(`Proxy error for ${route}:`, err.message);
            res.status(502).json({ error: 'Service Unavailable' });
        }
    }));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Gateway running on port ${PORT}`);
});
