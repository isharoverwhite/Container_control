import 'dart:async';
import 'package:flutter/material.dart';
import '../../widgets/square_scaling_spinner.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';

class DockerHubImageDetailScreen extends StatefulWidget {
  final Map<String, dynamic> image;

  const DockerHubImageDetailScreen({super.key, required this.image});

  @override
  State<DockerHubImageDetailScreen> createState() =>
      _DockerHubImageDetailScreenState();
}

class _DockerHubImageDetailScreenState
    extends State<DockerHubImageDetailScreen> {
  final ApiService _apiService = ApiService();
  String? _selectedTag;
  List<String> _tags = [];
  String _fullDescription = '';
  bool _isLoadingDetails = true;
  
  // Pull tracking
  int? _currentPullNotificationId;
  String? _currentPullingImage;
  final Map<String, Map<String, int>> _layers = {};
  int _lastPercent = 0;
  DateTime _lastUpdate = DateTime.now();
  Timer? _pullTimeoutTimer;

  @override
  void initState() {
    super.initState();
    _fetchDetails();
    _setupSocketListeners();
  }
  
  @override
  void dispose() {
    _cleanupSocketListeners();
    super.dispose();
  }
  
  void _setupSocketListeners() {
    _apiService.socket.on('docker_pull_progress', _onPullProgress);
    _apiService.socket.on('docker_pull_complete', _onPullComplete);
    _apiService.socket.on('docker_pull_error', _onPullError);
  }
  
  void _cleanupSocketListeners() {
    _apiService.socket.off('docker_pull_progress', _onPullProgress);
    _apiService.socket.off('docker_pull_complete', _onPullComplete);
    _apiService.socket.off('docker_pull_error', _onPullError);
    _pullTimeoutTimer?.cancel();
    _pullTimeoutTimer = null;
  }
  
  void _onPullProgress(dynamic data) {
    print('DEBUG: Received docker_pull_progress event: ${data.toString()}');
    if (_currentPullingImage == null || data['image'] != _currentPullingImage) {
      print('DEBUG: Ignoring progress - current: $_currentPullingImage, event: ${data['image']}');
      return;
    }
    
    final event = data['event'];
    final status = event['status'] ?? '';
    final id = event['id'];

    if (status == 'Downloading' || status == 'Extracting') {
      if (id != null &&
          event['progressDetail'] != null &&
          event['progressDetail']['total'] != null) {
        final current = event['progressDetail']['current'] as int;
        final total = event['progressDetail']['total'] as int;
        _layers[id] = {'current': current, 'total': total};
      }
    }

    int totalBytes = 0;
    int currentBytes = 0;
    _layers.forEach((key, value) {
      currentBytes += value['current']!;
      totalBytes += value['total']!;
    });

    int percent = 0;
    if (totalBytes > 0) {
      percent = ((currentBytes / totalBytes) * 100).toInt();
    }

    final now = DateTime.now();
    if (now.difference(_lastUpdate).inSeconds >= 1 && percent != _lastPercent) {
      _lastUpdate = now;
      _lastPercent = percent;

      if (_currentPullNotificationId != null) {
        NotificationService().showProgress(
          _currentPullNotificationId!,
          percent,
          'Pulling $_currentPullingImage',
          'Downloading... $percent%',
        );
      }
    }
  }
  
  void _onPullError(dynamic data) {
    print('DEBUG: Received docker_pull_error event: ${data.toString()}');
    if (_currentPullingImage == null || data['image'] != _currentPullingImage) {
      print('DEBUG: Ignoring error - current: $_currentPullingImage, event: ${data['image']}');
      return;
    }
    
    final error = data['error'] ?? 'Unknown error';
    if (_currentPullNotificationId != null) {
      NotificationService().showDone(
        _currentPullNotificationId!,
        'Pull Failed',
        'Error: $error',
      );
    }
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Pull failed: $error')),
      );
    }
    
    _currentPullingImage = null;
    _currentPullNotificationId = null;
    _layers.clear();
  }
  
  void _onPullComplete(dynamic data) {
    print('DEBUG: Received docker_pull_complete event: ${data.toString()}');
    if (_currentPullingImage == null || data['image'] != _currentPullingImage) {
      print('DEBUG: Ignoring complete - current: $_currentPullingImage, event: ${data['image']}');
      return;
    }
    
    if (_currentPullNotificationId != null) {
      NotificationService().showDone(
        _currentPullNotificationId!,
        'Pull Complete',
        '$_currentPullingImage is ready',
      );
    }
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Pull of $_currentPullingImage complete')),
      );
    }
    
    _currentPullingImage = null;
    _currentPullNotificationId = null;
    _layers.clear();
  }

  Future<void> _fetchDetails() async {
    final repoName = widget.image['repo_name'];
    try {
      final repoDetails = await _apiService.getDockerHubRepository(repoName);
      final tags = await _apiService.getDockerHubTags(repoName);

      if (mounted) {
        setState(() {
          _fullDescription = repoDetails['full_description'] ?? '';
          _tags = tags;
          if (_tags.contains('latest')) {
            _selectedTag = 'latest';
          } else if (_tags.isNotEmpty) {
            _selectedTag = _tags.first;
          }
          _isLoadingDetails = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingDetails = false;
          _fullDescription = 'Failed to load details: $e';
        });
      }
    }
  }

  Future<void> _pullImage() async {
    final repoName = widget.image['repo_name'];
    final tag = _selectedTag ?? 'latest';
    final fullImageName = '$repoName:$tag';

    _currentPullNotificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    _currentPullingImage = fullImageName;
    _layers.clear();
    _lastPercent = 0;
    _lastUpdate = DateTime.now();
    
    print('DEBUG: Starting pull for image: $fullImageName');
    print('DEBUG: Set _currentPullingImage to: $_currentPullingImage');

    try {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Pulling $fullImageName... check notification bar'),
        ),
      );

      // Show initial notification
      await NotificationService().showProgress(
        _currentPullNotificationId!,
        0,
        'Pulling $fullImageName',
        'Starting...',
      );

      // Trigger the pull on server
      print('DEBUG: Socket connected: ${_apiService.socket.connected}');
      await _apiService.pullImageBackground(fullImageName);
      
      // Set a timeout (10 minutes) in case pull gets stuck
      _pullTimeoutTimer?.cancel();
      _pullTimeoutTimer = Timer(const Duration(minutes: 10), () {
        if (_currentPullingImage == fullImageName && _currentPullNotificationId != null) {
          NotificationService().showDone(
            _currentPullNotificationId!,
            'Pull Timeout',
            'Pull took too long - check server logs',
          );
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Pull timeout - operation took too long')),
            );
          }
          
          _currentPullingImage = null;
          _currentPullNotificationId = null;
          _layers.clear();
        }
      });

    } catch (e) {
      if (_currentPullNotificationId != null) {
        await NotificationService().showDone(
          _currentPullNotificationId!,
          'Pull Failed',
          'Error: $e',
        );
      }
      print('Pull error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Pull failed: $e')),
        );
      }
      _currentPullingImage = null;
      _currentPullNotificationId = null;
      _pullTimeoutTimer?.cancel();
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.image['repo_name'] ?? 'Unknown';
    // Use full description if available, else short
    final desc = _fullDescription.isNotEmpty
        ? _fullDescription
        : widget.image['short_description'] ?? 'No description provided.';
    final stars = widget.image['star_count'] ?? 0;
    final isOfficial = widget.image['is_official'] == true;
    final pullCount = widget.image['pull_count'] ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blueAccent.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.inventory_2,
                    size: 32,
                    color: Colors.blueAccent,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              name,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          if (isOfficial) ...[
                            const SizedBox(width: 8),
                            const Icon(
                              Icons.verified,
                              color: Colors.blueAccent,
                              size: 20,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.star, color: Colors.amber, size: 16),
                          const SizedBox(width: 4),
                          Text('$stars Stars'),
                          const SizedBox(width: 16),
                          const Icon(
                            Icons.download,
                            color: Colors.white54,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text('$pullCount Pulls'),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            // Tags Section First for better UX
            const Text(
              'Select Tag',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white10),
              ),
              child: _isLoadingDetails
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(8.0),
                        child: SquareScalingSpinner(size: 30, color: Colors.white),
                      ),
                    )
                  : DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedTag,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF1E1E1E),
                        icon: const Icon(
                          Icons.arrow_drop_down,
                          color: Colors.white,
                        ),
                        hint: const Text(
                          'Select a tag',
                          style: TextStyle(color: Colors.white54),
                        ),
                        style: const TextStyle(color: Colors.white),
                        items: _tags.map((String tag) {
                          return DropdownMenuItem<String>(
                            value: tag,
                            child: Text(tag),
                          );
                        }).toList(),
                        onChanged: (String? newValue) {
                          setState(() {
                            _selectedTag = newValue;
                          });
                        },
                      ),
                    ),
            ),

            const SizedBox(height: 24),
            
            // Pull Image Button - moved here for better UX
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _pullImage,
                icon: const Icon(Icons.download),
                label: const Text('Pull Image'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00E5FF),
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 4,
                ),
              ),
            ),

            const SizedBox(height: 24),

            const Text(
              'Overview',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white10),
              ),
              child: _isLoadingDetails
                  ? const Center(child: SquareScalingSpinner(color: Color(0xFF00E5FF)))
                  : Text(
                      desc,
                      style: const TextStyle(
                        color: Colors.white70,
                        height: 1.5,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
