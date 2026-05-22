import 'package:flutter/material.dart';

class PagedDataTable<T> extends StatefulWidget {
  final List<T> items;
  final int rowsPerPage;
  final Widget Function(BuildContext, T) rowBuilder;

  const PagedDataTable({super.key, required this.items, this.rowsPerPage = 5, required this.rowBuilder});

  @override
  State<PagedDataTable<T>> createState() => _PagedDataTableState<T>();
}

class _PagedDataTableState<T> extends State<PagedDataTable<T>> {
  int page = 0;

  @override
  Widget build(BuildContext context) {
    final totalPages = (widget.items.length / widget.rowsPerPage).ceil();
    final start = page * widget.rowsPerPage;
    final end = (start + widget.rowsPerPage).clamp(0, widget.items.length);
    final pageItems = widget.items.sublist(start, end);

    return Column(
      children: [
        ...pageItems.map((e) => widget.rowBuilder(context, e)),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Text('Page ${page + 1} of $totalPages'),
            IconButton(
                onPressed: page > 0 ? () => setState(() => page--) : null,
                icon: const Icon(Icons.chevron_left)),
            IconButton(
                onPressed: page < totalPages - 1 ? () => setState(() => page++) : null,
                icon: const Icon(Icons.chevron_right)),
          ],
        )
      ],
    );
  }
}
