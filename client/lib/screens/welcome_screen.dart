import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/server_manager.dart';
import 'home_screen.dart';
import 'onboarding_screen.dart';
import '../widgets/whale_ship_animation.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  @override
  void initState() {
    super.initState();
    _navigateNext();
  }

  Future<void> _navigateNext() async {
    // Wait for animation and loading
    await Future.delayed(const Duration(seconds: 4));

    if (!mounted) return;

    final hasServers = ServerManager().servers.isNotEmpty;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            hasServers ? const HomeScreen() : const OnboardingScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 1000),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: Stack(
        children: [
          // Background Glow
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.3),
                  radius: 1.2,
                  colors: [
                    const Color(0xFF00E5FF).withOpacity(0.12),
                    const Color(0xFF0A0A0A),
                  ],
                  stops: const [0.0, 0.7],
                ),
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 3),
                // Hero Animation
                const WhaleShipAnimation(),
                const SizedBox(height: 60),

                // App Title
                Text(
                  'Container Control',
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: 1.0,
                        shadows: [
                          BoxShadow(
                            color: const Color(0xFF00E5FF).withOpacity(0.5),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                  textAlign: TextAlign.center,
                )
                    .animate()
                    .fadeIn(duration: 800.ms, delay: 300.ms)
                    .moveY(begin: 20, end: 0, curve: Curves.easeOut),

                const SizedBox(height: 16),

                // Subtitle
                Text(
                  'Manage your Docker environment',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white70,
                        fontWeight: FontWeight.w300,
                        letterSpacing: 0.5,
                      ),
                )
                    .animate()
                    .fadeIn(duration: 800.ms, delay: 600.ms)
                    .moveY(begin: 20, end: 0, curve: Curves.easeOut),

                const Spacer(flex: 2),

                // Loading Bar
                SizedBox(
                  width: 140,
                  child: Column(
                    children: [
                      LinearProgressIndicator(
                        backgroundColor: Colors.white10,
                        color: const Color(0xFF00E5FF),
                        minHeight: 2,
                        borderRadius: BorderRadius.circular(2),
                      ).animate().fadeIn(delay: 1000.ms),
                      const SizedBox(height: 12),
                      const Text(
                        'Loading resources...',
                        style: TextStyle(color: Colors.white38, fontSize: 10),
                      ).animate().fadeIn(delay: 1100.ms),
                    ],
                  ),
                ),

                const Spacer(flex: 1),
                
                // Credits
                Text(
                        'Made by Experience ❤️',
                        style: TextStyle(
                          color: Colors.white24,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      )
                      .animate()
                      .fadeIn(delay: 1500.ms),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
