import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../widgets/responsive_layout.dart';
import '../services/api_service.dart';

class LogsScreen extends StatefulWidget {
  final String containerId;

  const LogsScreen({super.key, required this.containerId});

  @override
  State<LogsScreen> createState() => _LogsScreenState();
}

class _LogsScreenState extends State<LogsScreen> {
  final ApiService _apiService = ApiService();
  late IO.Socket socket;
  final ScrollController _scrollController = ScrollController();
  final List<String> _logs = [];

  @override
  void initState() {
    super.initState();
    _connectSocket();
  }

  void _connectSocket() {
    // Use ApiService's socket as it already has correct config/headers/auth
    // But we need to make sure we don't mess up other listeners if shared.
    // ApiService creates a NEW socket instance in constructor, so it's safe to use this instance for this screen.
    socket = _apiService.socket;

    socket.onConnect((_) {
      print('Connected to socket');
      socket.emit('subscribe_logs', widget.containerId);
    });

    socket.on('log_chunk', (data) {
      if (mounted) {
        setState(() {
          // data is expected to be { containerId, chunk }
          if (data is Map && data['chunk'] != null) {
               _logs.add(data['chunk'].toString());
          } else {
               _logs.add(data.toString());
          }
        });
        _scrollToBottom();
      }
    });

    socket.onDisconnect((_) => print('Disconnected from socket'));
    
    if (!socket.connected) {
        socket.connect();
    } else {
        // If already connected (reused), emit immediately
        socket.emit('subscribe_logs', widget.containerId);
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    socket.disconnect();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ResponsiveLayout(
      showHeader: true,
      title: 'Container Logs',
      actions: [
        IconButton(
          icon: const Icon(Icons.delete_outline, color: Colors.white54),
          onPressed: () {
            setState(() {
              _logs.clear();
            });
          },
          tooltip: 'Clear Logs',
        ),
      ],
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF151515),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        child: _logs.isEmpty
            ? const Center(
                child: Text(
                  'Waiting for logs...',
                  style: TextStyle(color: Colors.white24),
                ),
              )
            : ListView.builder(
                controller: _scrollController,
                itemCount: _logs.length,
                itemBuilder: (context, index) {
                  return SelectableText(
                    _logs[index],
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: Color(0xFFCCCCCC),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
