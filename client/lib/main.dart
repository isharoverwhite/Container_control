import 'package:flutter/material.dart';
import 'screens/home_screen.dart';
import 'services/notification_service.dart';
import 'services/api_service.dart';

import 'services/server_manager.dart';
import 'screens/onboarding_screen.dart';
import 'screens/welcome_screen.dart';
import 'dart:io';
import 'widgets/global_pull_progress_widget.dart';
import 'services/pull_progress_service.dart';

class DevHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) => true;
  }
}

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> rootScaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  HttpOverrides.global = DevHttpOverrides();
  await ServerManager().init();
  await NotificationService().init();
  runApp(const MyApp());
}


class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  late final ApiService _apiService;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _apiService = ApiService();
    PullProgressService().init();
    _setupSocketListener();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _apiService.socket.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      print('MyApp: App resumed, ensuring socket connection...');
      // Add slight delay to allow network stack to wake up
      Future.delayed(const Duration(milliseconds: 500), () {
        if (!_apiService.socket.connected) {
           _apiService.socket.connect();
        }
      });
    }
  }

  void _setupSocketListener() {
    // Ensure socket is connected or connects
    _apiService.socket.on('action_status', (data) {
      final type = data['type'];
      final message = data['message'];

      if (rootScaffoldMessengerKey.currentState != null) {
        rootScaffoldMessengerKey.currentState!.showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: type == 'error' ? Colors.redAccent : const Color(0xFF00E676),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });

    _apiService.socket.on('force_logout', (_) async {
      await ServerManager().removeActiveServer();

      rootScaffoldMessengerKey.currentState?.showSnackBar(
        const SnackBar(
          content: Text('Device disconnected by Admin'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );

      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(builder: (context) => const WelcomeScreen()),
        (route) => false,
      );
    });
  }

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: rootScaffoldMessengerKey,
      title: 'Container Control',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A0A0A),
        primaryColor: const Color(0xFF00E5FF),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00E5FF),
          secondary: Color(0xFF2979FF),
          surface: Color(0xFF1E1E1E),
          background: Color(0xFF0A0A0A),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1E1E1E),
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0A0A0A),
          elevation: 0,
          centerTitle: true,
          titleTextStyle: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        useMaterial3: true,
      ),
      home: const WelcomeScreen(),
      builder: (context, child) {
        return Stack(
          children: [
            child!,
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: const GlobalPullProgressWidget(),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
