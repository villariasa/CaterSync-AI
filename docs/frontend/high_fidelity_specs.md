# High-Fidelity Pixel Specs — Designer → Developer Handoff

Purpose: provide pixel-accurate, implementation-ready specifications and component annotations. Designers should use the Design System page in Figma and this spec as the single source of truth for dimensions, spacing, and responsive behavior.

Global artboards
---------------
- Mobile reference: 360 x 800 (safe area); artboard master: 390 x 844 for preview (iPhone 14 Pro)
- Tablet reference: 1024 x 768
- Desktop reference: 1440 x 1024

Layout & spacing
-----------------
- Base unit: `space-4` (4px). Use scale: 4, 8, 12, 16, 24, 32, 40.
- Gutter: 16px on mobile, 24px on tablet, 32px on desktop. Columns: 4 (mobile), 8 (tablet), 12 (desktop).

Navigation
----------
- Mobile bottom navigation: height 72px, icon size 24px, label 12/600.
- Admin sidebar: collapsed width 72px, expanded width 260px, icon size 20px.

Top-level components (pixel specs)
---------------------------------
- AppButton
	- Height: 48px (primary), 40px (compact)
	- Horizontal padding: `space-16` (16px)
	- Corner radius: `radius-md` (8px)
	- Typography: `button` token

- AppTextField
	- Height: 56px
	- Label: 12/600 (caption style)
	- Error text: 12/400 red token; 8px spacing from input

- KpiCard
	- Desktop size: 320 x 120 (standard)
	- Mobile (compact): full-width, height 96
	- Padding: `space-16`
	- Sparkline area: 64 x 28 (SVG path)

- SimpleDataTable / PagedDataTable
	- Row height: 56px
	- Header: 56px, label typography `button`/600
	- Responsive: collapse lower-priority columns into an overflow menu; mark priorities in Figma.

Screens (what to include in Figma)
---------------------------------
- For every screen provide:
	- Artboard (mobile/tablet/desktop where applicable)
	- Component inventory (list of components used)
	- Exportable assets grouped by type
	- Interaction notes (micro-interactions, transitions, loading states)

- Mobile screens to deliver:
	- Onboarding, Login, BookingList, BookingDetails, QRScanner, Checkout

- Admin screens to deliver:
	- AdminHome, AnalyticsDashboard, BookingsTable, Inventory

Iconography and illustrations
-----------------------------
- Icons: export as SVG at 24px and 48px; filename kebab-case (e.g., `icon-search.svg`).
- PNG fallbacks: export raster PNGs at 2x for mobile where SVG support is not guaranteed.

Exports & packaging
-------------------
- On the `Exports` page include a single ZIP with:
	- `icons/svg/` — all SVG icons
	- `icons/png/` — 2x PNG fallbacks
	- `tokens/` — `design_tokens.json` (final)
	- `README.md` — short usage rules (naming, sizes, when to use PNG)

Accessibility
-------------
- Contrast: body text >= 4.5:1; large text >= 3:1. Mark any exceptions with rationale.
- Focus states: visible focus rectangle or ring for all interactive controls, 3px minimum visual thickness.
- Labels: every input must include a visible label and an accessibility hint in the component metadata.

Developer hints
---------------
- Component names MUST match Flutter widget names exactly. This enables direct mapping when implementing the `catersync-mobile` UI.
- Token sync: when tokens change in Figma export the tokens JSON and open a PR replacing `docs/frontend/design_tokens.json`.
- Asset placement: pull `icons/svg/` into `assets/icons/svg/` and PNGs into `assets/icons/png/`.

Notes
-----
- Export SVGs with cleaned IDs and no embedded fonts.
- When you export charts use a raster PNG thumbnail and provide raw data if developers need to recreate charts.
