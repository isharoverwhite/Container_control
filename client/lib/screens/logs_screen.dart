import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../widgets/responsive_layout.dart';
import '../services/api_service.dart';
import '../../widgets/square_scaling_spinner.dart';

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
    print('LogsScreen: initState for container ${widget.containerId}');
    _connectSocket();
  }

  void _connectSocket() {
    socket = _apiService.socket;

    // Register log listener first
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

    // Subscribe to logs for this container
    print('LogsScreen: Subscribing to logs for ${widget.containerId}');
    socket.emit('subscribe_logs', widget.containerId);
    
    // Also subscribe on reconnect
    socket.onConnect((_) {
      print('LogsScreen: Socket connected, resubscribing to logs');
      socket.emit('subscribe_logs', widget.containerId);
    });

    socket.onDisconnect((_) => print('LogsScreen: Socket disconnected'));
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
    // Don't disconnect the socket - it's a singleton shared across all screens
    // Just unsubscribe from logs for this container
    socket.emit('unsubscribe_logs', widget.containerId);
    socket.off('log_chunk'); // Remove this screen's listener
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
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SquareScalingSpinner(size: 40, color: Color(0xFF00E5FF)),
                    SizedBox(height: 16),
                    Text(
                      'Waiting for logs...',
                      style: TextStyle(color: Colors.white54, fontSize: 14),
                    ),
                  ],
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
