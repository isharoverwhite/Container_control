# Socket.IO Connection Issues

## Current Problems

### 1. Persistent Socket Disconnections
```
I/flutter: Disconnected
E/flutter: SocketException: Reading from a closed socket
```
- Socket disconnects immediately after any connection attempt
- Happens repeatedly, preventing any real-time features from working
- Affects: Pull notifications, container logs streaming

### 2. Missing Debug Logs
Expected logs not appearing:
- `ApiService: Socket initialized for https://...`
- `ApiService: ✓ Socket connected to https://...`
- `LogsScreen: initState for container <id>`
- `LogsScreen: Subscribing to logs for <id>`

This suggests the singleton pattern isn't working or hot reload isn't applying changes.

### 3. Server Shows No Clients
Server logs show:
```
Gateway: ✓ Broadcasted 'docker_pull_progress' to 0 client(s)
```
No "Client connected" messages, confirming socket never successfully connects.

## Root Cause Analysis

### Possible Causes:

1. **WebSocket Protocol Issue**
   - Flutter's Socket.IO client may have compatibility issues with the server's Socket.IO version
   - HTTPS/WSS connection might be failing due to self-signed certificates

2. **Singleton Not Initializing**
   - Hot reload doesn't properly initialize singletons
   - Full restart attempted but still failing

3. **Network/Firewall Issue**
   - WebSocket connections being blocked
   - Port 3000 accessible for HTTP but not WebSocket upgrade

4. **Socket.IO Configuration Mismatch**
   - Client and server Socket.IO versions incompatible
   - Transport configuration issues

## Attempted Solutions

1. ✅ Converted `ApiService` to singleton
2. ✅ Added automatic reconnection logic
3. ✅ Fixed listener lifecycle in logs screen
4. ✅ Removed `socket.disconnect()` calls
5. ✅ Full server + client restart
6. ❌ Still failing

## Recommendations

### Option 1: Debug Socket.IO Connection
1. Check Socket.IO versions (client vs server)
2. Test with simple Socket.IO example
3. Check if WebSocket upgrade is happening
4. Verify SSL certificate handling

### Option 2: Alternative Approach - Server-Sent Events (SSE)
Instead of Socket.IO, use HTTP streaming:
- More reliable for one-way server→client communication
- Works better with HTTPS/self-signed certs
- Simpler implementation
- Better for pull notifications and logs

### Option 3: Polling Fallback
- Use HTTP polling for real-time updates
- Less efficient but more reliable
- Guaranteed to work with existing HTTP setup

## Next Steps

**Immediate**: Need to determine why WebSocket connection fails
- Check browser DevTools network tab for WebSocket upgrade
- Verify Socket.IO client/server versions match
- Test basic Socket.IO connection without authentication

**Long-term**: Consider if Socket.IO is the right choice for this use case
- Pull notifications: Could use polling or SSE
- Logs streaming: Could use HTTP streaming
- Exec terminal: Requires bidirectional, Socket.IO appropriate here
