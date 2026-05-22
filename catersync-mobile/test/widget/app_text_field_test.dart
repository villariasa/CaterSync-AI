import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:catersync_mobile/shared/widgets/app_text_field.dart';

void main() {
  testWidgets('AppTextField accepts input', (WidgetTester tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: AppTextField(controller: controller, hintText: 'Enter'))));
    await tester.enterText(find.byType(TextField), 'hello');
    expect(controller.text, 'hello');
  });
}
