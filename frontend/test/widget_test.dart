import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:veelocity/main.dart';

void main() {
  testWidgets('VeelocityApp shows welcome screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: VeelocityApp()));

    expect(find.text('Veelocity'), findsOneWidget);
    expect(find.text('Welcome to Veelocity'), findsOneWidget);
    expect(find.text('Developer Analytics Platform'), findsOneWidget);
    expect(find.byIcon(Icons.analytics_outlined), findsOneWidget);
  });
}
