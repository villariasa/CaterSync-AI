import 'package:flutter/material.dart';

class SimpleDataTable extends StatelessWidget {
  final List<Map<String, String>> rows;

  const SimpleDataTable({super.key, required this.rows});

  @override
  Widget build(BuildContext context) {
    final columns = rows.isNotEmpty ? rows.first.keys.toList() : <String>[];
    return Card(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: columns.map((c) => DataColumn(label: Text(c))).toList(),
          rows: rows
              .map((r) => DataRow(cells: columns.map((c) => DataCell(Text(r[c] ?? ''))).toList()))
              .toList(),
        ),
      ),
    );
  }
}
