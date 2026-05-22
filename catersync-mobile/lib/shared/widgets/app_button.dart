import 'package:flutter/material.dart';

class AppButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final bool primary;

  const AppButton.primary({required this.onPressed, required this.child, super.key}) : primary = true;
  const AppButton.secondary({required this.onPressed, required this.child, super.key}) : primary = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary ? theme.colorScheme.primary : theme.colorScheme.secondary,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      onPressed: onPressed,
      child: child,
    );
  }
}
