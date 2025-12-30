const express = require('express');
const Docker = require('dockerode');
const { emit } = require('../../shared/eventBus');
const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

app.use(express.json());

// List containers
app.get('/', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        res.json(containers);
    } catch (error) {
        console.error('Error listing containers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create container
app.post('/create', async (req, res) => {
    try {
        const {
            name, image, env, cmd, entrypoint, workingDir, user, ports, volumes,
            network, resources, restartPolicy, autostart
        } = req.body;

        const config = {
            Image: image,
            Cmd: cmd ? (Array.isArray(cmd) ? cmd : cmd.split(' ')) : undefined,
            Entrypoint: entrypoint ? (Array.isArray(entrypoint) ? entrypoint : entrypoint.split(' ')) : undefined,
            Env: env || [],
            WorkingDir: workingDir,
            User: user,
            Hostname: network?.hostname,
            Domainname: network?.domainname,
            MacAddress: network?.mac,
            ExposedPorts: {},
            HostConfig: {
                PortBindings: {},
                Binds: [],
                RestartPolicy: { Name: restartPolicy || 'no' },
                Privileged: resources?.privileged || false,
                ShmSize: resources?.shmSize ? parseInt(resources.shmSize) * 1024 * 1024 : undefined,
                Memory: resources?.memory ? parseInt(resources.memory) * 1024 * 1024 : undefined,
                NanoCpus: resources?.nanoCpus ? parseFloat(resources.nanoCpus) * 1000000000 : undefined,
                Devices: resources?.devices || [],
                DeviceRequests: resources?.gpu ? [{
                    Driver: '', Count: -1, DeviceIDs: [], Capabilities: [['gpu']]
                }] : undefined,
                DNS: []
            },
            NetworkingConfig: { EndpointsConfig: {} }
        };

        const containerName = name || undefined;

        if (ports && ports.length > 0) {
            ports.forEach(p => {
                const proto = p.protocol || 'tcp';
                const key = `${p.private}/${proto}`;
                config.ExposedPorts[key] = {};
                if (p.public) {
                    config.HostConfig.PortBindings[key] = [{ HostPort: p.public.toString() }];
                }
            });
        }

        if (volumes && volumes.length > 0) {
            volumes.forEach(v => {
                let bind = `${v.source}:${v.target}`;
                if (v.readonly) bind += ':ro';
                config.HostConfig.Binds.push(bind);
            });
        }

        if (network) {
            if (network.dns_primary) config.HostConfig.DNS.push(network.dns_primary);
            if (network.dns_secondary) config.HostConfig.DNS.push(network.dns_secondary);

            if (['bridge', 'host', 'none', 'container'].includes(network.mode)) {
                config.HostConfig.NetworkMode = network.mode;
            } else if (network.mode) {
                config.HostConfig.NetworkMode = network.mode;
                config.NetworkingConfig.EndpointsConfig[network.mode] = { IPAMConfig: {} };
                if (network.ipv4) config.NetworkingConfig.EndpointsConfig[network.mode].IPAMConfig.IPv4Address = network.ipv4;
                if (network.ipv6) config.NetworkingConfig.EndpointsConfig[network.mode].IPAMConfig.IPv6Address = network.ipv6;
            }
        }

        const container = await docker.createContainer({ name: containerName, ...config });
        if (autostart) await container.start();

        res.json({ message: 'Container created' + (autostart ? ' and started' : ''), id: container.id });
    } catch (error) {
        console.error('Create error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Inspect container
app.get('/:id', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const data = await container.inspect();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start container
app.post('/:id/start', (req, res) => {
    const id = req.params.id;
    res.json({ message: 'Start action queuing...' });
    (async () => {
        try {
            const container = docker.getContainer(id);
            await container.start();
            emit('action_status', { type: 'success', message: `Container started successfully`, id });
        } catch (error) {
            emit('action_status', { type: 'error', message: `Start failed: ${error.message}`, id });
        }
    })();
});

// Stop container
app.post('/:id/stop', (req, res) => {
    const id = req.params.id;
    res.json({ message: 'Stop action queuing...' });
    (async () => {
        try {
            const container = docker.getContainer(id);
            await container.stop();
            emit('action_status', { type: 'success', message: `Container stopped`, id });
        } catch (error) {
            emit('action_status', { type: 'error', message: `Stop failed: ${error.message}`, id });
        }
    })();
});

// Restart container
app.post('/:id/restart', (req, res) => {
    const id = req.params.id;
    res.json({ message: 'Restart action queuing...' });
    (async () => {
        try {
            const container = docker.getContainer(id);
            await container.restart();
            emit('action_status', { type: 'success', message: `Container restarted`, id });
        } catch (error) {
            emit('action_status', { type: 'error', message: `Restart failed: ${error.message}`, id });
        }
    })();
});

// Remove container
app.delete('/:id', async (req, res) => {
    const id = req.params.id;
    const force = req.query.force === 'true';

    try {
        const container = docker.getContainer(id);
        let info;
        try {
            info = await container.inspect();
        } catch (e) {
            return res.status(404).json({ error: 'Container not found' });
        }

        // Check labels for stack
        const labels = info.Config.Labels || {};
        const stackName = labels['com.docker.compose.project'] || labels['com.docker.stack.namespace'];

        if (stackName) {
            return res.status(409).json({
                error: `This container is part of stack '${stackName}'. Please delete the stack instead.`
            });
        }

        await container.remove({ force: force });
        res.json({ message: 'Container removed' });
        emit('action_status', { type: 'success', message: `Container removed`, id });
        emit('containers_changed');
    } catch (error) {
        if (error.statusCode === 409) return res.status(409).json({ error: error.message });
        res.status(500).json({ error: error.message });
        emit('action_status', { type: 'error', message: `Remove failed: ${error.message}`, id });
    }
});

// Duplicate container
app.post('/:id/duplicate', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const info = await container.inspect();
        const name = info.Name.replace(/^\//, '') + '-copy-' + Date.now();
        const options = {
            name: name,
            Image: info.Config.Image,
            Cmd: info.Config.Cmd,
            Env: info.Config.Env,
            ExposedPorts: info.Config.ExposedPorts,
            HostConfig: info.HostConfig,
        };
        const newContainer = await docker.createContainer(options);
        res.json({ message: 'Container duplicated', id: newContainer.id, name });
    } catch (error) {
        console.error('Duplicate error', error);
        res.status(500).json({ error: error.message });
    }
});

// Update container
app.post('/:id/update', (req, res) => {
    const id = req.params.id;
    const { RestartPolicy } = req.body;
    res.json({ message: 'Update action queuing...' });
    (async () => {
        try {
            const container = docker.getContainer(id);
            if (RestartPolicy) await container.update({ RestartPolicy });
            emit('action_status', { type: 'success', message: `Container updated`, id });
        } catch (error) {
            emit('action_status', { type: 'error', message: `Update failed: ${error.message}`, id });
        }
    })();
});

// Logs
app.get('/:id/logs', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const logs = await container.logs({ stdout: true, stderr: true, tail: 100, timestamps: true });
        res.send(logs.toString());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/:id/network/connect', async (req, res) => {
    try {
        const { networkId } = req.body;
        const container = docker.getContainer(req.params.id);
        const network = docker.getNetwork(networkId);
        await network.connect({ Container: container.id });
        res.json({ message: 'Network connected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/:id/network/disconnect', async (req, res) => {
    try {
        const { networkId } = req.body;
        const network = docker.getNetwork(networkId);
        await network.disconnect({ Container: req.params.id });
        res.json({ message: 'Network disconnected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/:id/recreate', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const info = await container.inspect();
        const oldName = info.Name.replace(/^\//, '');
        const backupName = `${oldName}_bak_${Date.now()}`;
        await container.rename({ name: backupName });
        if (info.State.Running) await container.stop();

        const options = {
            name: oldName,
            Image: info.Config.Image,
            Cmd: info.Config.Cmd,
            Entrypoint: info.Config.Entrypoint,
            Env: info.Config.Env,
            WorkingDir: info.Config.WorkingDir,
            User: info.Config.User,
            ExposedPorts: info.Config.ExposedPorts,
            HostConfig: info.HostConfig,
            NetworkingConfig: info.NetworkSettings.Networks
        };
        if (info.NetworkSettings && info.NetworkSettings.Networks) {
            options.NetworkingConfig = { EndpointsConfig: info.NetworkSettings.Networks };
        }

        try {
            const newContainer = await docker.createContainer(options);
            await newContainer.start();
            const backupContainer = docker.getContainer(container.id);
            await backupContainer.remove({ force: true });
            res.json({ message: 'Container recreated successfully', id: newContainer.id });
        } catch (createError) {
            console.error('Recreation failed, rolling back:', createError);
            const backupContainer = docker.getContainer(container.id);
            await backupContainer.rename({ name: oldName });
            if (info.State.Running) await backupContainer.start();
            throw new Error(`Failed to recreate: ${createError.message}. Rolled back.`);
        }
    } catch (error) {
        console.error('Recreate error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Containers Service running on port ${PORT}`);
});
