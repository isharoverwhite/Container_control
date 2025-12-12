import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../widgets/responsive_layout.dart';

class VolumesScreen extends StatefulWidget {
  const VolumesScreen({super.key});

  @override
  State<VolumesScreen> createState() => _VolumesScreenState();
}

class _VolumesScreenState extends State<VolumesScreen> {
  final ApiService _apiService = ApiService();
  late Future<List<dynamic>> _volumesFuture;

  @override
  void initState() {
    super.initState();
    _refreshVolumes();
  }

  void _refreshVolumes() {
    setState(() {
      _volumesFuture = _apiService.getVolumes().then((data) {
        if (data is List) {
          return data;
        } else if (data is Map<String, dynamic>) {
          return data['Volumes'] as List<dynamic>? ?? [];
        }
        return [];
      });
    });
  }

  Future<void> _deleteVolume(String name) async {
    try {
      await _apiService.deleteVolume(name);
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Volume deleted')));
      _refreshVolumes();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _showCreateVolumeDialog() async {
    final nameController = TextEditingController();
    final pathController = TextEditingController();
    bool useBindMount = false;

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E1E1E),
              title: const Text(
                'Create Volume',
                style: TextStyle(color: Colors.white),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: nameController,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Volume Name',
                        labelStyle: TextStyle(color: Colors.white54),
                        enabledBorder: UnderlineInputBorder(
                          borderSide: BorderSide(color: Colors.white10),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    CheckboxListTile(
                      title: const Text(
                        'Bind Mount (Custom Path)',
                        style: TextStyle(color: Colors.white),
                      ),
                      value: useBindMount,
                      onChanged: (val) {
                        setState(() => useBindMount = val ?? false);
                      },
                      checkColor: Colors.black,
                      activeColor: const Color(0xFF00E5FF),
                      contentPadding: EdgeInsets.zero,
                    ),
                    if (useBindMount)
                      TextField(
                        controller: pathController,
                        style: const TextStyle(color: Colors.white),
                        decoration: const InputDecoration(
                          labelText: 'Host Path (Absolute)',
                          hintText: '/home/user/data',
                          hintStyle: TextStyle(color: Colors.white24),
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
                  onPressed: () => Navigator.of(context).pop(),
                ),
                TextButton(
                  child: const Text(
                    'Create',
                    style: TextStyle(color: Color(0xFF00E5FF)),
                  ),
                  onPressed: () async {
                    Navigator.of(context).pop();
                    try {
                      Map<String, String>? driverOpts;
                      if (useBindMount && pathController.text.isNotEmpty) {
                        driverOpts = {
                          'type': 'none',
                          'o': 'bind',
                          'device': pathController.text,
                        };
                      }

                      await _apiService.createVolume(
                        name: nameController.text,
                        driver:
                            'local', // Bind mounts use local driver with opts
                        driverOpts: driverOpts,
                      );

                      if (mounted)
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Volume created')),
                        );
                      _refreshVolumes();
                    } catch (e) {
                      if (mounted)
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(SnackBar(content: Text('Error: $e')));
                    }
                  },
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
      title: 'Volumes',
      actions: [
        IconButton(
          icon: const Icon(Icons.add, color: Color(0xFF00E5FF)),
          onPressed: _showCreateVolumeDialog,
          tooltip: 'Create Volume',
        ),
      ],
      child: FutureBuilder<List<dynamic>>(
        future: _volumesFuture,
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
                'No volumes found',
                style: TextStyle(color: Colors.white54),
              ),
            );
          }

          final volumes = snapshot.data!;
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: volumes.length,
            itemBuilder: (context, index) {
              final volume = volumes[index];
              final name = volume['Name'];
              final driver = volume['Driver'];

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
                      color: Colors.orangeAccent.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.storage,
                      color: Colors.orangeAccent,
                    ),
                  ),
                  title: Text(
                    name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    'Driver: $driver',
                    style: const TextStyle(color: Colors.white38),
                  ),
                  trailing: IconButton(
                    icon: const Icon(
                      Icons.delete_outline,
                      color: Colors.redAccent,
                    ),
                    onPressed: () => _deleteVolume(name),
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
