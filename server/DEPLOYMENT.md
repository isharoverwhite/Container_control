# Server Deployment Guide

This guide describes how to build and run the Container Control Server as a Docker container.

## Prerequisites

- **Docker** installed on the host machine.
- Access to the Docker socket (`/var/run/docker.sock`) on the host.

## 1. Configure Security

Create a `.env` file in the `server` directory (or wherever you run the container) with your secret key:

```bash
```

## 2. Build the Docker Image

Navigate to the `server` directory of the project and run the build command.
*Note: If building on a machine with a different architecture than the target server (e.g., Mac M1 for an x86 server), use the `--platform` flag.*

```bash
# From the project root
cd server

# Build the image tagging it 'container-control-server'
docker build -t container-control-server .

# Optional: For cross-platform build (e.g. Mac -> Linux Server)
# docker build --platform linux/amd64 -t container-control-server .
```

## 3. Run the Container

The server requires access to the host's Docker socket and the `API_KEY`.

Run the following command:

```bash
docker run -d \
  --name container-control-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --env-file .env \
  container-control-server
```

### Command Breakdown:
- `-d`: Runs in background.
- `--name container-control-server`: Container name.
- `--restart unless-stopped`: Auto-restart.
- `-p 3000:3000`: Map port.
- `-v /var/run/docker.sock:/var/run/docker.sock`: **Critical**. Access to host Docker.

## 4. Verification

Check the logs:

```bash
docker logs -f container-control-server
```

You should see:
```
Server running on port 3000
--- Server Addresses ---
...
```
