import 'package:flutter/material.dart';
import '../shared/widgets/app_button.dart';
import '../shared/widgets/app_text_field.dart';
import '../shared/widgets/kpi_card.dart';
import '../shared/widgets/data_table_widget.dart';

class WidgetGallery extends StatelessWidget {
  const WidgetGallery({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Component Gallery')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: ListView(
          children: [
            const Text('Buttons', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(children: [
              AppButton.primary(onPressed: () {}, child: const Text('Primary')),
              const SizedBox(width: 12),
              AppButton.secondary(onPressed: () {}, child: const Text('Secondary')),
            ]),
            const SizedBox(height: 24),
            const Text('Form fields', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const AppTextField(label: 'Email'),
            const SizedBox(height: 12),
            const AppTextField(label: 'Password', obscureText: true),
            const SizedBox(height: 24),
            const Text('KPI Cards', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(children: const [
              Expanded(child: KpiCard(title: 'Revenue', value: '\$12,345', subtitle: 'Last 30 days', trend: 4.3)),
              SizedBox(width: 12),
              Expanded(child: KpiCard(title: 'Bookings', value: '128', subtitle: 'Last 30 days', trend: -1.2)),
            ]),
            const SizedBox(height: 24),
            const Text('Data Table', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SimpleDataTable(rows: [
              {'ID': 'BKG-001', 'Customer': 'Acme Co', 'Date': '2026-06-01', 'Status': 'Confirmed'},
              {'ID': 'BKG-002', 'Customer': 'Blue Catering', 'Date': '2026-06-05', 'Status': 'Pending'},
              {'ID': 'BKG-003', 'Customer': 'Sea Foods', 'Date': '2026-06-12', 'Status': 'Cancelled'},
            ]),
          ],
        ),
      ),
    );
  }
}
