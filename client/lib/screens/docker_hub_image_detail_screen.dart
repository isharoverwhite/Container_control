import 'package:flutter/material.dart';
import 'dart:convert';
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

  @override
  void initState() {
    super.initState();
    _fetchDetails();
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

    // Start pull and handle stream
    final notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final NotificationService ns = NotificationService();

    // Map to track progress of each layer: layerId -> {current, total}
    final Map<String, Map<String, int>> layers = {};

    try {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Pulling $fullImageName... check notification bar'),
        ),
      );

      final stream = await _apiService.pullImage(fullImageName);
      int lastPercent = 0;
      DateTime lastUpdate = DateTime.now();

      // Show initial starting notification
      await ns.showProgress(
        notificationId,
        0,
        'Pulling $fullImageName',
        'Starting...',
      );

      await for (final line in stream) {
        if (line.trim().isEmpty) continue;
        try {
          final data = json.decode(line);
          final status = data['status'] ?? '';
          final id = data['id'];

          if (status == 'Downloading' || status == 'Extracting') {
            if (id != null &&
                data['progressDetail'] != null &&
                data['progressDetail']['total'] != null) {
              final current = data['progressDetail']['current'] as int;
              final total = data['progressDetail']['total'] as int;
              layers[id] = {'current': current, 'total': total};
            }
          }

          int totalBytes = 0;
          int currentBytes = 0;
          layers.forEach((key, value) {
            currentBytes += value['current']!;
            totalBytes += value['total']!;
          });

          int percent = 0;
          if (totalBytes > 0) {
            percent = ((currentBytes / totalBytes) * 100).toInt();
          }

          // Throttle updates: Update only if 1 second passed AND percent changed
          final now = DateTime.now();
          if (now.difference(lastUpdate).inSeconds >= 1 &&
              percent != lastPercent) {
            lastUpdate = now;
            lastPercent = percent;

            await ns.showProgress(
              notificationId,
              percent,
              'Pulling $fullImageName',
              'Downloading... $percent%',
            );
          }
        } catch (e) {
          print('Error parsing line: $e');
        }
      }

      await ns.showDone(
        notificationId,
        'Pull Complete',
        '$fullImageName is ready',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Pull of $fullImageName complete')),
        );
      }
    } catch (e) {
      await ns.showDone(notificationId, 'Pull Failed', 'Error: $e');
      print('Pull error: $e');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Pull failed: $e')));
      }
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
                        child: CircularProgressIndicator(),
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
                  ? const Center(child: CircularProgressIndicator())
                  : Text(
                      desc,
                      style: const TextStyle(
                        color: Colors.white70,
                        height: 1.5,
                      ),
                    ),
            ),

            const SizedBox(height: 32),
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
          ],
        ),
      ),
    );
  }
}
