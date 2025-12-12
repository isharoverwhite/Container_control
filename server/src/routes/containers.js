const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// List containers
router.get('/', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        res.json(containers);
    } catch (error) {
        console.error('Error listing containers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create container (Advanced)
router.post('/create', async (req, res) => {
    try {
        const {
            name,
            image,
            env, // Array of "KEY=VALUE"
            cmd, // Array or String
            entrypoint,
            workingDir,
            user,
            ports, // [{ private: 80, public: 8080, protocol: 'tcp' }]
            volumes, // [{ source: '/host', target: '/con', type: 'bind'/'volume' }]
            network, // { mode, hostname, domainname, mac, ipv4, ipv6, dns_primary, dns_secondary }
            resources, // { memory, nanoCpus, shmSize, privileged, gpu, devices: [] }
            restartPolicy // 'always', 'unless-stopped', etc.
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
                ShmSize: resources?.shmSize ? parseInt(resources.shmSize) * 1024 * 1024 : undefined, // MB to bytes
                Memory: resources?.memory ? parseInt(resources.memory) * 1024 * 1024 : undefined, // MB to bytes
                NanoCpus: resources?.nanoCpus ? parseFloat(resources.nanoCpus) * 1000000000 : undefined,
                Devices: resources?.devices || [], // [{ PathOnHost, PathInContainer, CgroupPermissions }]
                DeviceRequests: resources?.gpu ? [{
                    Driver: '',
                    Count: -1,
                    DeviceIDs: [],
                    Capabilities: [['gpu']]
                }] : undefined,
                DNS: []
            },
            NetworkingConfig: { EndpointsConfig: {} }
        };

        // Name
        const containerName = name || undefined;

        // Ports
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

        // Volumes
        if (volumes && volumes.length > 0) {
            volumes.forEach(v => {
                // Formatting for Binds: "source:target:mode"
                // If named volume: "myvol:/app"
                // If bind: "/host/path:/app"
                // Readonly? :ro
                let bind = `${v.source}:${v.target}`;
                if (v.readonly) bind += ':ro';
                config.HostConfig.Binds.push(bind);
            });
        }

        // Network
        if (network) {
            if (network.dns_primary || network.dns_secondary) {
                if (network.dns_primary) config.HostConfig.DNS.push(network.dns_primary);
                if (network.dns_secondary) config.HostConfig.DNS.push(network.dns_secondary);
            }

            // Network Mode
            // If it's a standard network (bridge, host, none), set HostConfig.NetworkMode
            // If it's a custom user-defined network, we might need NetworkingConfig
            if (['bridge', 'host', 'none', 'container'].includes(network.mode)) {
                config.HostConfig.NetworkMode = network.mode;
            } else if (network.mode) {
                // For user defined networks, we attach to it
                config.HostConfig.NetworkMode = network.mode;
                config.NetworkingConfig.EndpointsConfig[network.mode] = {
                    IPAMConfig: {}
                };
                if (network.ipv4) config.NetworkingConfig.EndpointsConfig[network.mode].IPAMConfig.IPv4Address = network.ipv4;
                if (network.ipv6) config.NetworkingConfig.EndpointsConfig[network.mode].IPAMConfig.IPv6Address = network.ipv6;
            }
        }

        const container = await docker.createContainer({
            name: containerName,
            ...config
        });

        if (req.body.autostart) {
            await container.start();
        }

        res.json({ message: 'Container created' + (req.body.autostart ? ' and started' : ''), id: container.id });
    } catch (error) {
        console.error('Create error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Inspect container
router.get('/:id', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const data = await container.inspect();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start container
router.post('/:id/start', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.start();
        res.json({ message: 'Container started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop container
router.post('/:id/stop', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.stop();
        res.json({ message: 'Container stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Restart container
router.post('/:id/restart', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.restart();
        res.json({ message: 'Container restarted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove container
router.delete('/:id', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.remove({ force: req.query.force === 'true' });
        res.json({ message: 'Container removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Duplicate container
router.post('/:id/duplicate', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const info = await container.inspect();

        // Construct config for new container
        // We try to copy as much as possible from Config and HostConfig
        const name = info.Name.replace(/^\//, '') + '-copy-' + Date.now();

        const config = {
            ...info.Config,
            HostConfig: info.HostConfig,
            name: name
        };

        // Remove ID/ImageID specific fields that shouldn't be copied
        delete config.Hostname; // Let docker assign or keep? Keep might conflict if network same
        // Actually duplication logic is complex. 
        // Simplest: Image, Cmd, Env, ExposedPorts, HostConfig (PortBindings, Binds)

        // dockerode createContainer takes options
        const options = {
            name: name,
            Image: info.Config.Image,
            Cmd: info.Config.Cmd,
            Env: info.Config.Env,
            ExposedPorts: info.Config.ExposedPorts,
            HostConfig: info.HostConfig,
            // Add more as needed: Volumes, Network, etc.
        };

        const newContainer = await docker.createContainer(options);
        res.json({ message: 'Container duplicated', id: newContainer.id, name });
    } catch (error) {
        console.error('Duplicate error', error);
        res.status(500).json({ error: error.message });
    }
});

// Update container configuration (Restart Policy, Rename)
router.post('/:id/update', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const { RestartPolicy } = req.body;

        // dockerode 'update' method updates resources and restart policy.
        if (RestartPolicy) {
            await container.update({
                RestartPolicy: RestartPolicy // { Name: 'always' } or { Name: 'on-failure', MaximumRetryCount: 5 }
            });
        }

        res.json({ message: 'Container updated' });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id/logs', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 100,
            timestamps: true
        });
        res.send(logs.toString());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/network/connect', async (req, res) => {
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

router.post('/:id/network/disconnect', async (req, res) => {
    try {
        const { networkId } = req.body;
        const network = docker.getNetwork(networkId);
        await network.disconnect({ Container: req.params.id });
        res.json({ message: 'Network disconnected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Re-create container (Update)
router.post('/:id/recreate', async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const info = await container.inspect();
        const oldName = info.Name.replace(/^\//, '');
        const backupName = `${oldName}_bak_${Date.now()}`;

        // 1. Rename old container to backup
        await container.rename({ name: backupName });

        // 2. Stop if running
        if (info.State.Running) {
            await container.stop();
        }

        // 3. Create new container with same config
        // Using info.Config.Image guarantees we use the tag (e.g. nginx:latest) 
        // so it uses the newly pulled image with that tag.
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
            NetworkingConfig: info.NetworkSettings.Networks // Use NetworkSettings for create? No, usually NetworkingConfig
        };

        // Fix for NetworkingConfig: inspect returns NetworkSettings, create expects NetworkingConfig
        if (info.NetworkSettings && info.NetworkSettings.Networks) {
            options.NetworkingConfig = { EndpointsConfig: info.NetworkSettings.Networks };
        }

        try {
            const newContainer = await docker.createContainer(options);
            await newContainer.start();

            // Success: Remove backup
            // We need to re-fetch the backup container object because name changed
            const backupContainer = docker.getContainer(container.id);
            await backupContainer.remove({ force: true });

            res.json({ message: 'Container recreated successfully', id: newContainer.id });
        } catch (createError) {
            console.error('Recreation failed, rolling back:', createError);
            // Rollback: Rename backup back to oldName and start if it was running
            const backupContainer = docker.getContainer(container.id);
            await backupContainer.rename({ name: oldName });
            if (info.State.Running) {
                await backupContainer.start();
            }
            throw new Error(`Failed to recreate: ${createError.message}. Rolled back.`);
        }
    } catch (error) {
        console.error('Recreate error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
