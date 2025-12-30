import 'package:flutter/material.dart';
import '../../widgets/square_scaling_spinner.dart';
import '../services/api_service.dart';
import 'image_detail_screen.dart';
import 'docker_hub_search_screen.dart';
import 'create_container_screen.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/confirmation_dialog.dart';

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
  final Set<String> _loadingImageIds = {};

  @override
  void initState() {
    super.initState();
    _refreshImages();
    _setupSocketListeners();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _apiService.socket.off('images_changed');
    _apiService.socket.off('connect');
    super.dispose();
  }

  void _setupSocketListeners() {
    // Listen for image changes from server
    _apiService.socket.on('images_changed', (_) {
      if (mounted) {
        print('Images changed event received, refreshing list...');
        _refreshImages();
      }
    });
    
    // Listen for socket reconnection to auto-refresh
    _apiService.socket.on('connect', (_) {
      if (mounted) {
        print('Socket reconnected, refreshing images...');
        _refreshImages();
      }
    });
  }

  void _refreshImages() {
    setState(() {
      _imagesFuture = _apiService.getImages();
    });
  }

  Future<void> _deleteImage(String id) async {
    if (!mounted) return;
    await showConfirmationDialog(
      context: context,
      title: 'Delete Image',
      content: 'Are you sure you want to delete this image? This action cannot be undone.',
      onConfirm: () async {
        setState(() {
          _loadingImageIds.add(id);
        });
        
        String? error;
        try {
          await _apiService.deleteImage(id);
        } catch (e) {
          error = e.toString();
        }

        // 1. Stop Loading state
        if (mounted) {
           setState(() {
             _loadingImageIds.remove(id);
           });
        }

        // 2. Refresh List
        _refreshImages();

        // 3. Notification
        if (mounted) {
          if (error != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(error!.replaceAll('Exception: ', '')), backgroundColor: Colors.redAccent),
            );
          } else {
             ScaffoldMessenger.of(context).showSnackBar(
               const SnackBar(
                content: Text('Image deleted successfully'), 
                backgroundColor: Color(0xFF00E676),
              ),
            );
          }
        }
      },
    );
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
    bool loading = true;
    String? userCode;
    String? verificationUri;

    // Start flow immediately
    try {
      final data = await _apiService.initDeviceLogin();
      userCode = data['user_code'];
      verificationUri = data['verification_uri'];
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start login: $e')),
        );
      }
      return;
    } finally {
      loading = false;
    }

    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E1E1E),
              title: const Text(
                'Connect Docker Account',
                style: TextStyle(color: Colors.white),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'To log in, visit the following URL on your device and enter the code below:',
                    style: TextStyle(color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  SelectableText(
                    verificationUri ?? '',
                    style: const TextStyle(
                      color: Color(0xFF00E5FF),
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.black26,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: SelectableText(
                      userCode ?? 'ERROR',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const SquareScalingSpinner(size: 20, color: Colors.white54),
                  const SizedBox(height: 8),
                  const Text(
                    'Waiting for confirmation...',
                    style: TextStyle(color: Colors.white38, fontSize: 12),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  child: const Text('Cancel'),
                  onPressed: () => Navigator.of(dialogContext).pop(),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00E5FF)),
                  onPressed: () async {
                    // Manual poll trigger for "I've done it"
                    try {
                      await _apiService.pollDeviceLogin();
                      if (context.mounted) {
                        Navigator.of(dialogContext).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Login successful')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                         ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Not verified yet')),
                        );
                      }
                    }
                  },
                  child: const Text('I have confirmed', style: TextStyle(color: Colors.black)),
                ),
              ],
            );
          },
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
                    child: SquareScalingSpinner(color: Color(0xFF00E5FF)),
                  );
                }
                if (snapshot.hasError) {
                  // Show toast notification for connection error
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Cannot connect to server. Check your server now.'),
                          backgroundColor: Colors.redAccent,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  });
                  // Show empty state instead of error
                  return const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.cloud_off, size: 64, color: Colors.white24),
                        SizedBox(height: 16),
                        Text(
                          'Connection Error',
                          style: TextStyle(color: Colors.white54, fontSize: 16),
                        ),
                      ],
                    ),
                  );
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
                            if (_loadingImageIds.contains(image['Id']))
                              const SizedBox(
                                width: 24, 
                                height: 24, 
                                child: SquareScalingSpinner(size: 24, color: Colors.blueAccent)
                              )
                            else ...[
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
                            ]
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
