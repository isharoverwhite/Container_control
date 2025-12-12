import 'package:flutter/material.dart';
import '../services/api_service.dart';

class CreateContainerScreen extends StatefulWidget {
  final Map<String, dynamic>? initialImage; // Optional, to pre-fill image
  const CreateContainerScreen({super.key, this.initialImage});

  @override
  State<CreateContainerScreen> createState() => _CreateContainerScreenState();
}

class _CreateContainerScreenState extends State<CreateContainerScreen>
    with SingleTickerProviderStateMixin {
  final ApiService _apiService = ApiService();
  late TabController _tabController;

  // Controllers & State
  final _formKey = GlobalKey<FormState>();

  // Basic
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _imageController = TextEditingController();
  final TextEditingController _cmdController = TextEditingController();
  final TextEditingController _entrypointController = TextEditingController();
  final TextEditingController _workingDirController = TextEditingController();
  final TextEditingController _userController = TextEditingController();

  // Env
  final List<Map<String, String>> _envVars = [];

  // Ports
  final List<Map<String, String>> _ports = []; // {private, public, protocol}

  // Volumes
  final List<Map<String, String>> _volumes = []; // {source, target, type}

  // Network
  String _networkMode = 'bridge';
  final TextEditingController _ipv4Controller = TextEditingController();
  final TextEditingController _hostnameController = TextEditingController();
  final TextEditingController _macController = TextEditingController();
  final TextEditingController _dnsPriController = TextEditingController();
  final TextEditingController _dnsSecController = TextEditingController();
  List<dynamic> _availableNetworks = [];
  List<dynamic> _availableVolumes = [];
  Map<String, dynamic>? _systemInfo;

  // Resources
  double _cpuLimit = 0; // 0 = unlimited
  double _memLimit = 0; // MB
  bool _enableGpu = false;
  bool _privileged = false;
  bool _autostart = true;
  String _restartPolicy = 'no';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    if (widget.initialImage != null) {
      _imageController.text =
          (widget.initialImage!['RepoTags'] as List?)?.first ?? '';
    }
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final nets = await _apiService.getNetworks();
      final vols = await _apiService.getVolumes();
      final info = await _apiService.getSystemInfo();
      setState(() {
        _availableNetworks = nets;
        // vols can be List or Map depending on docker version/api result wrapper
        if (vols is List) {
          _availableVolumes = vols;
        } else if (vols is Map && vols['Volumes'] != null) {
          _availableVolumes = vols['Volumes'];
        }
        _systemInfo = info;
      });
    } catch (e) {
      print(e);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _nameController.dispose();
    _imageController.dispose();
    _cmdController.dispose();
    _entrypointController.dispose();
    _workingDirController.dispose();
    _userController.dispose();
    _ipv4Controller.dispose();
    _hostnameController.dispose();
    _macController.dispose();
    _dnsPriController.dispose();
    _dnsSecController.dispose();
    super.dispose();
  }

  Future<void> _createContainer() async {
    if (!_formKey.currentState!.validate()) return;

    try {
      // Construct JSON
      final envList = _envVars.map((e) => '${e['key']}=${e['value']}').toList();
      final portList = _ports
          .map(
            (e) => {
              'private': int.tryParse(e['private'] ?? '0'),
              'public': int.tryParse(e['public'] ?? '0'),
              'protocol': e['protocol'],
            },
          )
          .toList();

      final volList = _volumes
          .map(
            (e) => {
              'source': e['source'],
              'target': e['target'],
              'type': e['type'],
              'readonly': false, // TODO add option?
            },
          )
          .toList();

      final config = {
        'name': _nameController.text.isNotEmpty ? _nameController.text : null,
        'image': _imageController.text,
        'env': envList,
        'cmd': _cmdController.text.isNotEmpty ? _cmdController.text : null,
        'entrypoint': _entrypointController.text.isNotEmpty
            ? _entrypointController.text
            : null,
        'workingDir': _workingDirController.text.isNotEmpty
            ? _workingDirController.text
            : null,
        'user': _userController.text.isNotEmpty ? _userController.text : null,
        'ports': portList,
        'volumes': volList,
        'network': {
          'mode': _networkMode,
          'ipv4': _ipv4Controller.text.isNotEmpty ? _ipv4Controller.text : null,
          'hostname': _hostnameController.text.isNotEmpty
              ? _hostnameController.text
              : null,
          'mac': _macController.text.isNotEmpty ? _macController.text : null,
          'dns_primary': _dnsPriController.text.isNotEmpty
              ? _dnsPriController.text
              : null,
          'dns_secondary': _dnsSecController.text.isNotEmpty
              ? _dnsSecController.text
              : null,
        },
        'resources': {
          'memory': _memLimit > 0 ? _memLimit.toInt().toString() : null,
          'nanoCpus': _cpuLimit > 0 ? _cpuLimit.toString() : null,
          'gpu': _enableGpu,
          'privileged': _privileged,
          'devices': (_enableGpu && _systemInfo?['gpu']?['vendor'] == 'amd')
              ? [
                  {
                    'PathOnHost': '/dev/kfd',
                    'PathInContainer': '/dev/kfd',
                    'CgroupPermissions': 'rwm',
                  },
                  {
                    'PathOnHost': '/dev/dri',
                    'PathInContainer': '/dev/dri',
                    'CgroupPermissions': 'rwm',
                  },
                ]
              : null,
        },
        'restartPolicy': _restartPolicy,
        'autostart': _autostart,
      };

      await _apiService.createContainer(config);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Container created successfully')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Container'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: const Color(0xFF00E5FF),
          labelColor: const Color(0xFF00E5FF),
          unselectedLabelColor: Colors.white54,
          tabs: const [
            Tab(text: 'Basic'),
            Tab(text: 'Network'),
            Tab(text: 'Volumes'),
            Tab(text: 'Env & Ports'),
            Tab(text: 'Resources'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.check, color: Color(0xFF00E676)),
            onPressed: _createContainer,
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: TabBarView(
          controller: _tabController,
          children: [
            _buildBasicTab(),
            _buildNetworkTab(),
            _buildVolumesTab(),
            _buildEnvPortsTab(),
            _buildResourcesTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildBasicTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInput(_nameController, 'Container Name', 'my-container'),
        const SizedBox(height: 16),
        _buildInput(
          _imageController,
          'Image (Required)',
          'nginx:latest',
          required: true,
        ),
        const SizedBox(height: 16),
        _buildInput(_cmdController, 'Command', 'npm start'),
        const SizedBox(height: 16),
        _buildInput(_entrypointController, 'Entrypoint', '/bin/sh'),
        const SizedBox(height: 16),
        _buildInput(_workingDirController, 'Working Directory', '/app'),
        const SizedBox(height: 16),
        _buildInput(_userController, 'User', '1000:1000'),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _restartPolicy,
          dropdownColor: const Color(0xFF1E1E1E),
          decoration: const InputDecoration(
            labelText: 'Restart Policy',
            labelStyle: TextStyle(color: Colors.white70),
          ),
          style: const TextStyle(color: Colors.white),
          items: [
            'no',
            'always',
            'on-failure',
            'unless-stopped',
          ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
          onChanged: (v) => setState(() => _restartPolicy = v!),
        ),
        const SizedBox(height: 16),
        CheckboxListTile(
          title: const Text(
            'Auto-start after creation',
            style: TextStyle(color: Colors.white),
          ),
          value: _autostart,
          onChanged: (v) => setState(() => _autostart = v!),
          activeColor: const Color(0xFF00E5FF),
          checkColor: Colors.black,
          contentPadding: EdgeInsets.zero,
        ),
      ],
    );
  }

  Widget _buildNetworkTab() {
    // Networks options
    // Combined system (host, bridge, none) + user defined
    final sysNets = ['bridge', 'host', 'none'];
    final userNets = _availableNetworks
        .map((n) => n['Name'].toString())
        .toList();
    final allNets = {
      ...sysNets,
      ...userNets,
    }.toList(); // Set to remove dupes if any

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        DropdownButtonFormField<String>(
          value: allNets.contains(_networkMode) ? _networkMode : 'bridge',
          dropdownColor: const Color(0xFF1E1E1E),
          decoration: const InputDecoration(
            labelText: 'Network Mode',
            labelStyle: TextStyle(color: Colors.white70),
          ),
          style: const TextStyle(color: Colors.white),
          items: allNets
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
          onChanged: (v) => setState(() => _networkMode = v!),
        ),
        const SizedBox(height: 16),
        _buildInput(_ipv4Controller, 'IPv4 Address', '172.18.0.5'),
        const SizedBox(height: 16),
        _buildInput(_hostnameController, 'Hostname', 'my-app'),
        const SizedBox(height: 16),
        _buildInput(_macController, 'MAC Address', ''),
        const SizedBox(height: 16),
        _buildInput(_dnsPriController, 'Primary DNS', '8.8.8.8'),
        const SizedBox(height: 16),
        _buildInput(_dnsSecController, 'Secondary DNS', '8.8.4.4'),
      ],
    );
  }

  Widget _buildVolumesTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ElevatedButton.icon(
          onPressed: () {
            setState(() {
              _volumes.add({'source': '', 'target': '', 'type': 'bind'});
            });
          },
          icon: const Icon(Icons.add),
          label: const Text('Add Volume Mapping'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2C2C2C),
            foregroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 16),
        ..._volumes.asMap().entries.map((entry) {
          final index = entry.key;
          final vol = entry.value;

          final volumeNames = _availableVolumes
              .map((v) => v['Name'].toString())
              .toList();

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF2C2C2C),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: vol['type'],
                        dropdownColor: const Color(0xFF1E1E1E),
                        items: ['bind', 'volume']
                            .map(
                              (e) => DropdownMenuItem(value: e, child: Text(e)),
                            )
                            .toList(),
                        onChanged: (v) {
                          setState(() {
                            vol['type'] = v!;
                            vol['source'] =
                                ''; // Reset source when switching type
                          });
                        },
                        decoration: const InputDecoration(labelText: 'Type'),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete, color: Colors.red),
                      onPressed: () => setState(() => _volumes.removeAt(index)),
                    ),
                  ],
                ),
                if (vol['type'] == 'volume')
                  DropdownButtonFormField<String>(
                    value: volumeNames.contains(vol['source'])
                        ? vol['source']
                        : null,
                    dropdownColor: const Color(0xFF1E1E1E),
                    items: volumeNames
                        .map(
                          (e) => DropdownMenuItem(
                            value: e,
                            child: Text(e, overflow: TextOverflow.ellipsis),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => vol['source'] = v!),
                    decoration: const InputDecoration(
                      labelText: 'Source (Volume)',
                      labelStyle: TextStyle(color: Colors.white54),
                    ),
                    isExpanded: true,
                  )
                else
                  TextFormField(
                    initialValue: vol['source'],
                    onChanged: (v) => vol['source'] = v,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Source (Host Path)',
                      labelStyle: TextStyle(color: Colors.white54),
                    ),
                  ),
                TextFormField(
                  initialValue: vol['target'],
                  onChanged: (v) => vol['target'] = v,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Target (Container Path)',
                    labelStyle: TextStyle(color: Colors.white54),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildEnvPortsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Environment
        const Text(
          'Environment Variables',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF00E5FF),
          ),
        ),
        const SizedBox(height: 8),
        ElevatedButton.icon(
          onPressed: () =>
              setState(() => _envVars.add({'key': '', 'value': ''})),
          icon: const Icon(Icons.add),
          label: const Text('Add Variable'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2C2C2C),
            foregroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        ..._envVars.asMap().entries.map((entry) {
          final index = entry.key;
          final env = entry.value;
          return Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: env['key'],
                  onChanged: (v) => env['key'] = v,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Key'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  initialValue: env['value'],
                  onChanged: (v) => env['value'] = v,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Value'),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete, color: Colors.red),
                onPressed: () => setState(() => _envVars.removeAt(index)),
              ),
            ],
          );
        }),

        const Divider(color: Colors.white24, height: 32),

        // Ports
        const Text(
          'Port Mappings',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF00E5FF),
          ),
        ),
        const SizedBox(height: 8),
        ElevatedButton.icon(
          onPressed: () => setState(
            () => _ports.add({'private': '', 'public': '', 'protocol': 'tcp'}),
          ),
          icon: const Icon(Icons.add),
          label: const Text('Add Port'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2C2C2C),
            foregroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        ..._ports.asMap().entries.map((entry) {
          final index = entry.key;
          final port = entry.value;
          return Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: port['public'],
                  onChanged: (v) => port['public'] = v,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Host Port'),
                ),
              ),
              const SizedBox(width: 8),
              const Text(':', style: TextStyle(color: Colors.white)),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  initialValue: port['private'],
                  onChanged: (v) => port['private'] = v,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Cont. Port'),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: port['protocol'],
                dropdownColor: const Color(0xFF1E1E1E),
                items: ['tcp', 'udp']
                    .map(
                      (e) => DropdownMenuItem(
                        value: e,
                        child: Text(
                          e,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => port['protocol'] = v!),
              ),
              IconButton(
                icon: const Icon(Icons.delete, color: Colors.red),
                onPressed: () => setState(() => _ports.removeAt(index)),
              ),
            ],
          );
        }),
      ],
    );
  }

  Widget _buildResourcesTab() {
    double maxMem = 4096;
    int maxCpu = 8;
    bool gpuSupported = false;
    String gpuModel = 'Unknown';
    String gpuVendor = 'none';

    if (_systemInfo != null) {
      // MemTotal is in bytes
      final memBytes = _systemInfo!['MemTotal'] as int? ?? 0;
      if (memBytes > 0) {
        maxMem = memBytes / (1024 * 1024); // MB
      }
      maxCpu = _systemInfo!['NCPU'] as int? ?? 8;

      final gpu = _systemInfo!['gpu'];
      if (gpu != null) {
        gpuSupported = gpu['supported'] ?? false;
        gpuModel = gpu['model'] ?? 'Unknown';
        gpuVendor = gpu['vendor'] ?? 'none';
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        CheckboxListTile(
          title: const Text(
            'Privileged Mode',
            style: TextStyle(color: Colors.white),
          ),
          value: _privileged,
          onChanged: (v) => setState(() => _privileged = v!),
          activeColor: const Color(0xFF00E5FF),
          checkColor: Colors.black,
        ),
        CheckboxListTile(
          title: const Text(
            'Enable GPU',
            style: TextStyle(color: Colors.white),
          ),
          subtitle: Text(
            'Detected GPU on host machine: $gpuVendor - $gpuModel\n${gpuSupported ? "Supported" : "Not supported/Automatic assignment disabled"}',
            style: TextStyle(
              color: gpuSupported ? Colors.greenAccent : Colors.orangeAccent,
            ),
          ),
          value: _enableGpu,
          onChanged: gpuSupported
              ? (v) => setState(() => _enableGpu = v!)
              : null,
          activeColor: const Color(0xFF00E5FF),
          checkColor: Colors.black,
        ),
        const SizedBox(height: 16),
        Text(
          'Memory Limit (MB) - 0 for unlimited (Max: ${maxMem.toInt()} MB)',
          style: const TextStyle(color: Colors.white),
        ),
        Slider(
          value: _memLimit > maxMem ? maxMem : _memLimit,
          min: 0,
          max: maxMem,
          divisions: 100, // Roughly
          label: '${_memLimit.toInt()} MB',
          activeColor: const Color(0xFF00E5FF),
          onChanged: (v) => setState(() => _memLimit = v),
        ),
        Text(
          '${_memLimit.toInt()} MB',
          style: const TextStyle(color: Colors.white70),
        ),

        const SizedBox(height: 16),
        Text(
          'CPU Limit (Cores) - 0 for unlimited (Max: $maxCpu CPUs)',
          style: const TextStyle(color: Colors.white),
        ),
        Slider(
          value: _cpuLimit > maxCpu ? maxCpu.toDouble() : _cpuLimit,
          min: 0,
          max: maxCpu.toDouble(),
          divisions: maxCpu, // Integer steps
          label: _cpuLimit.toInt().toString(),
          activeColor: const Color(0xFF00E5FF),
          onChanged: (v) => setState(() => _cpuLimit = v.roundToDouble()),
        ),
        Text(
          '${_cpuLimit.toInt()} CPUs',
          style: const TextStyle(color: Colors.white70),
        ),
      ],
    );
  }

  Widget _buildInput(
    TextEditingController controller,
    String label,
    String hint, {
    bool required = false,
  }) {
    return TextFormField(
      controller: controller,
      style: const TextStyle(color: Colors.white),
      validator: required
          ? (v) => (v == null || v.isEmpty) ? 'Required' : null
          : null,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.white24),
        labelStyle: const TextStyle(color: Colors.white70),
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: Colors.white10),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: Color(0xFF00E5FF)),
        ),
      ),
    );
  }
}
