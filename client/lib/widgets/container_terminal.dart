import 'package:flutter/material.dart';
import 'package:xterm/xterm.dart';
import '../services/api_service.dart';

class ContainerTerminal extends StatefulWidget {
  final String containerId;
  const ContainerTerminal({super.key, required this.containerId});

  @override
  State<ContainerTerminal> createState() => _ContainerTerminalState();
}

class _ContainerTerminalState extends State<ContainerTerminal> {
  final ApiService _apiService = ApiService();
  late final Terminal _terminal;
  final TerminalController _terminalController = TerminalController();
  
  // Track listeners to remove them properly
  Function(dynamic)? _outputListener;

  @override
  void initState() {
    super.initState();
    _terminal = Terminal();
    
    // Send Input to Server
    _terminal.onOutput = (input) {
       _apiService.socket.emit('exec_input', {
           'containerId': widget.containerId,
           'input': input
       });
    };

    _connect();
  }
  
  void _connect() {
       final socket = _apiService.socket;
       print('Terminal: connecting exec for ${widget.containerId}');
       
       socket.emit('subscribe_exec', widget.containerId);
       
       _outputListener = (data) {
           if (!mounted) return;
           if (data['containerId'] == widget.containerId) {
               _terminal.write(data['data']);
           }
       };

       socket.on('exec_output', _outputListener!);
  }

  @override
  void dispose() {
      final socket = _apiService.socket;
      socket.emit('unsubscribe_exec', widget.containerId);
      
      if (_outputListener != null) {
        socket.off('exec_output', _outputListener);
      }
      
      super.dispose();
  }

  @override
  Widget build(BuildContext context) {
      return Container(
          color: Colors.black,
          padding: const EdgeInsets.all(8),
          child: TerminalView(
              _terminal,
              controller: _terminalController,
              autofocus: true,
              backgroundOpacity: 0,
          )
      );
  }
}
