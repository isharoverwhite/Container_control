import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class WhaleShipAnimation extends StatelessWidget {
  const WhaleShipAnimation({super.key});

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF00E5FF);
    
    // Animate the ship hull bobbing
    final shipAnimation = const SizedBox.shrink()
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .moveY(begin: 0, end: 6, duration: 2500.ms, curve: Curves.easeInOutSine);

    return SizedBox(
      height: 220,
      width: 220,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Water (Bottom Layer)
          Positioned(
            bottom: 25,
            child: Container(
              width: 180,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.blueAccent.withOpacity(0.5),
                borderRadius: BorderRadius.circular(2),
                 boxShadow: [
                    BoxShadow(color: Colors.blueAccent.withOpacity(0.5), blurRadius: 10, spreadRadius: 2)
                 ]
              ),
            ).animate(onPlay: (c) => c.repeat())
             .shimmer(duration: 1500.ms, color: Colors.blue),
          ),

          // 2. The Ship (Hull + Containers)
          // We wrap them in a stack that bobs up and down together after containers land?
          // For simplicity, we animate the Hull bobbing, and the containers will need to match the final position
          // OR we just animate the visual elements.
          
          // Ship Hull
          Positioned(
            bottom: 40,
            child: CustomPaint(
              size: const Size(140, 45),
              painter: ShipHullPainter(color: Colors.white.withOpacity(0.9)),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .moveY(begin: 0, end: 5, duration: 2000.ms, curve: Curves.easeInOut),
          ),

          // Stacking Containers
          // We position them relative to the ship deck (which is at bottom + 40 + 45 = 85)
          // Adjusting for the bobbing: It's hard to sync separate animations perfectly if one is looping and one is one-shot.
          // However, for the intro, likely the ship is relatively stable or we accept slight drift.
          // Better: The containers slide into the "Ship" group.
          
          // Bottom Container
          Positioned(
            bottom: 82, // Deck level roughly
            child: _buildContainerBox(primaryColor)
                .animate(onPlay: (c) => c.repeat(reverse: true)) // Sync bobbing
                .moveY(begin: 0, end: 5, duration: 2000.ms, curve: Curves.easeInOut) // Match ship bob
                .animate() // One-shot entrance
                .slideY(begin: -2, end: 0, duration: 600.ms, curve: Curves.bounceOut, delay: 500.ms)
                .fadeIn(),
          ),
          // Middle Container
          Positioned(
             bottom: 102, 
             child: _buildContainerBox(primaryColor.withOpacity(0.8))
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .moveY(begin: 0, end: 5, duration: 2000.ms, curve: Curves.easeInOut)
                .animate()
                .slideY(begin: -2, end: 0, duration: 600.ms, curve: Curves.bounceOut, delay: 800.ms)
                .fadeIn(),
          ),
          // Top Container
          Positioned(
             bottom: 122, 
             child: _buildContainerBox(primaryColor.withOpacity(0.6))
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .moveY(begin: 0, end: 5, duration: 2000.ms, curve: Curves.easeInOut)
                .animate()
                .slideY(begin: -2, end: 0, duration: 600.ms, curve: Curves.bounceOut, delay: 1100.ms)
                .fadeIn(),
          ),
          
          // Signal Waves (WiFi) - originating from the ship bridge/tower
          // Let's assume bridge is on the right side of the hull
           // Signal Waves (WiFi) - originating from the ship bridge (now on Left)
           Positioned(
             left: 55, // Adjusted for new bridge position
             bottom: 90,
             child: Transform.rotate(
               angle: 0.5, // Rotate opposite way or keep? Signal usually goes up/out.
               child: const Icon(Icons.wifi, color: primaryColor, size: 30)
             ).animate(onPlay: (c) => c.repeat())
              .fadeIn(duration: 1000.ms)
              .fadeOut(delay: 1000.ms, duration: 1000.ms)
              .moveY(begin: 0, end: 5, duration: 2000.ms, curve: Curves.easeInOut), // Sync bob
           ),
        ],
      ),
    );
  }

  Widget _buildContainerBox(Color color) {
    return Container(
      width: 50,
      height: 18,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(2),
        border: Border.all(color: Colors.white24, width: 1),
      ),
    );
  }
}

class ShipHullPainter extends CustomPainter {
  final Color color;
  ShipHullPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path();
    
    // Side view of a container ship
    //      ____________________ (Deck)
    //     /                    | (Bridge/Stern)
    //    /                      \
    //   /________________________\ (Bottom)
    
    final w = size.width;
    final h = size.height;

    // Draw Ship Hull (Bow on Right, Stern on Left)
    path.moveTo(0, 0); // Top Left (Stern Top)
    path.lineTo(w, 0); // Top Right (Bow Top)
    path.lineTo(w * 0.85, h); // Bow Bottom (Angled in)
    path.lineTo(w * 0.1, h); // Stern Bottom (Slight angle)
    path.close();

    // Bridge on the Stern (Left Side)
    final bridgePath = Path();
    bridgePath.moveTo(w * 0.05, 0);
    bridgePath.lineTo(w * 0.05, -15);
    bridgePath.lineTo(w * 0.25, -15);
    bridgePath.lineTo(w * 0.25, 0);
    bridgePath.close();

    canvas.drawPath(path, paint);
    canvas.drawPath(bridgePath, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
