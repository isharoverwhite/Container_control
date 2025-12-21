import 'dart:async';
import 'package:flutter/material.dart';
import '../../widgets/square_scaling_spinner.dart';
import '../services/api_service.dart';
import '../models/container_model.dart';
import 'logs_screen.dart';
import 'container_detail_screen.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/confirmation_dialog.dart';

import 'create_container_screen.dart';

class ContainersScreen extends StatefulWidget {
  const ContainersScreen({super.key});

  @override
  State<ContainersScreen> createState() => _ContainersScreenState();
}

class _ContainersScreenState extends State<ContainersScreen> {
  final ApiService _apiService = ApiService();
  List<ContainerModel> _containers = [];
  bool _isLoading = true;
  Timer? _refreshTimer;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  final Set<String> _loadingContainerIds = {};

  @override
  void initState() {
    super.initState();
    _refreshContainers();
    _refreshTimer = Timer.periodic(const Duration(seconds: 3), (_) => _refreshContainers(silent: true));
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refreshContainers({bool silent = false}) async {
    if (!silent) {
        setState(() => _isLoading = true);
    }
    try {
      final data = await _apiService.getContainers();
      final list = data.map((json) => ContainerModel.fromJson(json)).toList();
      if (mounted) {
        setState(() {
          _containers = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error fetching containers: $e');
      if (mounted && !silent) {
         setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleAction(String id, String action, String containerName) async {
    // Dismiss sheet if open (for long press) logic handled by caller usually, but good to ensure.
    // However when using ModalBottomSheet, selecting an item usually closes it if we pop.
    
    setState(() {
      _loadingContainerIds.add(id);
    });

    String? errorMessage;
    bool success = false;

    try {
      if (action == 'start') await _apiService.startContainer(id);
      if (action == 'stop') await _apiService.stopContainer(id);
      if (action == 'restart') await _apiService.restartContainer(id);
      if (action == 'duplicate') await _apiService.duplicateContainer(id);
      if (action == 'delete') {
        if (mounted) {
          await showConfirmationDialog(
            context: context,
            title: 'Delete Container',
            content: 'Are you sure you want to delete "$containerName"? This action cannot be undone.',
            onConfirm: () async {
              setState(() {
                _loadingContainerIds.add(id);
              });

              String? deleteError;

              try {
                await _apiService.deleteContainer(id);
              } catch (e) {
                deleteError = e.toString();
              }

              // 1. Stop Loading
              if (mounted) {
                 setState(() {
                   _loadingContainerIds.remove(id);
                 });
              }

              // 2. Refresh List
              await _refreshContainers();

              // 3. Notification
              if (mounted) {
                if (deleteError != null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Error: $deleteError'),
                      backgroundColor: Colors.redAccent,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Delete action completed successfully'),
                      backgroundColor: Color(0xFF00E676),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              }
            },
          );
        }
        // If dialog cancelled, we need to remove the initial loading added at top of function
        // But the dialog itself is async. If we return here, we need to know if dialog was cancelled?
        // showConfirmationDialog runs onConfirm if confirmed.
        // If simply cancelled, onConfirm not run.
        // So we should remove loading state if we are here?
        // Wait, I added loading at start of function.
        // But showConfirmationDialog is awaited.
        // If I move the initial loading add inside onConfirm for delete, it's safer.
        // But user sees loading immediately?
        // No, current flow: User clicks Delete -> Dialog -> Confirm -> Loading -> API.
        // So I should NOT add loading at start of function for 'delete' case, OR remove it while dialog is open?
        // Actually, for delete, I should rely on onConfirm.
        
        // Let's fix the initial loading add.
        if (mounted) {
           setState(() {
             _loadingContainerIds.remove(id); 
           });
        }
        return; 
      }
      
      if (action == 'logs') {
        setState(() {
          _loadingContainerIds.remove(id);
        });
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
      
      success = true;

    } catch (e) {
      errorMessage = e.toString();
    }
    
    // 1. Stop Loading state
    if (mounted) {
      setState(() {
        _loadingContainerIds.remove(id);
      });
    }

    // 2. Refresh List
    if (action != 'delete' && action != 'logs') {
        await _refreshContainers(silent: true);
    }

    // 3. Notification
    if (containerName.isNotEmpty && action != 'delete' && action != 'logs' && mounted) {
       if (errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $errorMessage'),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
       } else if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Action $action completed successfully'),
            backgroundColor: const Color(0xFF00E676),
            behavior: SnackBarBehavior.floating,
          ),
        );
       }
    }
  }

  void _showContainerActions(ContainerModel container) {
      final isRunning = container.state == 'running';
      showModalBottomSheet(
        context: context,
        backgroundColor: const Color(0xFF1E1E1E),
        shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
        builder: (context) {
          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                    title: Text(container.names.isNotEmpty ? container.names[0].replaceAll('/', '') : container.id.substring(0, 12),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
                const Divider(color: Colors.white24),
                if (!isRunning)
                ListTile(
                  leading: const Icon(Icons.play_arrow, color: Color(0xFF00E676)),
                  title: const Text('Start', style: TextStyle(color: Colors.white)),
                  onTap: () { Navigator.pop(context); _handleAction(container.id, 'start', container.names.first); },
                ),
                if (isRunning)
                ListTile(
                  leading: const Icon(Icons.stop, color: Color(0xFFFF5252)),
                  title: const Text('Stop', style: TextStyle(color: Colors.white)),
                  onTap: () { Navigator.pop(context); _handleAction(container.id, 'stop', container.names.first); },
                ),
                ListTile(
                  leading: const Icon(Icons.refresh, color: Colors.orangeAccent),
                  title: const Text('Restart', style: TextStyle(color: Colors.white)),
                  onTap: () { Navigator.pop(context); _handleAction(container.id, 'restart', container.names.first); },
                ),
                ListTile(
                  leading: const Icon(Icons.copy, color: Colors.blueAccent),
                  title: const Text('Duplicate', style: TextStyle(color: Colors.white)),
                  onTap: () { Navigator.pop(context); _handleAction(container.id, 'duplicate', container.names.first); },
                ),
                ListTile(
                  leading: const Icon(Icons.terminal, color: Colors.white70),
                  title: const Text('Logs', style: TextStyle(color: Colors.white)),
                  onTap: () { Navigator.pop(context); _handleAction(container.id, 'logs', container.names.first); },
                ),
                ListTile(
                  leading: const Icon(Icons.delete, color: Colors.redAccent),
                  title: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
                  onTap: () { Navigator.pop(context); _handleAction(container.id, 'delete', container.names.first); },
                ),
                const SizedBox(height: 8),
              ],
            ),
          );
        },
      );
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
      actions: [
        IconButton(
          icon: const Icon(Icons.add, color: Color(0xFF00E5FF)),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const CreateContainerScreen()),
            ).then((value) {
               if (value == true) _refreshContainers();
            });
          },
        ),
      ],
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
            child: _isLoading && _containers.isEmpty 
              ? const Center(child: SquareScalingSpinner(color: Color(0xFF00E5FF)))
              : _containers.isEmpty 
                   ? const Center(child: Text('No containers found', style: TextStyle(color: Colors.white54)))
                   : Builder(builder: (context) {
                          final containers = _containers.where((container) {
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
                               return const Center(child: Text('No matching containers', style: TextStyle(color: Colors.white54)));
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
                            ).then((_) => _refreshContainers(silent: true));
                          },
                          onLongPress: () => _showContainerActions(container),
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
                                        ).withValues(alpha: 0.4),
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
                                if (_loadingContainerIds.contains(container.id))
                                   const Padding(
                                     padding: EdgeInsets.only(left: 16.0),
                                     child: SquareScalingSpinner(size: 30, color: Color(0xFF00E5FF)),
                                   ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                );
            }),
          ),
        ],
      ),
    );
  }
}
