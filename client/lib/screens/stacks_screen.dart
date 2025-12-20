import 'package:flutter/material.dart';
import '../../widgets/square_scaling_spinner.dart';
import '../services/api_service.dart';
import '../services/api_service.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/confirmation_dialog.dart';

class StacksScreen extends StatefulWidget {
  const StacksScreen({super.key});

  @override
  State<StacksScreen> createState() => _StacksScreenState();
}

class _StacksScreenState extends State<StacksScreen> {
  final ApiService _apiService = ApiService();
  late Future<List<dynamic>> _stacksFuture;

  @override
  void initState() {
    super.initState();
    _refreshStacks();
  }

  void _refreshStacks() {
    setState(() {
      _stacksFuture = _apiService.getStacks();
    });
  }

  Future<void> _handleStackAction(String name, String action) async {
    if (action == 'remove') {
      if (!mounted) return;
      await showConfirmationDialog(
        context: context,
        title: 'Delete Stack',
        content: 'Are you sure you want to delete this stack? This action cannot be undone.',
        onConfirm: () async {
            await _performStackAction(name, action);
        },
      );
    } else {
      await _performStackAction(name, action);
    }
  }

  Future<void> _performStackAction(String name, String action) async {
    try {
      await _apiService.controlStack(name, action);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
             SnackBar(content: Text('Stack $action triggered')),
          );
        }
      _refreshStacks();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  void _showCreateDialog() {
    final nameController = TextEditingController();
    final contentController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          backgroundColor: const Color(0xFF1E1E1E),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Container(
            width: 600, // wider on desktop
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Create Stack',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: nameController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Stack Name',
                    labelStyle: TextStyle(color: Colors.white54),
                    border: OutlineInputBorder(),
                    enabledBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: Colors.white24),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: contentController,
                  style: const TextStyle(
                    color: Colors.white,
                    fontFamily: 'monospace',
                  ),
                  maxLines: 10,
                  decoration: const InputDecoration(
                    labelText: 'Docker Compose Content',
                    alignLabelWithHint: true,
                    labelStyle: TextStyle(color: Colors.white54),
                    border: OutlineInputBorder(),
                    enabledBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: Colors.white24),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 16),
                    ElevatedButton(
                      onPressed: () async {
                        try {
                          await _apiService.createStack(
                            nameController.text,
                            contentController.text,
                          );
                          if (context.mounted) {
                            Navigator.pop(context);
                            _refreshStacks();
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Error: $e')),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00E5FF),
                        foregroundColor: Colors.black,
                      ),
                      child: const Text('Deploy'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ResponsiveLayout(
      showHeader: true,
      title: 'Stacks',
      actions: [
        IconButton(
          icon: const Icon(Icons.add, color: Color(0xFF00E5FF)),
          onPressed: _showCreateDialog,
        ),
      ],
      child: FutureBuilder<List<dynamic>>(
        future: _stacksFuture,
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
                'No stacks found',
                style: TextStyle(color: Colors.white54),
              ),
            );
          }

          final stacks = snapshot.data!;
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: stacks.length,
            itemBuilder: (context, index) {
              final stack = stacks[index];
              final name = stack['Name'];
              final status =
                  stack['Status'] ??
                  'Unknown'; // Note: status might need backend support if not available

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.purpleAccent.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.layers_outlined,
                      color: Colors.purpleAccent,
                    ),
                  ),
                  title: Text(
                    name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  // subtitle: Text(status, style: TextStyle(color: Colors.white38)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(
                          Icons.play_arrow,
                          color: Colors.greenAccent,
                        ),
                        onPressed: () => _handleStackAction(name, 'up'),
                        tooltip: 'Up',
                      ),
                      IconButton(
                        icon: const Icon(Icons.stop, color: Colors.redAccent),
                        onPressed: () => _handleStackAction(name, 'down'),
                        tooltip: 'Down',
                      ),
                      IconButton(
                        icon: const Icon(
                          Icons.delete_outline,
                          color: Colors.white24,
                        ),
                        onPressed: () => _handleStackAction(name, 'remove'),
                        tooltip: 'Remove',
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
