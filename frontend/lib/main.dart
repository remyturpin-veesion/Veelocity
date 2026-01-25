import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/app_shell.dart';

void main() {
  runApp(const ProviderScope(child: VeelocityApp()));
}

class VeelocityApp extends StatelessWidget {
  const VeelocityApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Veelocity',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3A5F),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const AppShell(),
    );
  }
}
