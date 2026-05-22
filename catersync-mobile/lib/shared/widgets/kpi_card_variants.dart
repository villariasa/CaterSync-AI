import 'package:flutter/material.dart';
import 'kpi_card.dart';

class CompactKpiCard extends StatelessWidget {
  final String title;
  final String value;
  final double? trend;

  const CompactKpiCard({super.key, required this.title, required this.value, this.trend});

  @override
  Widget build(BuildContext context) {
    final trendColor = (trend ?? 0) >= 0 ? Colors.green : Colors.red;
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.caption),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(value, style: Theme.of(context).textTheme.headline6),
              const SizedBox(width: 8),
              if (trend != null)
                Text('${trend! >= 0 ? '+' : ''}${trend!.toStringAsFixed(1)}%', style: TextStyle(color: trendColor)),
            ],
          ),
        ],
      ),
    );
  }
}

class ExpandedKpiCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final double? trend;

  const ExpandedKpiCard({super.key, required this.title, required this.value, this.subtitle = '', this.trend});

  @override
  Widget build(BuildContext context) {
    return KpiCard(title: title, value: value, subtitle: subtitle, trend: trend);
  }
}
