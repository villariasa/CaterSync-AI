# Designer Handoff Checklist (Figma-ready)

Use this checklist when creating the CaterSync Phase 3 Figma project. Follow the naming rules exactly — component names must match Flutter widget names to make the handoff frictionless.

- Project structure
  - [ ] File: "CaterSync / Phase 3"
  - [ ] Pages: Design System, Mobile Screens, Admin Screens, Exports

- Design system (tokens)
  - [ ] Import `design_tokens.json` into the Figma Tokens plugin
  - [ ] Create color styles that mirror token names (e.g., `primary-600`, `primary-400`, `neutral-900`)
  - [ ] Create text styles for each token (Display, H1, H2, Body, Small)
  - [ ] Create a spacing scale using token names (`space-4`, `space-8`, `space-12`, `space-16`, `space-24`, `space-32`)
  - [ ] Create radius tokens and elevation styles that reference token names

- Components (exact Flutter widget names)
  - [ ] AppButton (primary / secondary / ghost) — include variants for hover/focus/pressed/disabled
  - [ ] AppTextField (default / error / disabled) — include label, helper, and error states
  - [ ] KpiCard, CompactKpiCard, ExpandedKpiCard — show data + sparkline variants
  - [ ] SimpleDataTable, PagedDataTable — include header sorting and row actions
  - [ ] CalendarView (month) — day cells, selected, range, disabled
  - [ ] AppModal (small / medium / full) — include backdrop and close behaviour
  - [ ] NavigationBar (mobile bottom) and AppSidebar (admin) — include collapse states

- Screens
  - [ ] Mobile: Onboarding, Login, BookingList, BookingDetails, QRScanner, Checkout
  - [ ] Admin: AdminHome, AnalyticsDashboard, BookingsTable, Inventory
  - For each screen provide: component inventory, responsive notes, and behavior spec.

- Exports
  - [ ] Export icons as SVG at 24px and 48px
  - [ ] Export PNG fallback at 2x for mobile usage
  - [ ] Place all exports under the `Exports` page and produce a single ZIP with: `icons/svg/`, `icons/png/`, `design_tokens.json`, `README.md` with usage rules

- Accessibility
  - [ ] Verify contrast ratios >= 4.5:1 for body text and >= 3:1 for large text
  - [ ] Provide visible focus states for keyboard navigation
  - [ ] Add semantic labels in component descriptions and form-field hints

Handoff notes
 - Add a short handoff summary on the Design System page: what changed, token updates, and any micro-interactions.
 - Tag the developer or open a PR attaching the exports ZIP and linking the Figma file.

Naming rules (required)
 - Components: PascalCase matching Flutter widgets (e.g., `AppButton`, `KpiCard`).
 - Tokens: kebab-case grouped by type (e.g., `primary-600`, `space-16`).

Check items in Figma as you complete them. The development team will replace `design_tokens.json` with the final exported tokens if updated.
