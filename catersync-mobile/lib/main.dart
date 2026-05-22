import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  import 'package:flutter/material.dart';
  import 'config/theme.dart';
  import 'app.dart';

  void main() {
    WidgetsFlutterBinding.ensureInitialized();
    runApp(const CaterSyncApp());
  }

  // Entrypoint delegates to app.dart which sets up routing and theming.
        // try changing the seedColor in the colorScheme below to Colors.green
