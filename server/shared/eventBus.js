const axios = require('axios');
const https = require('https');

// Create axios instance with SSL verification disabled for self-signed certs
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false // Allow self-signed certificates
    })
});

const emit = async (event, data) => {
    console.log(`EventBus: Emitting '${event}'`, data ? JSON.stringify(data).substring(0, 100) : '');
    try {
        // Gateway uses HTTPS with self-signed cert
        const response = await axiosInstance.post('https://localhost:3000/internal/emit', { event, data });
        console.log(`EventBus: ✓ '${event}' sent, status:`, response.status);
    } catch (e) {
        console.error(`EventBus: ✗ Error for '${event}':`, e.message);
    }
};

module.exports = { emit };
