import 'package:flutter/material.dart';
import '../../widgets/square_scaling_spinner.dart';
import '../services/api_service.dart';
import '../models/container_model.dart';
import 'logs_screen.dart';
import 'container_detail_screen.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/confirmation_dialog.dart';

class ContainersScreen extends StatefulWidget {
  const ContainersScreen({super.key});

  @override
  State<ContainersScreen> createState() => _ContainersScreenState();
}

class _ContainersScreenState extends State<ContainersScreen> {
  final ApiService _apiService = ApiService();
  late Future<List<ContainerModel>> _containersFuture;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _refreshContainers();
  }

  void _refreshContainers() {
    setState(() {
      _containersFuture = _apiService.getContainers().then((data) {
        return data.map((json) => ContainerModel.fromJson(json)).toList();
      });
    });
  }

  Future<void> _handleAction(String id, String action) async {
    try {
      if (action == 'start') await _apiService.startContainer(id);
      if (action == 'stop') await _apiService.stopContainer(id);
      if (action == 'restart') await _apiService.restartContainer(id);
      if (action == 'duplicate') await _apiService.duplicateContainer(id);
      if (action == 'duplicate') await _apiService.duplicateContainer(id);
      if (action == 'delete') {
        if (mounted) {
          await showConfirmationDialog(
            context: context,
            title: 'Delete Container',
            content: 'Are you sure you want to delete this container? This action cannot be undone.',
            onConfirm: () async {
              try {
                await _apiService.deleteContainer(id);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Delete action sent')),
                  );
                }
                _refreshContainers();
              } catch (e) {
                 if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
          );
        }
        return; // Return to avoid double snackbar from below block
      }
      if (action == 'logs') {
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => LogsScreen(containerId: id),
            ),
          );
        }
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Container $action success')));
      }
      _refreshContainers();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Color _getStateColor(String state) {
    if (state == 'running') return const Color(0xFF00E676); // Bright Green
    if (state == 'exited') return const Color(0xFFFF5252); // Bright Red
    return Colors.orangeAccent;
  }

  @override
  Widget build(BuildContext context) {
    return ResponsiveLayout(
      showHeader: true,
      title: 'Containers',
      child: Column(
        children: [
          // Search Block
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
                  hintText: 'Search by name, id, image...',
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

          // List Content
          Expanded(
            child: FutureBuilder<List<ContainerModel>>(
              future: _containersFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: SquareScalingSpinner(color: Color(0xFF00E5FF)),
                  );
                }
                if (snapshot.hasError) {
                  return Center(child: Text('Error: ${snapshot.error}'));
                }
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return const Center(
                    child: Text(
                      'No containers found',
                      style: TextStyle(color: Colors.white54),
                    ),
                  );
                }

                final containers = snapshot.data!.where((container) {
                  final name = container.names.isNotEmpty
                      ? container.names[0].toLowerCase()
                      : '';
                  final id = container.id.toLowerCase();
                  final image = container.image.toLowerCase();
                  return name.contains(_searchQuery) ||
                      id.contains(_searchQuery) ||
                      image.contains(_searchQuery);
                }).toList();

                if (containers.isEmpty) {
                  return const Center(
                    child: Text(
                      'No matching containers',
                      style: TextStyle(color: Colors.white54),
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  itemCount: containers.length,
                  itemBuilder: (context, index) {
                    final container = containers[index];
                    // Clean up name
                    final name = container.names.isNotEmpty
                        ? container.names[0].replaceAll('/', '')
                        : container.id.substring(0, 12);

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFF1E1E1E),
                            const Color(0xFF252525),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    ContainerDetailScreen(container: container),
                              ),
                            ).then((_) => _refreshContainers());
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Row(
                              children: [
                                // State Indicator
                                Container(
                                  width: 4,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: _getStateColor(container.state),
                                    borderRadius: BorderRadius.circular(2),
                                    boxShadow: [
                                      BoxShadow(
                                        color: _getStateColor(
                                          container.state,
                                        ).withOpacity(0.4),
                                        blurRadius: 8,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 16),
                                // Icon
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.black26,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(
                                    Icons.dns_outlined,
                                    color: Colors.white70,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                // Info
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        container.image,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Colors.white54,
                                          fontSize: 12,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        container.status,
                                        style: const TextStyle(
                                          color: Colors.white38,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                // Actions
                                PopupMenuButton<String>(
                                  icon: const Icon(
                                    Icons.more_vert,
                                    color: Colors.white54,
                                  ),
                                  onSelected: (value) =>
                                      _handleAction(container.id, value),
                                  color: const Color(0xFF2C2C2C),
                                  itemBuilder: (context) => [
                                    if (container.state != 'running')
                                      const PopupMenuItem(
                                        value: 'start',
                                        child: Text(
                                          'Start',
                                          style: TextStyle(color: Colors.white),
                                        ),
                                      ),
                                    if (container.state == 'running')
                                      const PopupMenuItem(
                                        value: 'stop',
                                        child: Text(
                                          'Stop',
                                          style: TextStyle(color: Colors.white),
                                        ),
                                      ),
                                    const PopupMenuItem(
                                      value: 'restart',
                                      child: Text(
                                        'Restart',
                                        style: TextStyle(color: Colors.white),
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'duplicate',
                                      child: Text(
                                        'Duplicate',
                                        style: TextStyle(color: Colors.white),
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'delete',
                                      child: Text(
                                        'Delete',
                                        style: TextStyle(
                                          color: Colors.redAccent,
                                        ),
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'logs',
                                      child: Text(
                                        'Logs',
                                        style: TextStyle(color: Colors.white),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
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
