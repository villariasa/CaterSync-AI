import 'package:flutter/material.dart';

class CommunicationCenter extends StatelessWidget {
  const CommunicationCenter({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Communication')),
      body: ListView(
        children: const [
          ListTile(title: Text('Inbox')), 
          ListTile(title: Text('Templates')),
          ListTile(title: Text('Broadcasts')),
        ],
      ),
    );
  }
}
