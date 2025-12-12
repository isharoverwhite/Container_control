class ContainerModel {
  final String id;
  final List<String> names;
  final String image;
  final String state;
  final String status;

  ContainerModel({
    required this.id,
    required this.names,
    required this.image,
    required this.state,
    required this.status,
  });

  factory ContainerModel.fromJson(Map<String, dynamic> json) {
    return ContainerModel(
      id: json['Id'] ?? '',
      names: List<String>.from(json['Names'] ?? []),
      image: json['Image'] ?? '',
      state: json['State'] ?? '',
      status: json['Status'] ?? '',
    );
  }
}
