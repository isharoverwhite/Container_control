import 'package:flutter/material.dart';
import '../services/server_manager.dart';
import '../services/api_service.dart';
import '../models/server_config.dart';

class ServerStatusScreen extends StatefulWidget {
  const ServerStatusScreen({super.key});

  @override
  State<ServerStatusScreen> createState() => _ServerStatusScreenState();
}

class _ServerStatusScreenState extends State<ServerStatusScreen> {
  final ApiService _apiService = ApiService();
  Map<String, dynamic>? _systemInfo;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadInfo();
  }

  Future<void> _loadInfo() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final info = await _apiService.getSystemInfo();
      if (mounted) {
        setState(() {
          _systemInfo = info;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final server = ServerManager().activeServer;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: const Text('Server Status'),
        backgroundColor: Colors.transparent,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadInfo,
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildCard(
              title: 'Current Connection',
              children: [
                _buildRow('Name', server?.name ?? 'None'),
                _buildRow('URL', server?.ip ?? 'None'),
                _buildRow('Status', _error != null ? 'Error' : (_loading ? 'Connecting...' : 'Connected')),
                if (server != null && server.apiKey.isNotEmpty)
                  _buildRow('Auth', 'Key Configured'),
              ],
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.redAccent),
                ),
                child: Text(
                  'Connection Error: $_error',
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
            if (_systemInfo != null) ...[
               _buildCard(
                title: 'System Information',
                children: [
                  _buildRow('Mode', _systemInfo!['executionMode'] ?? 'Unknown'),
                  _buildRow('OS', _systemInfo!['OperatingSystem'] ?? 'Unknown'),
                  _buildRow('Kernel', _systemInfo!['KernelVersion'] ?? 'Unknown'),
                  _buildRow('Architecture', _systemInfo!['Architecture'] ?? 'Unknown'),
                  _buildRow('CPUs', '${_systemInfo!['NCPU'] ?? 0}'),
                  _buildRow('Memory', '${((_systemInfo!['MemTotal'] ?? 0) / 1024 / 1024 / 1024).toStringAsFixed(2)} GB'),
                   if (_systemInfo!['gpu'] != null)
                     _buildRow('GPU', '${_systemInfo!['gpu']['vendor']} ${_systemInfo!['gpu']['model']}'),
                ],
              ),
              const SizedBox(height: 16),
              _buildCard(
                title: 'Docker Engine',
                children: [
                   _buildRow('Version', _systemInfo!['ServerVersion'] ?? 'Unknown'),
                   _buildRow('Root Dir', _systemInfo!['DockerRootDir'] ?? 'Unknown'),
                   _buildRow('Containers', '${_systemInfo!['Containers'] ?? 0}'),
                   _buildRow('Running', '${_systemInfo!['ContainersRunning'] ?? 0}'),
                   _buildRow('Images', '${_systemInfo!['Images'] ?? 0}'),
                ],
              ),
            ],
            const SizedBox(height: 32),
            const Center(
              child: Text( 
                'Long press the Server icon in navbar to switch servers',
                style: TextStyle(color: Colors.white38, fontStyle: FontStyle.italic),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard({required String title, required List<Widget> children}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(color: Colors.white54),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}
