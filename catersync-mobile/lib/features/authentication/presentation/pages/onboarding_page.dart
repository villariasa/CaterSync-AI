import 'package:flutter/material.dart';
import '../../../../../config/routes.dart';

class OnboardingPage extends StatelessWidget {
  const OnboardingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 48),
            const Text('Welcome to CaterSync', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24.0),
              child: Text('Modernize your catering business with bookings, inventory, and analytics.'),
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: ElevatedButton(
                onPressed: () => Navigator.pushReplacementNamed(context, Routes.login),
                child: const Text('Get started'),
              ),
            )
          ],
        ),
      ),
    );
  }
}
