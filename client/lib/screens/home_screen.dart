import 'package:flutter/material.dart';
import 'containers_screen.dart';
import 'images_screen.dart';
import 'volumes_screen.dart';
import 'stacks_screen.dart';
import 'server_status_screen.dart';
import '../widgets/animated_bottom_navbar.dart';
import '../services/server_manager.dart';
import '../services/api_service.dart';
import '../models/server_config.dart';
import 'onboarding_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  static const List<Widget> _widgetOptions = <Widget>[
    ContainersScreen(),
    ImagesScreen(),
    VolumesScreen(),
    StacksScreen(),
    ServerStatusScreen(),
  ];

  @override
  void initState() {
    super.initState();
    ServerManager().onServerChanged = () {
        if (mounted) setState(() {
             // Rebuild to refresh screens that might depend on active server
        });
        // Also re-init socket
        ApiService().initSocket();
    };
  }

  Future<void> _showServerListDialog() async {
    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
            builder: (context, setState) {
                final servers = ServerManager().servers;
                final active = ServerManager().activeServer;
                
                return AlertDialog(
                    backgroundColor: const Color(0xFF1E1E1E),
                    title: Row(
                        children: [
                            const Text('Manage Servers', style: TextStyle(color: Colors.white)),
                            const Spacer(),
                            IconButton(
                                icon: const Icon(Icons.add, color: Color(0xFF00E5FF)),
                                onPressed: () {
                                    Navigator.pop(context);
                                    _showAddServerDialog();
                                },
                            )
                        ],
                    ),
                    content: SizedBox(
                        width: double.maxFinite,
                        height: 300,
                        child: servers.isEmpty 
                            ? const Center(child: Text('No servers added', style: TextStyle(color: Colors.white54))) 
                            : ListView.builder(
                                itemCount: servers.length,
                                itemBuilder: (context, index) {
                                  final s = servers[index];
                                  final isActive = active == s;
                                  return ListTile(
                                        title: Text(s.name, style: const TextStyle(color: Colors.white)),
                                        subtitle: Text(s.ip, style: const TextStyle(color: Colors.white54)),
                                        leading: Icon(
                                            isActive ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                                            color: isActive ?  const Color(0xFF00E5FF) : Colors.white24,
                                        ),
                                        trailing: IconButton(
                                            icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                                            onPressed: () async {
                                                await ServerManager().removeServer(s);
                                                setState(() {}); // Refresh dialog
                                                
                                                if (ServerManager().servers.isEmpty) {
                                                     if (context.mounted) Navigator.pop(context); // Close dialog
                                                     if (context.mounted) {
                                                         Navigator.of(context).pushReplacement(
                                                            MaterialPageRoute(builder: (_) => const OnboardingScreen()),
                                                         );
                                                     }
                                                }
                                            },
                                        ),
                                        onTap: () async {
                                            await ServerManager().setActiveServer(s);
                                            setState(() {});
                                            if (context.mounted) Navigator.pop(context);
                                        },
                                  );
                                },
                            ),
                    ),
                    actions: [
                        TextButton(
                            child: const Text('Close'),
                            onPressed: () => Navigator.pop(context),
                        ),
                    ],
                );
            }
        );
      },
    );
  }

  Future<void> _showAddServerDialog() async {
      final nameController = TextEditingController();
      final ipController = TextEditingController();
      final keyController = TextEditingController();
      
      await showDialog(
          context: context,
          builder: (context) {
              return AlertDialog(
                  backgroundColor: const Color(0xFF1E1E1E),
                  title: const Text('Add Server', style: TextStyle(color: Colors.white)),
                  content: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                          TextField(
                              controller: nameController,
                              style: const TextStyle(color: Colors.white),
                              decoration: const InputDecoration(labelText: 'Server Name', labelStyle: TextStyle(color: Colors.white54)),
                          ),
                          TextField(
                              controller: ipController,
                              style: const TextStyle(color: Colors.white),
                              decoration: const InputDecoration(labelText: 'IP:Port (e.g. 192.168.1.5:3000)', hintText: '192.168.1.5:3000', labelStyle: TextStyle(color: Colors.white54)),
                          ),
                          TextField(
                              controller: keyController,
                              style: const TextStyle(color: Colors.white),
                              decoration: const InputDecoration(labelText: 'API Key (>= 12 chars)', labelStyle: TextStyle(color: Colors.white54)),
                          ),
                      ],
                  ),
                  actions: [
                      TextButton(
                          child: const Text('Cancel'),
                          onPressed: () => Navigator.pop(context),
                      ),
                      ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00E5FF)),
                          child: const Text('Add', style: TextStyle(color: Colors.black)),
                          onPressed: () async {
                              final name = nameController.text.trim();
                              final ip = ipController.text.trim();
                              final key = keyController.text.trim();
                              
                              if (name.isEmpty || ip.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Name and IP required')));
                                  return;
                              }
                              if (key.length < 12) {
                                   ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Key must be at least 12 characters')));
                                  return;
                              }
                              
                              await ServerManager().addServer(ServerConfig(name: name, ip: ip, apiKey: key));
                              if (context.mounted) Navigator.pop(context);
                          },
                      ),
                  ],
              );
          }
      );
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth > 800) {
          // Desktop / Wide Screen -> Sidebar
          return Scaffold(
            body: Row(
              children: [
                NavigationRail(
                  selectedIndex: _selectedIndex,
                  onDestinationSelected: _onItemTapped,
                  backgroundColor: const Color(0xFF0A0A0A),
                  indicatorColor: const Color(0xFF00E5FF).withOpacity(0.2),
                  selectedIconTheme: const IconThemeData(
                    color: Color(0xFF00E5FF),
                  ),
                  unselectedIconTheme: const IconThemeData(
                    color: Colors.white54,
                  ),
                  selectedLabelTextStyle: const TextStyle(
                    color: Color(0xFF00E5FF),
                    fontWeight: FontWeight.bold,
                  ),
                  unselectedLabelTextStyle: const TextStyle(
                    color: Colors.white54,
                  ),
                  labelType: NavigationRailLabelType.all,
                  destinations: const [
                    NavigationRailDestination(
                      icon: Icon(Icons.apps),
                      label: Text('Containers'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.inventory_2),
                      label: Text('Images'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.storage),
                      label: Text('Volumes'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.layers),
                      label: Text('Stacks'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.dns),
                      label: Text('Servers'),
                    ),
                  ],
                ),
                const VerticalDivider(
                  thickness: 1,
                  width: 1,
                  color: Colors.white10,
                ),
                Expanded(child: _widgetOptions.elementAt(_selectedIndex)),
              ],
            ),
          );
        } else {
          // Mobile / Narrow Screen -> Bottom Nav
          return Scaffold(
            body: _widgetOptions.elementAt(_selectedIndex),
            bottomNavigationBar: AnimatedBottomNavBar(
              items: const <BottomNavigationBarItem>[
                BottomNavigationBarItem(
                  icon: Icon(Icons.apps),
                  label: 'Containers',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.inventory_2),
                  label: 'Images',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.storage),
                  label: 'Volumes',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.layers),
                  label: 'Stacks',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.dns),
                  label: 'Servers',
                ),
              ],
              currentIndex: _selectedIndex,
              selectedItemColor: const Color(0xFF00E5FF),
              unselectedItemColor: Colors.white54,
              backgroundColor: const Color(0xFF0A0A0A),
              onTap: _onItemTapped,
              onLongPress: (index) {
                if (index == 4) { // Server Icon Index
                   _showServerListDialog();
                }
              },
            ),
          );
        }
      },
    );
  }
}
