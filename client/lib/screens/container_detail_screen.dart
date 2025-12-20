import 'dart:async';
import 'package:flutter/material.dart';
import '../../widgets/square_scaling_spinner.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/container_model.dart';
import '../services/api_service.dart';
import '../utils/ansi_parser.dart';

class ContainerDetailScreen extends StatefulWidget {
  final ContainerModel container;
  const ContainerDetailScreen({super.key, required this.container});

  @override
  State<ContainerDetailScreen> createState() => _ContainerDetailScreenState();
}

class _ContainerDetailScreenState extends State<ContainerDetailScreen> {
  final ApiService _apiService = ApiService();
  late IO.Socket socket;
  final List<TextSpan> _logSpans = [];
  final ScrollController _scrollController = ScrollController();
  final String _socketUrl = 'http://localhost:3000';
  Future<Map<String, dynamic>>? _inspectFuture;

  // Uptime Timer
  Timer? _uptimeTimer;
  String _uptimeString = '';
  DateTime? _startTime;

  // Settings Controllers
  String _selectedRestartPolicy = 'no';

  @override
  void initState() {
    super.initState();
    _connectSocket();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_inspectFuture == null) {
      _refreshDetails();
    }
  }

  void _refreshDetails() {
    _inspectFuture = _apiService.inspectContainer(widget.container.id).then((
      data,
    ) {
      // Initialize settings from data
      final hostConfig = data['HostConfig'];
      if (hostConfig != null && hostConfig['RestartPolicy'] != null) {
        _selectedRestartPolicy = hostConfig['RestartPolicy']['Name'] ?? 'no';
      }

      // Init Timer for uptime
      final state = data['State'] ?? {};
      if (state['StartedAt'] != null && state['Status'] == 'running') {
        try {
          _startTime = DateTime.parse(state['StartedAt']);
          _startUptimeTimer();
        } catch (e) {
          print('Error parsing start time: $e');
        }
      } else {
        _uptimeTimer?.cancel();
        _uptimeString = state['Status'] ?? 'unknown';
      }

      return data;
    });
    if (mounted) setState(() {});
  }

  void _startUptimeTimer() {
    _uptimeTimer?.cancel();
    _updateUptime();
    _uptimeTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => _updateUptime(),
    );
  }

  void _updateUptime() {
    if (_startTime == null) return;
    final now = DateTime.now().toUtc(); // Docker times are usually UTC
    // Actually DateTime.parse handles offset if Z is present, so let's check local vs utc
    // Defaulting to simple difference
    final diff = DateTime.now().difference(_startTime!.toLocal());

    if (diff.isNegative) {
      if (mounted) setState(() => _uptimeString = 'Starting...');
      return;
    }

    final days = diff.inDays;
    final hours = diff.inHours % 24;
    final minutes = diff.inMinutes % 60;
    final seconds = diff.inSeconds % 60;

    String formatted = '';
    if (days > 0) formatted += '${days}d ';
    if (hours > 0) formatted += '${hours}h ';
    formatted += '${minutes}m ${seconds}s';

    if (mounted) setState(() => _uptimeString = formatted);
  }

  void _connectSocket() {
    socket = IO.io(
      _socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .build(),
    );

    socket.onConnect((_) {
      print('Connected to socket for logs');
      socket.emit('subscribe_logs', widget.container.id);
    });

    socket.on('log_chunk', (data) {
      if (data['containerId'] == widget.container.id) {
        if (mounted) {
          final spans = AnsiParser.parse(data['chunk']);
          setState(() {
            _logSpans.addAll(spans);
          });
          // Limit logs to avoid memory issues
          if (_logSpans.length > 2000) {
            _logSpans.removeRange(0, _logSpans.length - 2000);
          }
          // Auto-scroll logic if at bottom
          if (_scrollController.hasClients &&
              _scrollController.position.atEdge &&
              _scrollController.position.pixels != 0) {
            _scrollToBottom();
          } else {
            _scrollToBottom(); // Force stick for now
          }
        }
      }
    });

    socket.onDisconnect((_) => print('Disconnected'));
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
      });
    }
  }

  Future<void> _handleAction(String action) async {
    try {
      final id = widget.container.id;
      if (action == 'start') await _apiService.startContainer(id);
      if (action == 'stop') await _apiService.stopContainer(id);
      if (action == 'restart') await _apiService.restartContainer(id);

      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Action $action sent')));
        _refreshDetails();
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _updateRestartPolicy(String? newValue) async {
    if (newValue == null) return;
    try {
      await _apiService.updateContainer(
        widget.container.id,
        restartPolicy: {'Name': newValue},
      );
      setState(() {
        _selectedRestartPolicy = newValue;
      });
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Restart policy updated')));
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error updating: $e')));
    }
  }

  @override
  void dispose() {
    socket.dispose();
    _uptimeTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  Color _getStateColor(String state) {
    if (state == 'running') return const Color(0xFF00E676);
    if (state == 'exited') return const Color(0xFFFF5252);
    return Colors.orangeAccent;
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.container.names.isNotEmpty
                ? widget.container.names[0]
                : 'Detail',
          ),
          bottom: const TabBar(
            indicatorColor: Color(0xFF00E5FF),
            labelColor: Color(0xFF00E5FF),
            unselectedLabelColor: Colors.white54,
            tabs: [
              Tab(icon: Icon(Icons.terminal), text: 'Logs'),
              Tab(icon: Icon(Icons.settings), text: 'Settings'),
            ],
          ),
        ),
        body: Column(
          children: [
            // Header Section
            FutureBuilder<Map<String, dynamic>>(
              future: _inspectFuture,
              builder: (context, snapshot) {
                if (!snapshot.hasData)
                  return const LinearProgressIndicator(
                    color: Color(0xFF00E5FF),
                  );
                final data = snapshot.data!;
                final state = data['State'] ?? {};
                final config = data['Config'] ?? {};
                final networkSettings = data['NetworkSettings'] ?? {};

                // Parse Info
                final status = state['Status'] ?? 'unknown';
                final isRunning = status == 'running';

                // If we haven't set uptime string yet (first load), try to set it, otherwise use timer value
                final uptimeDisplay = _uptimeString.isNotEmpty
                    ? _uptimeString
                    : (state['StartedAt'] ?? '');

                final ip = (networkSettings['IPAddress'] != '')
                    ? networkSettings['IPAddress']
                    : 'Check Net';
                final image = config['Image'] ?? widget.container.image;

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1E1E),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Status Indicator
                      Container(
                        width: 6,
                        height: 80,
                        decoration: BoxDecoration(
                          color: _getStateColor(status),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            widget.container.names.isNotEmpty
                                ? Text(
                                    widget.container.names[0].replaceAll(
                                      '/',
                                      '',
                                    ),
                                    style: const TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  )
                                : const SquareScalingSpinner(
                                    size: 30,
                                    color: Color(0xFF00E5FF),
                                  ),
                            const SizedBox(height: 4),
                            Text(
                              'Image: $image',
                              style: const TextStyle(color: Colors.white70),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Chip(
                                  label: Text(status.toUpperCase()),
                                  backgroundColor: _getStateColor(
                                    status,
                                  ).withOpacity(0.2),
                                  labelStyle: TextStyle(
                                    color: _getStateColor(status),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  padding: EdgeInsets.zero,
                                  visualDensity: VisualDensity.compact,
                                ),
                                const SizedBox(width: 8),
                                const Icon(
                                  Icons.access_time,
                                  size: 14,
                                  color: Colors.white54,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  uptimeDisplay,
                                  style: const TextStyle(
                                    color: Colors.white54,
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Icon(
                                  Icons.network_check,
                                  size: 14,
                                  color: Colors.white54,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  ip,
                                  style: const TextStyle(
                                    color: Colors.white54,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Merged Actions
                      Column(
                        children: [
                          if (isRunning)
                            IconButton(
                              icon: const Icon(
                                Icons.stop_circle_outlined,
                                color: Colors.redAccent,
                                size: 32,
                              ),
                              onPressed: () => _handleAction('stop'),
                              tooltip: 'Stop',
                            )
                          else
                            IconButton(
                              icon: const Icon(
                                Icons.play_circle_outline,
                                color: Colors.greenAccent,
                                size: 32,
                              ),
                              onPressed: () => _handleAction('start'),
                              tooltip: 'Start',
                            ),
                          IconButton(
                            icon: const Icon(
                              Icons.refresh,
                              color: Colors.orangeAccent,
                            ),
                            onPressed: () => _handleAction('restart'),
                            tooltip: 'Restart',
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),

            // Tabs Content
            Expanded(
              child: TabBarView(
                children: [
                  // Tab 1: Logs
                  Container(
                    color: Colors.black,
                    padding: const EdgeInsets.all(8),
                    child: ListView.builder(
                      controller: _scrollController,
                      itemCount: _logSpans.length,
                      itemBuilder: (context, index) {
                        // SelectableText is heavy for lists. Text.rich is lighter.
                        // If selection is strict requirement, SelectionArea parent is better in Flutter 3.3+
                        return Text.rich(
                          _logSpans[index],
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                          ),
                        );
                      },
                    ),
                  ),

                  // Tab 2: Settings
                  FutureBuilder<Map<String, dynamic>>(
                    future: _inspectFuture,
                    builder: (context, snapshot) {
                      if (!snapshot.hasData)
                        return const Center(
                          child: CircularProgressIndicator(
                            color: Color(0xFF00E5FF),
                          ),
                        );
                      final data = snapshot.data!;
                      final config = data['Config'] ?? {};
                      final hostConfig = data['HostConfig'] ?? {};
                      final network = data['NetworkSettings'] ?? {};

                      final envs = (config['Env'] as List<dynamic>? ?? []).join(
                        '\n',
                      );
                      final labels =
                          (config['Labels'] as Map<String, dynamic>? ?? {})
                              .entries
                              .map((e) => '${e.key}=${e.value}')
                              .join('\n');
                      final ports =
                          (network['Ports'] as Map<String, dynamic>? ?? {}).keys
                              .join(', ');
                      final volumes =
                          (hostConfig['Binds'] as List<dynamic>? ?? []).join(
                            '\n',
                          );

                      return ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildSectionTitle('Restart Policy'),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2C2C2C),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _selectedRestartPolicy,
                                dropdownColor: const Color(0xFF2C2C2C),
                                style: const TextStyle(color: Colors.white),
                                isExpanded: true,
                                items: const [
                                  DropdownMenuItem(
                                    value: 'no',
                                    child: Text('No'),
                                  ),
                                  DropdownMenuItem(
                                    value: 'always',
                                    child: Text('Always'),
                                  ),
                                  DropdownMenuItem(
                                    value: 'on-failure',
                                    child: Text('On Failure'),
                                  ),
                                  DropdownMenuItem(
                                    value: 'unless-stopped',
                                    child: Text('Unless Stopped'),
                                  ),
                                ],
                                onChanged: _updateRestartPolicy,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),

                          _buildSectionTitle('Environment Variables'),
                          (config['Env'] as List<dynamic>? ?? []).isEmpty
                              ? _buildInfoBox('No Environment Variables')
                              : Container(
                                  margin: const EdgeInsets.only(bottom: 20),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1E1E1E),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.white10),
                                  ),
                                  child: Table(
                                    border: TableBorder.symmetric(
                                      inside: const BorderSide(
                                        color: Colors.white10,
                                      ),
                                    ),
                                    columnWidths: const {
                                      0: IntrinsicColumnWidth(),
                                      1: FlexColumnWidth(),
                                    },
                                    defaultVerticalAlignment:
                                        TableCellVerticalAlignment.middle,
                                    children:
                                        (config['Env'] as List<dynamic>? ?? [])
                                            .map((e) {
                                              final String envStr = e
                                                  .toString();
                                              final int splitIndex = envStr
                                                  .indexOf('=');
                                              final String key =
                                                  splitIndex != -1
                                                  ? envStr.substring(
                                                      0,
                                                      splitIndex,
                                                    )
                                                  : envStr;
                                              final String value =
                                                  splitIndex != -1
                                                  ? envStr.substring(
                                                      splitIndex + 1,
                                                    )
                                                  : '';

                                              return TableRow(
                                                children: [
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.all(
                                                          12,
                                                        ),
                                                    child: SelectableText(
                                                      key,
                                                      style: const TextStyle(
                                                        color: Colors.white,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        fontSize: 13,
                                                      ),
                                                    ),
                                                  ),
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.all(
                                                          12,
                                                        ),
                                                    child: SelectableText(
                                                      value,
                                                      style: const TextStyle(
                                                        color: Colors.white70,
                                                        fontFamily: 'monospace',
                                                        fontSize: 12,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              );
                                            })
                                            .toList(),
                                  ),
                                ),

                          _buildSectionTitle('Port Configuration'),
                          _buildInfoBox(
                            ports.isEmpty ? 'No Ports Exposed' : ports,
                          ),

                          _buildSectionTitle('Labels'),
                          (config['Labels'] as Map<String, dynamic>? ?? {})
                                  .isEmpty
                              ? _buildInfoBox('No Labels')
                              : Container(
                                  margin: const EdgeInsets.only(
                                    bottom: 20,
                                  ), // Added margin to match _buildInfoBox spacing
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1E1E1E),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.white10),
                                  ),
                                  child: Table(
                                    border: TableBorder.symmetric(
                                      inside: const BorderSide(
                                        color: Colors.white10,
                                      ),
                                    ),
                                    columnWidths: const {
                                      0: IntrinsicColumnWidth(),
                                      1: FlexColumnWidth(),
                                    },
                                    defaultVerticalAlignment:
                                        TableCellVerticalAlignment.middle,
                                    children:
                                        (config['Labels']
                                                    as Map<String, dynamic>? ??
                                                {})
                                            .entries
                                            .map((e) {
                                              return TableRow(
                                                children: [
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.all(
                                                          12,
                                                        ),
                                                    child: SelectableText(
                                                      e.key,
                                                      style: const TextStyle(
                                                        color: Colors.white,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        fontSize: 13,
                                                      ),
                                                    ),
                                                  ),
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.all(
                                                          12,
                                                        ),
                                                    child: SelectableText(
                                                      e.value.toString(),
                                                      style: const TextStyle(
                                                        color: Colors.white70,
                                                        fontFamily: 'monospace',
                                                        fontSize: 12,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              );
                                            })
                                            .toList(),
                                  ),
                                ),

                          _buildSectionTitle('Volumes / Binds'),
                          _buildInfoBox(
                            volumes.isEmpty ? 'No Volumes' : volumes,
                          ),
                          _buildSectionTitle('Volumes / Binds'),
                          _buildInfoBox(
                            volumes.isEmpty ? 'No Volumes' : volumes,
                          ),

                          _buildSectionTitle('Network Settings'),
                          _buildNetworkSection(network['Networks']),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNetworkSection(Map<String, dynamic>? networks) {
    if (networks == null || networks.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInfoBox('No Networks Attached'),
          _buildConnectButton(),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.white10),
          ),
          child: Column(
            children: networks.entries.map((e) {
              final net = e.value as Map<String, dynamic>;
              return ListTile(
                leading: const Icon(Icons.hub, color: Colors.blueAccent),
                title: Text(
                  e.key,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                subtitle: Text(
                  'IP: ${net['IPAddress']}\nGateway: ${net['Gateway']}\nMac: ${net['MacAddress']}',
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
                isThreeLine: true,
                trailing: IconButton(
                  icon: const Icon(Icons.link_off, color: Colors.redAccent),
                  onPressed: () => _disconnectNetwork(e.key, net['NetworkID']),
                  tooltip: 'Disconnect',
                ),
              );
            }).toList(),
          ),
        ),
        _buildConnectButton(),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildConnectButton() {
    return OutlinedButton.icon(
      icon: const Icon(Icons.add_link),
      label: const Text('Connect Network'),
      style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF00E5FF)),
      onPressed: _showConnectNetworkDialog,
    );
  }

  Future<void> _disconnectNetwork(String name, String networkId) async {
    try {
      await _apiService.disconnectNetwork(widget.container.id, networkId);
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Disconnected from $name')));
      _refreshDetails();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _showConnectNetworkDialog() async {
    // Fetch networks
    List<dynamic> networks = [];
    try {
      networks = await _apiService.getNetworks();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to load networks: $e')));
      return;
    }

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          title: const Text(
            'Connect to Network',
            style: TextStyle(color: Colors.white),
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: networks.length,
              itemBuilder: (context, index) {
                final net = networks[index];
                final name = net['Name'];
                final id = net['Id'];
                return ListTile(
                  title: Text(
                    name,
                    style: const TextStyle(color: Colors.white),
                  ),
                  subtitle: Text(
                    net['Driver'],
                    style: const TextStyle(color: Colors.white54),
                  ),
                  onTap: () async {
                    Navigator.of(context).pop();
                    try {
                      await _apiService.connectNetwork(widget.container.id, id);
                      if (mounted)
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Connected to $name')),
                        );
                      _refreshDetails();
                    } catch (e) {
                      if (mounted)
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(SnackBar(content: Text('Error: $e')));
                    }
                  },
                );
              },
            ),
          ),
          actions: [
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(
        title,
        style: const TextStyle(
          color: Color(0xFF00E5FF),
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildInfoBox(String content) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white10),
      ),
      child: SelectableText(
        content,
        style: const TextStyle(
          color: Colors.white70,
          fontFamily: 'monospace',
          fontSize: 13,
        ),
      ),
    );
  }
}
