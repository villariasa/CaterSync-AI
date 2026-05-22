import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:catersync_mobile/shared/widgets/kpi_card.dart';

void main() {
  testWidgets('KpiCard shows title and value', (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: KpiCard(title: 'Revenue', value: '\$1,234', subtitle: 'Monthly', trend: 3.2))));
    expect(find.text('Revenue'), findsOneWidget);
    expect(find.text('\$1,234'), findsOneWidget);
  });
}
