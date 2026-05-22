import 'package:flutter/material.dart';
import '../../../../../config/routes.dart';

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 24),
            TextField(decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 12),
            TextField(decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => Navigator.pushReplacementNamed(context, Routes.bookings),
              child: const Text('Sign in'),
            ),
            TextButton(
              onPressed: () => Navigator.pushNamed(context, Routes.onboarding),
              child: const Text('Back to onboarding'),
            )
          ],
        ),
      ),
    );
  }
}
