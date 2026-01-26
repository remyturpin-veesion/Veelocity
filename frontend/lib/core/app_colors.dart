import 'package:flutter/material.dart';

/// Extension to get theme-aware color variants.
extension ThemeAwareColor on Color {
  /// Returns a readable text color variant based on theme brightness.
  /// In light mode: darker shade for contrast on light backgrounds.
  /// In dark mode: lighter shade for contrast on dark backgrounds.
  Color textVariant(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hsl = HSLColor.fromColor(this);

    if (isDark) {
      // Lighten for dark mode (increase lightness)
      return hsl.withLightness((hsl.lightness + 0.2).clamp(0.3, 0.8)).toColor();
    } else {
      // Darken for light mode (decrease lightness)
      return hsl.withLightness((hsl.lightness - 0.2).clamp(0.2, 0.7)).toColor();
    }
  }

  /// Returns a background color variant (always subtle).
  Color backgroundVariant(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return withValues(alpha: isDark ? 0.2 : 0.1);
  }

  /// Returns a border color variant.
  Color borderVariant(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return withValues(alpha: isDark ? 0.4 : 0.3);
  }
}
