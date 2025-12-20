FROM node:18-alpine

# Install Docker CLI and Docker Compose plugin
# These are required to allow the server to execute 'docker compose' commands
# and interact with the Docker socket mounted from the host.
RUN apk add --no-cache docker-cli docker-cli-compose

WORKDIR /app

# Copy package files first to leverage Docker cache for dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
