import 'package:flutter/material.dart';

/// App theme configuration for light and dark modes.
class AppTheme {
  static const _seedColor = Color(0xFF1E3A5F);

  /// Light theme configuration.
  static ThemeData light() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: _seedColor,
        brightness: Brightness.light,
      ),
      useMaterial3: true,
    );
  }

  /// Dark theme configuration.
  static ThemeData dark() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: _seedColor,
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
    );
  }
}
