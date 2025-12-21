FROM node:18-alpine

# Install system dependencies required by the server:
# - docker-cli: To interact with the Docker Host
# - docker-cli-compose: To support 'docker compose' commands in Stacks management
# - openssl: To generate self-signed SSL certificates (src/index.js)
# - pciutils: For 'lspci' command used in GPU detection functionality
RUN apk add --no-cache \
    docker-cli \
    docker-cli-compose \
    openssl \
    pciutils

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
