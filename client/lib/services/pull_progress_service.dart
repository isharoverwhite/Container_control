import 'package:flutter/foundation.dart';
import 'api_service.dart';
import 'notification_service.dart';


class PullStatus {
  final String image;
  final int percent;
  final String status;
  final String? error;
  final bool isDone;

  PullStatus({
    required this.image,
    this.percent = 0,
    this.status = '',
    this.error,
    this.isDone = false,
  });
}

class PullProgressService {
  static final PullProgressService _instance = PullProgressService._internal();

  factory PullProgressService() => _instance;

  PullProgressService._internal();

  final ValueNotifier<PullStatus?> progress = ValueNotifier(null);

  // Track layers for percentage calc
  final Map<String, Map<String, int>> _layers = {};
  String? _currentImage;

  void init() {
    _cleanup();
    _setupListeners();
  }

  void _setupListeners() {
    final socket = ApiService().socket;
    
    // Safety check if socket is null (shouldn't be with current ApiService)
    
    // Prevent duplicate listeners
    socket.off('docker_pull_progress');
    socket.off('docker_pull_complete');
    socket.off('docker_pull_error');

    socket.on('docker_pull_progress', _onProgress);
    socket.on('docker_pull_complete', _onComplete);
    socket.on('docker_pull_error', _onError);
    
    print('PullProgressService: Listeners set up');
  }

  void _cleanup() {
    try {
      final socket = ApiService().socket;
      socket.off('docker_pull_progress');
      socket.off('docker_pull_complete');
      socket.off('docker_pull_error');
    } catch (e) {
      // Ignore errors if socket not ready
    }
  }

  void _onProgress(dynamic data) {
    // data = { image, event: {...} }
    final image = data['image'];
    final event = data['event'];
    
    // If getting data for a new image, switch to it?
    // User wants ALL notifications.
    // For simplicity, we track the latest active one.
    
    _currentImage = image;

    final status = event['status'] ?? '';
    final id = event['id'];

    if (status == 'Downloading' || status == 'Extracting') {
      if (id != null &&
          event['progressDetail'] != null &&
          event['progressDetail']['total'] != null) {
        final current = event['progressDetail']['current'] as int;
        final total = event['progressDetail']['total'] as int; // Fixed typo 'total'
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
    
    // Update notifier
    progress.value = PullStatus(
      image: image,
      percent: percent,
      status: '$status ${id ?? ''}',
      isDone: false,
    );

    // Update System Notification - User wants Status Only (No Progress Bar)
    NotificationService().showDone(
        image.hashCode,
        'Pulling $image',
        '$status ${id ?? ''}'
    );


  }

  void _onComplete(dynamic data) {
    final image = data['image'];
    _currentImage = null;
    _layers.clear();
    
    progress.value = PullStatus(
      image: image,
      percent: 100,
      status: 'Complete',
      isDone: true,
    );
    
    // Update System Notification
    NotificationService().showDone(
      image.hashCode,
      'Pull Complete', 
      '$image is ready'
    );


    
    // Auto-clear after delay
    Future.delayed(const Duration(seconds: 4), () {
      if (progress.value?.image == image && progress.value?.isDone == true) {
        progress.value = null;
      }
    });
  }

  void _onError(dynamic data) {
    final image = data['image'];
    final error = data['error'] ?? 'Unknown error';
    
    _currentImage = null;
    _layers.clear();
    
    progress.value = PullStatus(
      image: image,
      percent: 0,
      status: 'Error',
      error: error,
      isDone: true, // Failed is technically done
    );

    // Update System Notification
    NotificationService().showDone(
      image.hashCode,
      'Pull Failed', 
      'Error pulling $image: $error'
    );


    
     // Auto-clear after delay
    Future.delayed(const Duration(seconds: 5), () {
      if (progress.value?.image == image && progress.value?.error != null) {
        progress.value = null;
      }
    });
  }
}
