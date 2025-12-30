import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'server_manager.dart';

class ApiService {
  // Singleton pattern
  static final ApiService _instance = ApiService._internal();
  factory ApiService() {
    // Ensure socket is connected on first access
    if (!_instance._socketInitialized || !_instance.socket.connected) {
      _instance._ensureConnected();
    }
    return _instance;
  }
  
  late IO.Socket socket;
  bool _socketInitialized = false;
  
  ApiService._internal() {
    _initSocket();
  }
  
  void _ensureConnected() {
    if (!_socketInitialized) {
      print('ApiService: Socket not initialized, initializing now...');
      _initSocket();
    } else if (!socket.connected) {
      print('ApiService: Socket disconnected, reconnecting...');
      socket.connect();
    }
  }

  String get baseUrl {
    final server = ServerManager().activeServer;
    if (server == null) return 'https://localhost:3000/api'; // Fallback
    
    String ip = server.ip;
    if (!ip.startsWith('http')) ip = 'https://$ip';
    
    // Remove trailing slash if present
    if (ip.endsWith('/')) ip = ip.substring(0, ip.length - 1);
    
    return '$ip/api';
  }

  String get socketUrl {
     final server = ServerManager().activeServer;
     if (server == null) return 'https://localhost:3000';
     
     String ip = server.ip;
     if (!ip.startsWith('http')) ip = 'https://$ip';
     
     if (ip.endsWith('/')) ip = ip.substring(0, ip.length - 1);
     return ip;
  }

  Map<String, String> get _headers {
    final server = ServerManager().activeServer;
    return {
      'Content-Type': 'application/json',
      'x-device-id': ServerManager().deviceId,
      'x-device-name': ServerManager().deviceName,
      if (server != null && server.apiKey.isNotEmpty) 'x-secret-key': server.apiKey,
    };
  }
  
  // Initialize socket (called once in constructor)
  void _initSocket() {
    final server = ServerManager().activeServer;
    
    socket = IO.io(socketUrl, <String, dynamic>{
        'transports': ['websocket'], // Force WebSocket for better performance/reliability
        'autoConnect': false,
        'reconnection': true,
        'reconnectionAttempts': double.infinity,
        'reconnectionDelay': 1000,
        'reconnectionDelayMax': 5000,
        'secure': true,
        'rejectUnauthorized': false, // Critical for self-signed certs
        'auth': {'token': server?.apiKey, 'deviceId': ServerManager().deviceId},
        'extraHeaders': {
            'x-device-id': ServerManager().deviceId,
            'x-device-name': ServerManager().deviceName,
            if (server?.apiKey != null) 'x-secret-key': server!.apiKey 
        }
    });
        
    // Ensure the hack is also applied just in case
    socket.io.options?['rejectUnauthorized'] = false;
        
    // Add connection event listeners for debugging
    socket.onConnect((_) {
      print('ApiService: ✓ Socket connected to $socketUrl');
    });
    
    socket.onConnectError((data) {
      print('ApiService: ✗ Socket connect error: $data');
    });
    
    socket.onDisconnect((_) {
      print('ApiService: Socket disconnected, will auto-reconnect...');
    });
    
    socket.onReconnect((data) {
      print('ApiService: ✓ Socket reconnected (attempt $data)');
    });
    
    socket.onReconnectAttempt((data) {
      print('ApiService: Reconnection attempt $data...');
    });
    
    socket.onReconnectError((data) {
      print('ApiService: Reconnection error: $data');
    });
    
    socket.onError((data) {
      // Only log non-socket errors to reduce noise
      if (!data.toString().contains('SocketException')) {
        print('ApiService: Socket error: $data');
      }
    });
        
    print('ApiService: Socket initialized for $socketUrl, connecting...');
    socket.connect(); // Explicitly connect
    _socketInitialized = true;
  }
  
  // Re-init socket when server changes (call this when switching servers)
  void reinitSocket() {
    print('ApiService: Reinitializing socket...');
    socket.disconnect();
    socket.dispose();
    _initSocket();
  }

  Future<List<dynamic>> getContainers() async {
    print('GET $baseUrl/containers');
    final response = await http.get(Uri.parse('$baseUrl/containers'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load containers: ${response.body}');
    }
  }

  Future<void> startContainer(String id) async {
    print('POST $baseUrl/containers/$id/start');
    final response = await http.post(Uri.parse('$baseUrl/containers/$id/start'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Failed to start container: ${response.body}');
    }
  }

  Future<void> stopContainer(String id) async {
    print('POST $baseUrl/containers/$id/stop');
    final response = await http.post(Uri.parse('$baseUrl/containers/$id/stop'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Failed to stop container: ${response.body}');
    }
  }

  Future<void> restartContainer(String id) async {
    print('POST $baseUrl/containers/$id/restart');
    final response = await http.post(Uri.parse('$baseUrl/containers/$id/restart'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Failed to restart container: ${response.body}');
    }
  }

  Future<void> duplicateContainer(String id) async {
    print('POST $baseUrl/containers/$id/duplicate');
    final response = await http.post(Uri.parse('$baseUrl/containers/$id/duplicate'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Failed to duplicate container: ${response.body}');
    }
  }

  Future<void> deleteContainer(String id) async {
    print('DELETE $baseUrl/containers/$id');
    final response = await http.delete(Uri.parse('$baseUrl/containers/$id'), headers: _headers);
    
    if (response.statusCode == 200) return;

    String errorMessage = response.body;
    try {
      final body = json.decode(response.body);
      if (body['error'] != null) errorMessage = body['error'];
    } catch (_) {}

    throw Exception(errorMessage);
  }

  Future<Map<String, dynamic>> inspectContainer(String id) async {
    print('GET $baseUrl/containers/$id');
    final response = await http.get(Uri.parse('$baseUrl/containers/$id'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to inspect container');
    }
  }

  Future<void> updateContainer(
    String id, {
    Map<String, dynamic>? restartPolicy,
  }) async {
    print('POST $baseUrl/containers/$id/update');
    final body = {};
    if (restartPolicy != null) {
      body['RestartPolicy'] = restartPolicy;
    }

    final response = await http.post(
      Uri.parse('$baseUrl/containers/$id/update'),
      headers: _headers,
      body: json.encode(body),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to update container: ${response.body}');
    }
  }

  Future<List<dynamic>> getImages() async {
    print('GET $baseUrl/images');
    final response = await http.get(Uri.parse('$baseUrl/images'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load images');
    }
  }

  Future<Stream<String>> pullImage(String image) async {
    print('POST $baseUrl/images/pull body={image: $image}');
    final request = http.Request('POST', Uri.parse('$baseUrl/images/pull'));
    request.body = json.encode({'image': image});
    request.headers.addAll(_headers);

    final response = await request.send();
    if (response.statusCode != 200) {
      throw Exception('Failed to start pull: ${response.statusCode}');
    }
    
    return response.stream.transform(utf8.decoder).transform(const LineSplitter());
  }

  // Trigger background pull on server - client listens to socket events for progress
  Future<void> pullImageBackground(String image) async {
    print('POST $baseUrl/images/pull body={image: $image} (background mode)');
    final response = await http.post(
      Uri.parse('$baseUrl/images/pull'),
      headers: _headers,
      body: json.encode({'image': image}),
    );
    
    if (response.statusCode != 200) {
      throw Exception('Failed to start pull: ${response.statusCode}');
    }
  }

  Future<List<String>> getPullingImages() async {
    final response = await http.get(Uri.parse('$baseUrl/images/pulling'), headers: _headers);
    if (response.statusCode == 200) {
      final List<dynamic> list = json.decode(response.body);
      return list.cast<String>();
    }
    return [];
  }

  Future<List<dynamic>> searchImages(String term) async {
    // Client-side search to Docker Hub v2 API
    final url = Uri.parse(
      'https://hub.docker.com/v2/search/repositories?query=$term&page_size=20',
    );
    print('GET $url');
    final response = await http.get(url);
    print('Response status: ${response.statusCode}');
    print('Response body: ${response.body}');

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      // Map Docker Hub format to our expected format if needed, or just return results
      // Docker Hub returns { count, next, previous, results: [...] }
      final results = data['results'];
      print('Parsed results count: ${results?.length}');
      return results ?? [];
    } else {
      throw Exception('Failed to search images: ${response.statusCode}');
    }
  }

  Future<void> deleteImage(String id) async {
    print('DELETE $baseUrl/images/$id');
    final response = await http.delete(Uri.parse('$baseUrl/images/$id'), headers: _headers);
    
    if (response.statusCode == 200) return;

    String errorMessage = response.body;
    try {
      final body = json.decode(response.body);
      if (body['error'] != null) {
        errorMessage = body['error'];
      }
    } catch (_) {}

    throw Exception(errorMessage);
  }

  Future<dynamic> getVolumes() async {
    print('GET $baseUrl/volumes');
    final response = await http.get(Uri.parse('$baseUrl/volumes'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load volumes');
    }
  }

  Future<void> createVolume({
    required String name,
    String? driver,
    Map<String, String>? driverOpts,
    Map<String, String>? labels,
  }) async {
    print('POST $baseUrl/volumes name=$name');
    final body = {
      'name': name,
      if (driver != null) 'driver': driver,
      if (driverOpts != null) 'driverOpts': driverOpts,
      if (labels != null) 'labels': labels,
    };

    final response = await http.post(
      Uri.parse('$baseUrl/volumes'),
      headers: _headers,
      body: json.encode(body),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create volume: ${response.body}');
    }
  }

  Future<void> deleteVolume(String name) async {
    print('DELETE $baseUrl/volumes/$name');
    final response = await http.delete(Uri.parse('$baseUrl/volumes/$name'), headers: _headers);
    
    if (response.statusCode == 200) return;

    String errorMessage = response.body;
    try {
      final body = json.decode(response.body);
      if (body['error'] != null) errorMessage = body['error'];
    } catch (_) {}

    throw Exception(errorMessage);
  }

  Future<List<dynamic>> getStacks() async {
    print('GET $baseUrl/stacks');
    final response = await http.get(Uri.parse('$baseUrl/stacks'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      return [];
    }
  }

  Future<void> createContainer(Map<String, dynamic> config) async {
    print('POST $baseUrl/containers/create');
    final response = await http.post(
      Uri.parse('$baseUrl/containers/create'),
      headers: _headers,
      body: json.encode(config),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create container: ${response.body}');
    }
  }

  Future<void> createStack(String name, String content) async {
    print('POST $baseUrl/stacks name=$name');
    final response = await http.post(
      Uri.parse('$baseUrl/stacks'),
      headers: _headers,
      body: json.encode({'name': name, 'content': content}),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create stack: ${response.body}');
    }
  }

  Future<void> upStack(String name) async {
    print('POST $baseUrl/stacks/$name/up');
    final response = await http.post(Uri.parse('$baseUrl/stacks/$name/up'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Failed to up stack: ${response.body}');
    }
  }

  Future<void> downStack(String name) async {
    print('POST $baseUrl/stacks/$name/down');
    final response = await http.post(Uri.parse('$baseUrl/stacks/$name/down'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Failed to down stack: ${response.body}');
    }
  }

  Future<void> controlStack(String name, String action) async {
    // action: up, down, remove
    print('POST $baseUrl/stacks/$name/$action');
    final response = await http.post(
      Uri.parse('$baseUrl/stacks/$name/$action'),
      headers: _headers,
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to $action stack: ${response.statusCode}');
    }
  }

  Future<List<dynamic>> getNetworks() async {
    print('GET $baseUrl/networks');
    final response = await http.get(Uri.parse('$baseUrl/networks'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load networks');
    }
  }

  Future<void> connectNetwork(String containerId, String networkId) async {
    print('POST $baseUrl/containers/$containerId/network/connect');
    final response = await http.post(
      Uri.parse('$baseUrl/containers/$containerId/network/connect'),
      headers: _headers,
      body: json.encode({'networkId': networkId}),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to connect network: ${response.body}');
    }
  }

  Future<void> recreateContainer(String id) async {
    print('POST $baseUrl/containers/$id/recreate');
    final response = await http.post(
      Uri.parse('$baseUrl/containers/$id/recreate'),
      headers: _headers,
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to recreate container: ${response.body}');
    }
  }

  Future<void> disconnectNetwork(String containerId, String networkId) async {
    print('POST $baseUrl/containers/$containerId/network/disconnect');
    final response = await http.post(
      Uri.parse('$baseUrl/containers/$containerId/network/disconnect'),
      headers: _headers,
      body: json.encode({'networkId': networkId}),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to disconnect network: ${response.body}');
    }
  }

  Future<Map<String, dynamic>> getSystemInfo() async {
    final response = await http.get(Uri.parse('$baseUrl/system/info'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load system info');
    }
  }

  Future<void> login(String username, String password, {String? server}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _headers,
      body: json.encode({
        'username': username,
        'password': password,
        'serveraddress': server,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception(
        json.decode(response.body)['error'] ?? 'Authentication failed',
      );
    }
  }

  Future<Map<String, dynamic>> initDeviceLogin() async {
    final response = await http.post(Uri.parse('$baseUrl/auth/login/device'), headers: _headers);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to initiate device login');
    }
  }

  Future<void> pollDeviceLogin() async {
    final response = await http.post(Uri.parse('$baseUrl/auth/login/device/poll'), headers: _headers);
    if (response.statusCode != 200) {
      // Pending or error
      final body = json.decode(response.body);
      throw Exception(body['error'] ?? 'Login failed');
    }
  }

  Future<void> logout() async {
    final response = await http.post(Uri.parse('$baseUrl/auth/logout'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Failed to logout');
    }
  }

  Future<Map<String, dynamic>> getDockerHubRepository(String name) async {
    // name format: 'library/ubuntu' or 'user/repo'
    // If just 'ubuntu', assume 'library/ubuntu'
    if (!name.contains('/')) {
      name = 'library/$name';
    }

    final url = Uri.parse('https://hub.docker.com/v2/repositories/$name/');
    final response = await http.get(url);
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load repository details');
    }
  }

  Future<List<String>> getDockerHubTags(String name) async {
    if (!name.contains('/')) {
      name = 'library/$name';
    }

    final url = Uri.parse(
      'https://hub.docker.com/v2/repositories/$name/tags?page_size=100',
    );
    final response = await http.get(url);

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List<dynamic> results = data['results'] ?? [];
      return results.map<String>((tag) => tag['name'] as String).toList();
    } else {
      // Fallback or empty on error
      return [];
    }
  }
}
