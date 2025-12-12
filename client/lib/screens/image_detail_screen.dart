import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ImageDetailScreen extends StatelessWidget {
  final dynamic image; // Passing raw json map for now
  final ApiService _apiService = ApiService();

  ImageDetailScreen({super.key, required this.image});

  Future<void> _deleteImage(BuildContext context) async {
    try {
      await _apiService.deleteImage(image['Id']);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Image deleted')));
      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final tags = (image['RepoTags'] as List?)?.join(', ') ?? 'No tag';
    final size = ((image['Size'] as int) / 1024 / 1024).toStringAsFixed(2);
    final created = DateTime.fromMillisecondsSinceEpoch(image['Created'] * 1000).toString();

    return Scaffold(
      appBar: AppBar(
        title: Text('Image Detail'),
        actions: [
           IconButton(icon: const Icon(Icons.delete), onPressed: () => _deleteImage(context), tooltip: 'Delete'),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
             Text('ID:', style: Theme.of(context).textTheme.titleSmall),
             SelectableText(image['Id']),
             const SizedBox(height: 16),
             Text('Tags:', style: Theme.of(context).textTheme.titleSmall),
             Text(tags, style: Theme.of(context).textTheme.bodyLarge),
             const SizedBox(height: 16),
             Text('Size:', style: Theme.of(context).textTheme.titleSmall),
             Text('$size MB'),
             const SizedBox(height: 16),
             Text('Created:', style: Theme.of(context).textTheme.titleSmall),
             Text(created),
          ],
        ),
      ),
    );
  }
}
