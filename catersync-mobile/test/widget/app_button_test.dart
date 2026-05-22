import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:catersync_mobile/shared/widgets/app_button.dart';

void main() {
  testWidgets('AppButton renders and responds', (WidgetTester tester) async {
    var pressed = false;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: AppButton(label: 'Tap', onPressed: () { pressed = true; }))));
    expect(find.text('Tap'), findsOneWidget);
    await tester.tap(find.text('Tap'));
    await tester.pumpAndSettle();
    expect(pressed, isTrue);
  });
}
