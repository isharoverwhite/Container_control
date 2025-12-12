import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Use 10.0.2.2 for Android emulator to access host localhost
  // Or use local IP if running on device.
  // For web/linux, localhost is fine.
  // We can make this configurable.
  static const String baseUrl = 'http://localhost:3000/api';

  Future<List<dynamic>> getContainers() async {
    print('GET $baseUrl/containers');
    final response = await http.get(Uri.parse('$baseUrl/containers'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load containers: ${response.body}');
    }
  }

  Future<void> startContainer(String id) async {
    print('POST $baseUrl/containers/$id/start');
    await http.post(Uri.parse('$baseUrl/containers/$id/start'));
  }

  Future<void> stopContainer(String id) async {
    print('POST $baseUrl/containers/$id/stop');
    await http.post(Uri.parse('$baseUrl/containers/$id/stop'));
  }

  Future<void> restartContainer(String id) async {
    print('POST $baseUrl/containers/$id/restart');
    await http.post(Uri.parse('$baseUrl/containers/$id/restart'));
  }

  Future<void> duplicateContainer(String id) async {
    print('POST $baseUrl/containers/$id/duplicate');
    await http.post(Uri.parse('$baseUrl/containers/$id/duplicate'));
  }

  Future<void> deleteContainer(String id) async {
    print('DELETE $baseUrl/containers/$id');
    await http.delete(Uri.parse('$baseUrl/containers/$id'));
  }

  Future<Map<String, dynamic>> inspectContainer(String id) async {
    print('GET $baseUrl/containers/$id');
    final response = await http.get(Uri.parse('$baseUrl/containers/$id'));
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

    await http.post(
      Uri.parse('$baseUrl/containers/$id/update'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
  }

  Future<List<dynamic>> getImages() async {
    print('GET $baseUrl/images');
    final response = await http.get(Uri.parse('$baseUrl/images'));
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
    request.headers['Content-Type'] = 'application/json';

    final response = await request.send();
    if (response.statusCode != 200) {
      throw Exception('Failed to pull image: ${response.statusCode}');
    }

    return response.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter());
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
    await http.delete(Uri.parse('$baseUrl/images/$id'));
  }

  Future<dynamic> getVolumes() async {
    print('GET $baseUrl/volumes');
    final response = await http.get(Uri.parse('$baseUrl/volumes'));
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

    await http.post(
      Uri.parse('$baseUrl/volumes'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
  }

  Future<void> deleteVolume(String name) async {
    print('DELETE $baseUrl/volumes/$name');
    await http.delete(Uri.parse('$baseUrl/volumes/$name'));
  }

  Future<List<dynamic>> getStacks() async {
    print('GET $baseUrl/stacks');
    final response = await http.get(Uri.parse('$baseUrl/stacks'));
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
      headers: {'Content-Type': 'application/json'},
      body: json.encode(config),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to create container: ${response.body}');
    }
  }

  Future<void> createStack(String name, String content) async {
    print('POST $baseUrl/stacks name=$name');
    await http.post(
      Uri.parse('$baseUrl/stacks'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'name': name, 'content': content}),
    );
  }

  Future<void> upStack(String name) async {
    print('POST $baseUrl/stacks/$name/up');
    await http.post(Uri.parse('$baseUrl/stacks/$name/up'));
  }

  Future<void> downStack(String name) async {
    print('POST $baseUrl/stacks/$name/down');
    await http.post(Uri.parse('$baseUrl/stacks/$name/down'));
  }

  Future<void> controlStack(String name, String action) async {
    // action: up, down, remove
    print('POST $baseUrl/stacks/$name/$action');
    final response = await http.post(
      Uri.parse('$baseUrl/stacks/$name/$action'),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to $action stack: ${response.statusCode}');
    }
  }

  Future<List<dynamic>> getNetworks() async {
    print('GET $baseUrl/networks');
    final response = await http.get(Uri.parse('$baseUrl/networks'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load networks');
    }
  }

  Future<void> connectNetwork(String containerId, String networkId) async {
    print('POST $baseUrl/containers/$containerId/network/connect');
    await http.post(
      Uri.parse('$baseUrl/containers/$containerId/network/connect'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'networkId': networkId}),
    );
  }

  Future<void> disconnectNetwork(String containerId, String networkId) async {
    print('POST $baseUrl/containers/$containerId/network/disconnect');
    await http.post(
      Uri.parse('$baseUrl/containers/$containerId/network/disconnect'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'networkId': networkId}),
    );
  }
}
