import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:catersync_mobile/shared/widgets/data_table_paging.dart';

void main() {
  testWidgets('PagedDataTable paginates items', (WidgetTester tester) async {
    final items = List.generate(12, (i) => 'Item $i');
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: PagedDataTable<String>(
          items: items,
          rowsPerPage: 5,
          rowBuilder: (ctx, s) => ListTile(title: Text(s)),
        ),
      ),
    ));

    expect(find.text('Item 0'), findsOneWidget);
    // navigate to next page
    await tester.tap(find.byIcon(Icons.chevron_right));
    await tester.pumpAndSettle();
    expect(find.text('Item 5'), findsOneWidget);
  });
}
