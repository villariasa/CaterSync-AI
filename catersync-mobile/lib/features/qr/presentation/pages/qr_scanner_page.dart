import 'package:flutter/material.dart';

class QRScannerPage extends StatelessWidget {
  const QRScannerPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QR Scanner')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.qr_code_scanner, size: 96),
            SizedBox(height: 12),
            Text('QR scanning available on mobile devices (stub).')
          ],
        ),
      ),
    );
  }
}
