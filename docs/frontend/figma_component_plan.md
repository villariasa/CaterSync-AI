# Figma & Component Library Plan — Phase 3

Objective
---------
Deliver human-authored (non-AI) Figma designs and a pixel-perfect Flutter component library that implements Phase 3 UI requirements (mobile + web/admin). Provide an explicit handoff package so developers can implement production-ready screens and assets.

Scope
-----
- Create design brief and constraints
- Build design system (tokens: color, type, spacing, motion)
- Produce high-fidelity screens for key flows (mobile & web)
- Implement a Flutter component library matching Figma
- Export assets and provide developer handoff docs
- Accessibility review and QA

Deliverables
------------
- `Figma brief` (PDF and Figma project link)
- `Design System` file in Figma and tokens JSON
- High-fidelity screens (mobile + admin web) in Figma
- `lib/shared/widgets/` Flutter component library with examples
- Asset exports: SVG icons, PNGs, fonts, style-guide.pdf
- Handoff doc: `docs/frontend/implementation.md` mapping components↔API
- Accessibility QA checklist and fixes

Timeline & Estimates
--------------------
- Phase A — Figma brief: 1 day
- Phase B — Design system & tokens: 2 days
- Phase C — High-fidelity screens: 5–8 days
- Phase D — Flutter component library: 4–6 days
- Phase E — Asset export & handoff: 1 day
- Phase F — Accessibility review & QA: 1–2 days

Total estimate: ~14–19 workdays (parallelize design and dev where possible).

Detailed Steps
--------------
1. Create Figma design brief
   - Objectives, user personas, priority flows, target devices and breakpoints, brand rules, accessibility requirements, licensing rules for icons/images.
   - Deliver: `FigmaBrief.pdf` + Figma project skeleton.

2. Design system & tokens
   - Define color palette with WCAG AA contrast checks, typography scale, spacing system (4/8pt grid), elevation, corner radii, iconography style, motion guidelines.
   - Create token export (JSON) for runtime theming.
   - Deliver: `DesignSystem.fig` + `tokens.json`.

3. High-fidelity screens
   - Prioritize flows: onboarding, auth, booking search/detail/checkout/ticket, admin booking list/calendar/detail, inventory list, analytics dashboard (KPI + charts), communication center, super-admin tenant screens.
   - Build reusable components (buttons, forms, cards, tables, modals, toasts), responsive variants and states.
   - Deliver: Figma screens, component library in Figma, interaction specs.

4. Component library implementation (Flutter)
   - Create `lib/shared/widgets/` and implement components matching tokens: `AppButton`, `AppTextField`, `AppCard`, `DataTable`, `CalendarView`, `KpiCard`, `AppModal`, `Avatar`.
   - Implement `theme_from_tokens.dart` that consumes `tokens.json` and exposes `ThemeData` factory.
   - Provide example pages / storybook-like gallery under `lib/examples/`.
   - Include unit/widget tests for core widgets.

5. Export assets & developer handoff
   - Export SVG icons and optimized image assets; provide accessible alt text and usage notes.
   - Create `docs/frontend/implementation.md` mapping Figma components to Flutter widgets and API endpoints required for data.

6. Accessibility review & QA
   - Run color contrast checks, keyboard navigation tests (web), screen reader labels, focus order.
   - Fix accessibility issues and produce a QA checklist.

Acceptance Criteria
-------------------
- Figma screens approved and componentized with named tokens
- Tokens JSON imported in Flutter produces visually matching components within 8px tolerance
- All exported assets are optimized and licensed
- Core flows (auth, booking, admin list, analytics KPI) implemented in Flutter and runnable on mobile + web
- Accessibility: color contrast >= AA, keyboard navigation on web, semantic labels present

Developer Integration Notes
---------------------------
- Keep Figma layer and component names consistent with Flutter widget names to ease handoff.
- Use `flutter pub run` to generate assets from tokens if using a token pipeline; otherwise provide `tokens.json` and a helper `theme_from_tokens.dart`.
- Prefer vector SVG icons; include PNG fallbacks for platforms with SVG issues.

Handoff Checklist
-----------------
- Figma project link and `FigmaBrief.pdf`
- `tokens.json` and `fonts/` list
- Exported assets under `catersync-mobile/assets/` with usage notes
- `docs/frontend/implementation.md` with component→file→API mapping
- Test plan and acceptance checklist

Next Steps
----------
1. I can generate the exact `FigmaBrief.pdf` content as a copy-paste-ready Markdown now.
2. Or I can scaffold the Flutter component library structure and implement `AppButton` + `AppTextField` + token loader, with tests and example pages.

Choose one and I will start immediately; I will update `tasklist.md` and the todo list as subtasks complete.
