import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import '../services/server_manager.dart';
import '../models/server_config.dart';
import 'home_screen.dart';
import '../widgets/whale_ship_animation.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController(text: '');
  final _hostController = TextEditingController(text: '');
  final _apiKeyController = TextEditingController();
  
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _hostController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      String host = _hostController.text.trim();
      // Remove trailing slashes
      while (host.endsWith('/')) {
        host = host.substring(0, host.length - 1);
      }
      
      String connectionUrl = host;
      // Handle scheme
      if (!connectionUrl.startsWith('http://') && !connectionUrl.startsWith('https://')) {
        // Default to https if not specified, or try both?
        // User asked for encrypted protocol, so prefer https.
        // But since we are self-signed, we might need to handle http fallback or force https.
        // Let's assume the user enters ip:port.
        connectionUrl = 'https://$connectionUrl';
      }

      // Format URL
      final url = Uri.parse('$connectionUrl/api/system/info');
      
      final response = await http.get(
        url,
        headers: {
          'x-secret-key': _apiKeyController.text.trim(),
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        // Success
        final config = ServerConfig(
          name: _nameController.text.trim(),
          ip: host, // Save cleaned host
          apiKey: _apiKeyController.text.trim(),
        );

        await ServerManager().addServer(config);
        
        if (mounted) {
           Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
          );
        }
      } else if (response.statusCode == 403) {
        throw Exception('Invalid Secret Key');
      } else {
        throw Exception('Connection failed: ${response.statusCode}');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          // Friendly error
          if (_error!.contains('Connection refused')) {
            _error = 'Could not connect to server. Check IP and Port.';
          } else if (_error!.contains('ClientException')) {
             _error = 'Connection failed. Ensure server is running and HTTPS is enabled.';
          }
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const WhaleShipAnimation(),
                  const SizedBox(height: 24),
                  Text(
                    'Connect to Server',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Enter your server details. Communication is encrypted.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.grey,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),
                  
                  // Server Name
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Server Name',
                      prefixIcon: Icon(Icons.label_outline),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => v?.isEmpty == true ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),

                  // Host
                  TextFormField(
                    controller: _hostController,
                    decoration: const InputDecoration(
                      labelText: 'Host (Domain or IP:Port)',
                      prefixIcon: Icon(Icons.dns),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => v?.isEmpty == true ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),

                  // Secret Key
                  TextFormField(
                    controller: _apiKeyController,
                    decoration: const InputDecoration(
                      labelText: 'Secret Key',
                      prefixIcon: Icon(Icons.vpn_key),
                      border: OutlineInputBorder(),
                    ),
                    obscureText: true,
                    validator: (v) => v?.isEmpty == true ? 'Required' : null,
                  ),
                  
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _error!,
                      style: const TextStyle(color: Colors.redAccent),
                      textAlign: TextAlign.center,
                    ),
                  ],

                  const SizedBox(height: 32),
                  
                  FilledButton(
                    onPressed: _isLoading ? null : _connect,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: const Color(0xFF00E5FF),
                      foregroundColor: Colors.black,
                    ),
                    child: _isLoading 
                      ? const SizedBox(
                          height: 20, 
                          width: 20, 
                          child: CircularProgressIndicator(strokeWidth: 2)
                        )
                      : const Text('Connect'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
