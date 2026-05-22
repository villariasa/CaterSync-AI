import 'package:flutter/material.dart';

class AppTheme {
  static final Color primary = const Color(0xFF00695C);
  static final Color accent = const Color(0xFFFFC107);

  static final ThemeData lightTheme = ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: primary, secondary: accent),
    useMaterial3: true,
    scaffoldBackgroundColor: Colors.white,
    appBarTheme: const AppBarTheme(elevation: 0),
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );
}
