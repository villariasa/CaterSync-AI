import 'package:flutter/material.dart';

class AnalyticsDashboard extends StatelessWidget {
  const AnalyticsDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Card(
              child: ListTile(
                title: const Text('Revenue (30d)'),
                subtitle: const Text('\$12,345'),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                title: const Text('Bookings (30d)'),
                subtitle: const Text('128'),
              ),
            ),
            const SizedBox(height: 12),
            Expanded(child: Center(child: Text('Charts go here (fl_chart)'))),
          ],
        ),
      ),
    );
  }
}
