import 'package:flutter/material.dart';

class SuperAdminPage extends StatelessWidget {
  const SuperAdminPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Super Admin')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: const [
            ListTile(title: Text('Tenants')),
            ListTile(title: Text('Subscriptions')),
            ListTile(title: Text('Activity Logs')),
          ],
        ),
      ),
    );
  }
}
