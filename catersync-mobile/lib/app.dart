import 'package:flutter/material.dart';
import 'config/theme.dart';
import 'config/routes.dart';
import 'features/authentication/presentation/pages/login_page.dart';
import 'features/authentication/presentation/pages/onboarding_page.dart';
import 'features/booking/presentation/pages/booking_list_page.dart';
import 'features/qr/presentation/pages/qr_scanner_page.dart';
import 'features/admin/presentation/pages/admin_home_page.dart';
import 'features/analytics/presentation/pages/analytics_dashboard.dart';
import 'features/communication/presentation/pages/communication_center.dart';
import 'features/super_admin/presentation/pages/super_admin_page.dart';

class CaterSyncApp extends StatelessWidget {
  const CaterSyncApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CaterSync',
      theme: AppTheme.lightTheme,
      initialRoute: Routes.onboarding,
      routes: {
        Routes.onboarding: (c) => const OnboardingPage(),
        Routes.login: (c) => const LoginPage(),
        Routes.bookings: (c) => const BookingListPage(),
        Routes.qrScanner: (c) => const QRScannerPage(),
        Routes.adminHome: (c) => const AdminHomePage(),
        Routes.analytics: (c) => const AnalyticsDashboard(),
        Routes.communication: (c) => const CommunicationCenter(),
        Routes.superAdmin: (c) => const SuperAdminPage(),
      },
    );
  }
}
