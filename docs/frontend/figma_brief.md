# Figma Design Brief — CaterSync AI (Phase 3)

Purpose
-------
Create human-designed, pixel-perfect UI screens and a component library for CaterSync AI's Phase 3 frontend (mobile + admin web). The designs must be created by a designer (no AI-generated art/assets) and handed off with tokens and exportable assets.

Audience
--------
- Catering business owners (small-medium)
- Event managers and staff
- Customers booking events
- Super-admins managing tenants

Primary Objectives
------------------
- Clear booking and checkout flows for customers
- Efficient admin interfaces for bookings, inventory, and communications
- Analytics dashboard with KPI cards and charts for business insights
- Tenant branding customization and preview
- Mobile-first experience, with responsive admin web UI

Deliverables
------------
- Figma project with pages: `Design System`, `Mobile Screens`, `Admin Screens`, `Assets`.
- Design tokens export (colors, typography, spacing, motion) in JSON.
- Component library in Figma (buttons, inputs, cards, tables, modals) with states.
- High-fidelity screens for prioritized flows (see Screen List below).
- Exported SVG icon set, PNG fallbacks, exported fonts and style-guide PDF.

Constraints & Rules
------------------
- No AI-generated art or icons — use licensed icon libraries (e.g., Material Icons, Streamline) or custom in-house icons.
- Accessibility: WCAG AA minimum for text/background contrast.
- Use an 8pt baseline grid; spacing should follow 4/8 multiples.
- Provide responsive variants for mobile (360–420dp) and admin web (1024px, 1440px).
- Provide clear naming conventions for components and layers to match Flutter widget names.

Priority Screens (minimum)
-------------------------
Mobile
- Onboarding / Welcome
- Login / Register / 2FA
- Booking Search / Package Selection
- Booking Details / Checkout / Payment
- Ticket / QR Display
- Profile / Settings

Admin Web
- Admin Dashboard (KPI cards, recent bookings)
- Booking List (table + filters)
- Booking Detail (timeline, actions)
- Calendar View (bookings by date)
- Inventory List (stock, alerts)
- Communication Center (inbox, templates)
- Tenant Branding Editor (logo, colors, preview)

Interaction & Motion
--------------------
- Define micro-interactions for button presses, loading states, and modals.
- Provide simple motion specs (duration, easing) for transitions.

Handoff Requirements
--------------------
- Tokens JSON and fonts list
- Exported SVGs and PNGs with naming
- A `style-guide.pdf` summarizing components and usage
- Interaction notes and keyboard accessibility guidance

Timeline
--------
- Brief & tokens: 1–2 days
- Component library & screens: 5–8 days
- Handoff & QA: 1–2 days

Contact & Review
----------------
Design reviews should be scheduled after tokens + a first component set are delivered. Ensure developer review sessions to align on implementation details.
