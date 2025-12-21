import 'package:flutter/material.dart';

class AnimatedBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<BottomNavigationBarItem> items;
  final Color? backgroundColor;
  final Color? selectedItemColor;
  final Color? unselectedItemColor;
  final Function(int)? onLongPress;

  const AnimatedBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
    this.backgroundColor,
    this.selectedItemColor,
    this.unselectedItemColor,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bgColor = backgroundColor ?? theme.scaffoldBackgroundColor;
    final selColor = selectedItemColor ?? theme.primaryColor;
    final unselColor = unselectedItemColor ?? Colors.white54;
    final width = MediaQuery.of(context).size.width;
    final count = items.length;
    final itemWidth = width / count;

    return Container(
      color: bgColor,
      height: kBottomNavigationBarHeight + MediaQuery.of(context).padding.bottom,
      child: Stack(
        children: [
          // Items
          Row(
            children: List.generate(count, (index) {
              final item = items[index];
              final isSelected = index == currentIndex;
              return Expanded(
                child: InkWell(
                  onTap: () => onTap(index),
                  onLongPress: () => onLongPress?.call(index),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconTheme(
                        data: IconThemeData(
                          color: isSelected ? selColor : unselColor,
                        ),
                        child: item.icon,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.label ?? '',
                        style: TextStyle(
                          color: isSelected ? selColor : unselColor,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
          // Moving Indicator
          AnimatedPositioned(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOutCubic,
            left: itemWidth * currentIndex,
            bottom: 0,
            child: Container(
              width: itemWidth,
              height: 4, // Height of the indicator bar
              alignment: Alignment.center,
              child: Container(
                width: 40, // Width of the actual colored bar (centered)
                height: 4,
                decoration: BoxDecoration(
                  color: selColor,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                   boxShadow: [
                    BoxShadow(
                      color: selColor.withOpacity(0.4),
                      blurRadius: 6,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
