import 'dart:convert';
import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../models/server_config.dart';

class ServerManager {
  static final ServerManager _instance = ServerManager._internal();
  factory ServerManager() => _instance;
  ServerManager._internal();

  List<ServerConfig> _servers = [];
  ServerConfig? _activeServer;

  List<ServerConfig> get servers => List.unmodifiable(_servers);
  ServerConfig? get activeServer => _activeServer;
  
  String _deviceId = '';
  String get deviceId => _deviceId;
  
  String _deviceName = 'Unknown Device';
  String get deviceName => _deviceName;

  static const String _serversKey = 'saved_servers';
  static const String _activeServerKey = 'active_server_index';
  static const String _deviceIdKey = 'device_id';

  Function()? onServerChanged;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final String? serversJson = prefs.getString(_serversKey);
    
    if (serversJson != null) {
      final List<dynamic> decoded = json.decode(serversJson);
      _servers = decoded.map((json) => ServerConfig.fromJson(json)).toList();
    }
    
    // Load or Generate Device ID
    String? id = prefs.getString(_deviceIdKey);
    if (id == null) {
      id = const Uuid().v4();
      await prefs.setString(_deviceIdKey, id);
    }
    _deviceId = id;
    
    // Fetch Device Name
    DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    try {
      if (Platform.isAndroid) {
        AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
        _deviceName = androidInfo.model;
      } else if (Platform.isIOS) {
        IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
        _deviceName = iosInfo.utsname.machine;
      } else if (Platform.isMacOS) {
        MacOsDeviceInfo macInfo = await deviceInfo.macOsInfo;
        _deviceName = macInfo.computerName;
      } else if (Platform.isLinux) {
        LinuxDeviceInfo linuxInfo = await deviceInfo.linuxInfo;
        _deviceName = linuxInfo.name;
      } else if (Platform.isWindows) {
        WindowsDeviceInfo winInfo = await deviceInfo.windowsInfo;
        _deviceName = winInfo.computerName;
      }
    } catch (e) {
      _deviceName = 'Generic Device';
    }

    // Default server if none exists or first launch 
    // (Optional: remove this if you want strictly empty start)
    if (_servers.isEmpty) {
       // _servers.add(ServerConfig(name: 'Localhost', ip: 'localhost:3000', apiKey: ''));
    }

    final int? activeIndex = prefs.getInt(_activeServerKey);
    if (activeIndex != null && activeIndex >= 0 && activeIndex < _servers.length) {
      _activeServer = _servers[activeIndex];
    } else if (_servers.isNotEmpty) {
      _activeServer = _servers.first;
    }
  }

  Future<void> addServer(ServerConfig server) async {
    _servers.add(server);
    await _saveServers();
    if (_activeServer == null) {
      await setActiveServer(server);
    }
  }

  Future<void> removeServer(ServerConfig server) async {
    _servers.removeWhere((s) => s.name == server.name && s.ip == server.ip);
    await _saveServers();
    if (_activeServer == server) {
      if (_servers.isNotEmpty) {
        await setActiveServer(_servers.first);
      } else {
        _activeServer = null;
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_activeServerKey);
        onServerChanged?.call();
      }
    }
  }

  Future<void> setActiveServer(ServerConfig server) async {
    _activeServer = server;
    final index = _servers.indexOf(server);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_activeServerKey, index);
    onServerChanged?.call();
  }

  Future<void> _saveServers() async {
    final prefs = await SharedPreferences.getInstance();
    final String encoded = json.encode(_servers.map((s) => s.toJson()).toList());
    await prefs.setString(_serversKey, encoded);
  }
}
