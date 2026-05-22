import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CalendarView extends StatefulWidget {
  final DateTime? initialDate;

  const CalendarView({super.key, this.initialDate});

  @override
  State<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends State<CalendarView> {
  late DateTime displayed;

  @override
  void initState() {
    super.initState();
    displayed = widget.initialDate ?? DateTime.now();
  }

  void _prevMonth() {
    setState(() => displayed = DateTime(displayed.year, displayed.month - 1));
  }

  void _nextMonth() {
    setState(() => displayed = DateTime(displayed.year, displayed.month + 1));
  }

  @override
  Widget build(BuildContext context) {
    final firstDayOfMonth = DateTime(displayed.year, displayed.month, 1);
    final weekdayOffset = firstDayOfMonth.weekday % 7; // make Sunday=0
    final daysInMonth = DateUtils.getDaysInMonth(displayed.year, displayed.month);

    final rows = <TableRow>[];
    // header
    rows.add(TableRow(children: List.generate(7, (i) => Center(child: Text(DateFormat.E().format(DateTime(2020,1, i+5)))))));

    int day = 1 - weekdayOffset;
    while (day <= daysInMonth) {
      final cells = List<Widget>.generate(7, (i) {
        final d = day + i;
        if (d < 1 || d > daysInMonth) return const SizedBox.shrink();
        return GestureDetector(
          onTap: () {},
          child: Container(
            padding: const EdgeInsets.all(8),
            child: Center(child: Text('$d')),
          ),
        );
      });
      rows.add(TableRow(children: cells));
      day += 7;
    }

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(onPressed: _prevMonth, icon: const Icon(Icons.chevron_left)),
            Text(DateFormat.yMMMM().format(displayed), style: Theme.of(context).textTheme.subtitle1),
            IconButton(onPressed: _nextMonth, icon: const Icon(Icons.chevron_right)),
          ],
        ),
        Table(children: rows),
      ],
    );
  }
}
