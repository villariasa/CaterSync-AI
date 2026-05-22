import 'package:flutter/material.dart';

class KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final Widget? icon;
  final double? trend; // positive for up, negative for down

  const KpiCard({super.key, required this.title, required this.value, this.subtitle = '', this.icon, this.trend});

  @override
  Widget build(BuildContext context) {
    final trendColor = (trend ?? 0) >= 0 ? Colors.green : Colors.red;
    final trendText = (trend == null) ? '' : '${trend! >= 0 ? '+' : ''}${trend!.toStringAsFixed(1)}%';

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          children: [
            if (icon != null) ...[icon!, const SizedBox(width: 12)],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.caption),
                  const SizedBox(height: 6),
                  Text(value, style: Theme.of(context).textTheme.headline6),
                  if (subtitle.isNotEmpty) ...[const SizedBox(height: 6), Text(subtitle, style: Theme.of(context).textTheme.bodyText2)],
                ],
              ),
            ),
            if (trend != null)
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(trend! >= 0 ? Icons.arrow_upward : Icons.arrow_downward, color: trendColor, size: 18),
                  const SizedBox(height: 4),
                  Text(trendText, style: TextStyle(color: trendColor, fontWeight: FontWeight.bold)),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
