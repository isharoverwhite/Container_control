class ServerConfig {
  final String name;
  final String ip; // includes port e.g. 192.168.1.1:3000
  final String apiKey;

  ServerConfig({
    required this.name,
    required this.ip,
    required this.apiKey,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'ip': ip,
      'apiKey': apiKey,
    };
  }

  factory ServerConfig.fromJson(Map<String, dynamic> json) {
    return ServerConfig(
      name: json['name'] as String,
      ip: json['ip'] as String,
      apiKey: json['apiKey'] as String,
    );
  }
}
