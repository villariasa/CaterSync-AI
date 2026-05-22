import 'dart:convert';

class Branding {
  final String name;
  final String primaryColor;

  Branding({required this.name, required this.primaryColor});

  factory Branding.fromJson(Map<String, dynamic> json) => Branding(
        name: json['name'] ?? 'Tenant',
        primaryColor: json['primaryColor'] ?? '#00695C',
      );
}

/// Simple branding loader (stub). Real implementation should fetch from backend.
Future<Branding> loadBrandingForTenant(String tenantId) async {
  await Future.delayed(const Duration(milliseconds: 200));
  // Return a sample branding for now.
  final sample = '{"name":"Demo Tenant","primaryColor":"#00695C"}';
  return Branding.fromJson((jsonDecode(sample) as Map<String, dynamic>));
}
