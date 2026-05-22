import 'package:flutter/material.dart';

class BookingListPage extends StatelessWidget {
  const BookingListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bookings')),
      body: ListView.builder(
        padding: const EdgeInsets.all(8),
        itemCount: 8,
        itemBuilder: (context, i) => Card(
          child: ListTile(
            title: Text('Booking #${i + 1}'),
            subtitle: const Text('Event details and date'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {},
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        child: const Icon(Icons.add),
      ),
    );
  }
}
