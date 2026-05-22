# Design System Overview

This document summarizes the core design tokens and usage for the CaterSync Phase 3 frontend.

Tokens
------
- Colors: see `design_tokens.json`
- Typography: Inter (or system fallback), scales in tokens
- Spacing: 4 / 8 / 16 / 24 / 32 spacing units
- Radii: 4/8/12

Components
----------
- Buttons: primary, secondary, ghost, destructive — states: default, hover, pressed, disabled
- Inputs: text, password, select, date, time — error and help states
- Cards: used for KPI, booking list items, inventory entries
- Tables: pagination, sortable columns, row actions
- Modals: header, content, footer actions
- Nav: bottom nav (mobile), side nav (web)

Motion
------
- Standard durations: 200ms (short), 300ms (medium), 500ms (long)
- Easing: cubic-bezier(0.25, 0.1, 0.25, 1)

Accessibility
-------------
- Ensure text color contrast >= WCAG AA for normal text.
- Provide semantic labels for interactive controls.

Developer Notes
---------------
- Tokens JSON is the source of truth for runtime theming.
- Component names in Figma should map to Flutter widget names.
