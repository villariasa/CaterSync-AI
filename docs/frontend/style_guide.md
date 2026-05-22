# CaterSync Frontend Style Guide

This guide provides implementation-ready rules for developers and precision guidance for designers. Tokens live in `design_tokens.json` and should be the single source of truth.

Color tokens
------------
- Use token names (e.g., `primary-600`, `neutral-900`, `surface`, `background`).
- Semantic usage:
	- Primary: `primary-600` (buttons, primary CTA)
	- Accent: `accent-600` (highlights, badges)
	- Surface: `surface` (cards, panels)
	- Background: `background` (app background)
	- Text primary: `neutral-900`, text secondary: `neutral-500`

Typography
----------
- Font family: `Inter` (variable or static weights permitted).
- Token names: `display`, `h1`, `h2`, `h3`, `body`, `button`, `caption`.
- Line height and weight are part of the token; do not rescale arbitrarily.

Spacing & layout
-----------------
- Base unit: `space-4` (4px). Use multiples for rhythm (8, 12, 16, 24, 32).
- Grid: 8px column grid for page layouts; mobile margins use `space-16`.

Corner radii & elevation
-------------------------
- Radii: `radius-sm`, `radius-md`, `radius-lg`, `radius-full`.
- Elevation tokens: `elevation-1`, `elevation-2`, `elevation-3`. Use for surface layering.

Component mapping (design → Flutter)
------------------------------------
- AppButton → `AppButton` widget
	- Variants: `primary`, `secondary`, `ghost`, `icon`.
	- States: default, hover, focused, pressed, disabled.

- AppTextField → `AppTextField`
	- Include floating label, helper text, error state, and accessibility description.

- KpiCard → `KpiCard` / `CompactKpiCard`
	- Provide numeric value, label, optional sparkline (SVG path), delta chip.

- SimpleDataTable / PagedDataTable → `SimpleDataTable`, `PagedDataTable`
	- Use consistent row height, header typography, and alternating row surfaces if necessary.

Icons & assets
---------------
- Store optimized SVGs in `assets/icons/svg/` and 2x PNG fallbacks in `assets/icons/png/`.
- File names: kebab-case, matching component usage (e.g., `icon-search.svg`).

Generating the PDF style guide
------------------------------
Prerequisite: `pandoc` (and optionally `wkhtmltopdf` for advanced rendering).

From the `docs/frontend` directory run:

```bash
pandoc style_guide.md -o style_guide.pdf --pdf-engine=wkhtmltopdf
```

Runtime theme mapping (Flutter)
--------------------------------
Below is a suggested snippet to convert `design_tokens.json` into Flutter `ThemeData`. Place this in `catersync-mobile/lib/shared/theme_from_tokens.dart` and adjust imports as needed.

```dart
// Generated helper (partial) — maps a subset of tokens into ThemeData
import 'package:flutter/material.dart';

class AppTheme {
	static ThemeData fromTokens(Map<String, dynamic> tokens) {
		final colors = tokens['color'] as Map<String, dynamic>;
		final typography = tokens['typography'] as Map<String, dynamic>;

		Color primary = _hex(colors['primary-600']);
		Color background = _hex(colors['background']);

		return ThemeData(
			primaryColor: primary,
			scaffoldBackgroundColor: background,
			textTheme: TextTheme(
				headline1: _typography(typography['h1']),
				bodyText1: _typography(typography['body']),
				button: _typography(typography['button']),
			),
			elevatedButtonTheme: ElevatedButtonThemeData(
				style: ElevatedButton.styleFrom(primary: primary),
			),
		);
	}

	static TextStyle _typography(Map t) => TextStyle(
				fontSize: (t['fontSize'] as num).toDouble(),
				fontWeight: FontWeight.values[(t['fontWeight'] as int) ~/ 100 - 1],
				height: (t['lineHeight'] as num) / (t['fontSize'] as num),
			);

	static Color _hex(String s) => Color(int.parse(s.replaceFirst('#', '0xFF')));
}
```

Handoff checklist (developer-ready)
----------------------------------
- Figma file link + exported ZIP containing `icons/svg/`, `icons/png/`, and the final `design_tokens.json`.
- Annotated components with variant descriptions and interaction notes.

If you'd like, I can also generate the `theme_from_tokens.dart` file directly from the tokens in this repo and add a sample icon set into `assets/icons/`.
