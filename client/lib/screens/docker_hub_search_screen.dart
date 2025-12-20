import 'package:flutter/material.dart';
import '../../widgets/square_scaling_spinner.dart';
import 'dart:convert';
import '../services/api_service.dart';
import '../services/notification_service.dart';
import 'docker_hub_image_detail_screen.dart';

class DockerHubSearchScreen extends StatefulWidget {
  const DockerHubSearchScreen({super.key});

  @override
  State<DockerHubSearchScreen> createState() => _DockerHubSearchScreenState();
}

class _DockerHubSearchScreenState extends State<DockerHubSearchScreen> {
  final ApiService _apiService = ApiService();
  final TextEditingController _searchController = TextEditingController();
  List<dynamic> _results = [];
  bool _isLoading = false;

  Future<void> _search(String term) async {
    if (term.isEmpty) return;
    setState(() {
      _isLoading = true;
      _results = [];
    });

    try {
      final results = await _apiService.searchImages(term);
      if (mounted) {
        setState(() {
          _results = results;
        });
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Search Docker Hub...',
            border: InputBorder.none,
            hintStyle: TextStyle(color: Colors.white60),
          ),
          onSubmitted: _search,
          textInputAction: TextInputAction.search,
        ),
      ),
      body: _isLoading
          ? const Center(
              child: SquareScalingSpinner(color: Color(0xFF00E5FF)),
            )
          : ListView.separated(
              itemCount: _results.length,
              separatorBuilder: (ctx, i) =>
                  const Divider(height: 1, color: Colors.white10),
              itemBuilder: (context, index) {
                final item = _results[index];
                // Docker search results fields: repo_name, short_description, star_count, is_official, is_automated
                final name = item['repo_name'] ?? 'Unknown';
                final desc = item['short_description'] ?? '';
                final stars = item['star_count'] ?? 0;
                final isOfficial = item['is_official'] == true;

                return ListTile(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) =>
                            DockerHubImageDetailScreen(image: item),
                      ),
                    );
                  },
                  title: Row(
                    children: [
                      Flexible(
                        child: Text(
                          name,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (isOfficial) ...[
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.verified,
                          color: Colors.blueAccent,
                          size: 16,
                        ),
                      ],
                    ],
                  ),
                  subtitle: Text(
                    desc,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star, color: Colors.amber, size: 16),
                      const SizedBox(width: 4),
                      Text('$stars'),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right, color: Colors.white54),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
