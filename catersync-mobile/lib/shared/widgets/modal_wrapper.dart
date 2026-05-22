import 'package:flutter/material.dart';

class AppModal {
  static Future<T?> show<T>({required BuildContext context, required Widget child, bool dismissible = true}) {
    return showDialog<T>(
      context: context,
      barrierDismissible: dismissible,
      builder: (ctx) => Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: child,
      ),
    );
  }
}
