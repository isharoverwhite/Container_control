import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;

    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    final LinuxInitializationSettings initializationSettingsLinux =
        LinuxInitializationSettings(defaultActionName: 'Open notification');

    final InitializationSettings initializationSettings =
        InitializationSettings(
          android: initializationSettingsAndroid,
          linux: initializationSettingsLinux,
        );

    await flutterLocalNotificationsPlugin.initialize(initializationSettings);

    // Request notification permission for Android 13+ (API 33+)
    final AndroidFlutterLocalNotificationsPlugin? androidImplementation =
        flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    if (androidImplementation != null) {
      // Request permission for Android 13+
      await androidImplementation.requestNotificationsPermission();
      
      // Create notification channel for Android 8.0+ (API 26+)
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'download_channel', // id
        'Downloads', // name
        description: 'Show download progress for Docker images',
        importance: Importance.high,
        enableVibration: false,
        playSound: false,
      );

      await androidImplementation.createNotificationChannel(channel);
    }

    _initialized = true;
  }

  Future<void> showProgress(
    int id,
    int progress,
    String title,
    String body,
  ) async {
    print('NotificationService: Showing progress $progress% for $id ($title)');
    final AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
          'download_channel',
          'Downloads',
          channelDescription: 'Show download progress',
          importance: Importance.high,
          priority: Priority.high,
          showProgress: true,
          maxProgress: 100,
          progress: progress,
          onlyAlertOnce: true,
          ongoing: true, // Prevent dismissal during download
          autoCancel: false, // Keep notification until download completes
        );

    final LinuxNotificationDetails linuxPlatformChannelSpecifics =
        const LinuxNotificationDetails();

    final NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
      linux: linuxPlatformChannelSpecifics,
    );

    await flutterLocalNotificationsPlugin.show(
      id,
      title,
      body,
      platformChannelSpecifics,
    );
  }

  Future<void> showDone(int id, String title, String body) async {
    print('NotificationService: Showing done for $id ($title)');
    final AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
          'download_channel',
          'Downloads',
          channelDescription: 'Show download progress',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
          showProgress: false,
          ongoing: false, // Allow dismissal when complete
          autoCancel: true, // User can swipe to dismiss
        );

    final LinuxNotificationDetails linuxPlatformChannelSpecifics =
        const LinuxNotificationDetails();

    final NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
      linux: linuxPlatformChannelSpecifics,
    );

    await flutterLocalNotificationsPlugin.show(
      id,
      title,
      body,
      platformChannelSpecifics,
    );
  }
}
