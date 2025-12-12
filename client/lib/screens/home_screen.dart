import 'package:flutter/material.dart';
import 'containers_screen.dart';
import 'images_screen.dart';
import 'volumes_screen.dart';
import 'stacks_screen.dart';

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
  ];

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
                      icon: Icon(Icons.album),
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
            bottomNavigationBar: BottomNavigationBar(
              items: const <BottomNavigationBarItem>[
                BottomNavigationBarItem(
                  icon: Icon(Icons.apps),
                  label: 'Containers',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.album),
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
              ],
              currentIndex: _selectedIndex,
              selectedItemColor: const Color(0xFF00E5FF),
              unselectedItemColor: Colors.white54,
              backgroundColor: const Color(0xFF0A0A0A),
              type: BottomNavigationBarType.fixed,
              onTap: _onItemTapped,
            ),
          );
        }
      },
    );
  }
}
