FROM node:20-alpine

# Install Docker CLI and Docker Compose
RUN apk add --no-cache docker-cli docker-cli-compose openssl

WORKDIR /app

# Copy Root Dependencies
COPY package*.json ./
RUN npm install

# Copy WebUI Dependencies
COPY services/webui/package*.json ./services/webui/

# Install WebUI Dependencies
WORKDIR /app/services/webui
RUN npm install

# Return to root
WORKDIR /app

# Copy Source Code
COPY . .

# Build WebUI
WORKDIR /app/services/webui
RUN npm run build

# Return to root
WORKDIR /app

# Expose Ports
EXPOSE 3000 3001 3002 3003 3004 3005 3006 3007 8080

# Start Application
CMD ["npm", "start"]
