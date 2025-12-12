import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'image_detail_screen.dart';
import 'docker_hub_search_screen.dart';
import 'create_container_screen.dart';
import '../widgets/responsive_layout.dart';

class ImagesScreen extends StatefulWidget {
  const ImagesScreen({super.key});

  @override
  State<ImagesScreen> createState() => _ImagesScreenState();
}

class _ImagesScreenState extends State<ImagesScreen> {
  final ApiService _apiService = ApiService();
  late Future<List<dynamic>> _imagesFuture;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _refreshImages();
  }

  void _refreshImages() {
    setState(() {
      _imagesFuture = _apiService.getImages();
    });
  }

  Future<void> _deleteImage(String id) async {
    try {
      await _apiService.deleteImage(id);
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Image deleted')));
      _refreshImages();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _openDockerHubSearch() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const DockerHubSearchScreen()),
    ).then((_) {
      _refreshImages();
    });
  }

  Future<void> _showLoginDialog() async {
    final usernameController = TextEditingController();
    final passwordController = TextEditingController();
    final serverController = TextEditingController(
      text: 'https://index.docker.io/v1/',
    );

    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          title: const Text(
            'Docker Login',
            style: TextStyle(color: Colors.white),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: usernameController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Username',
                    labelStyle: TextStyle(color: Colors.white54),
                    enabledBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: Colors.white10),
                    ),
                  ),
                ),
                TextField(
                  controller: passwordController,
                  obscureText: true,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    labelStyle: TextStyle(color: Colors.white54),
                    enabledBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: Colors.white10),
                    ),
                  ),
                ),
                TextField(
                  controller: serverController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Registry Server',
                    labelStyle: TextStyle(color: Colors.white54),
                    enabledBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: Colors.white10),
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.of(dialogContext).pop(),
            ),
            TextButton(
              child: const Text(
                'Login',
                style: TextStyle(color: Color(0xFF00E5FF)),
              ),
              onPressed: () async {
                Navigator.of(dialogContext).pop();
                try {
                  await _apiService.login(
                    usernameController.text,
                    passwordController.text,
                    server: serverController.text.isNotEmpty
                        ? serverController.text
                        : null,
                  );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Login successful')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text('Error: $e')));
                  }
                }
              },
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ResponsiveLayout(
      showHeader: true,
      title: 'Images',
      actions: [
        IconButton(
          icon: const Icon(Icons.login, color: Colors.white70),
          onPressed: _showLoginDialog,
          tooltip: 'Login to Registry',
        ),
        IconButton(
          icon: const Icon(Icons.add, color: Color(0xFF00E5FF)),
          onPressed: _openDockerHubSearch,
        ),
      ],
      child: Column(
        children: [
          // Header Block (Search)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 16.0,
              vertical: 8.0,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF2C2C2C),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: TextField(
                controller: _searchController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Search tags or id...',
                  hintStyle: TextStyle(color: Colors.white54),
                  prefixIcon: Icon(Icons.search, color: Color(0xFF00E5FF)),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value.toLowerCase();
                  });
                },
              ),
            ),
          ),

          Expanded(
            child: FutureBuilder<List<dynamic>>(
              future: _imagesFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: Color(0xFF00E5FF)),
                  );
                }
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return const Center(
                    child: Text(
                      'No images found',
                      style: TextStyle(color: Colors.white54),
                    ),
                  );
                }

                final images = snapshot.data!.where((image) {
                  final tags =
                      (image['RepoTags'] as List?)?.join(', ').toLowerCase() ??
                      '';
                  final id = (image['Id'] as String).toLowerCase();
                  return tags.contains(_searchQuery) ||
                      id.contains(_searchQuery);
                }).toList();

                if (images.isEmpty) {
                  return const Center(
                    child: Text(
                      'No matching images',
                      style: TextStyle(color: Colors.white54),
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: images.length,
                  itemBuilder: (context, index) {
                    final image = images[index];
                    final tags =
                        (image['RepoTags'] as List?)?.join(', ') ?? 'No tag';
                    final size = ((image['Size'] as int) / 1024 / 1024)
                        .toStringAsFixed(2);

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E1E1E),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: ListTile(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) =>
                                  ImageDetailScreen(image: image),
                            ),
                          ).then((_) => _refreshImages());
                        },
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.blueAccent.withOpacity(0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.inventory_2,
                            color: Colors.blueAccent,
                          ),
                        ),
                        title: Text(
                          tags,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          '$size MB',
                          style: const TextStyle(color: Colors.white38),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(
                                Icons.play_circle_fill,
                                color: Color(0xFF00E676),
                              ),
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => CreateContainerScreen(
                                      initialImage: image,
                                    ),
                                  ),
                                );
                              },
                              tooltip: 'Run this image',
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.delete_outline,
                                color: Colors.redAccent,
                              ),
                              onPressed: () => _deleteImage(image['Id']),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
