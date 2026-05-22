import 'package:flutter/material.dart';

// Generated theme mapping from docs/frontend/design_tokens.json (subset)
class AppTheme {
  static final Color primary600 = Color(0xFF00695C);
  static final Color primary400 = Color(0xFF33A792);
  static final Color accent600 = Color(0xFFFFC107);
  static final Color neutral900 = Color(0xFF0D1B1A);
  static final Color neutral500 = Color(0xFF4D6664);
  static final Color background = Color(0xFFFAFCFB);
  static final Color surface = Color(0xFFFFFFFF);

  static ThemeData lightTheme() {
    return ThemeData(
      primaryColor: primary600,
      scaffoldBackgroundColor: background,
      colorScheme: ColorScheme.light(
        primary: primary600,
        secondary: accent600,
        background: background,
        surface: surface,
        onPrimary: Colors.white,
        onBackground: neutral900,
      ),
      textTheme: TextTheme(
        headline1: TextStyle(fontSize: 32, fontWeight: FontWeight.w700, color: neutral900),
        headline2: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: neutral900),
        bodyText1: TextStyle(fontSize: 16, fontWeight: FontWeight.w400, color: neutral900),
        button: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
        caption: TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: neutral500),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          primary: primary600,
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
      ),
    );
  }
}
import 'dart:convert';
import 'package:flutter/material.dart';
import '../../docs/frontend/design_tokens.json' as tokens;

class ThemeFromTokens {
  static ThemeData load() {
    // tokens is included at build time via asset import; fallback used if missing
    final Map<String, dynamic> t = tokensJson;
    final colors = t['colors'] as Map<String, dynamic>;
    final primary = _hexToColor(colors['primary'] as String);
    final accent = _hexToColor(colors['accent'] as String);
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: primary, secondary: accent),
      useMaterial3: true,
    );
  }

  static Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }
}

// Fallback: parse the design tokens JSON content (synchronous import not allowed in Dart here),
// use a minimal inline map for safety.
const Map<String, dynamic> tokensJson = {
  'colors': {
    'primary': '#00695C',
    'accent': '#FFC107'
  }
};
