import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/server_config.dart';

class ServerManager {
  static final ServerManager _instance = ServerManager._internal();
  factory ServerManager() => _instance;
  ServerManager._internal();

  List<ServerConfig> _servers = [];
  ServerConfig? _activeServer;

  List<ServerConfig> get servers => List.unmodifiable(_servers);
  ServerConfig? get activeServer => _activeServer;

  static const String _serversKey = 'saved_servers';
  static const String _activeServerKey = 'active_server_index';

  Function()? onServerChanged;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final String? serversJson = prefs.getString(_serversKey);
    
    if (serversJson != null) {
      final List<dynamic> decoded = json.decode(serversJson);
      _servers = decoded.map((json) => ServerConfig.fromJson(json)).toList();
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
