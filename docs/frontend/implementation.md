# Frontend Implementation Handoff

This document maps Figma components and screens to Flutter widgets and API endpoints.

Component → Flutter
- `AppButton` → `lib/shared/widgets/app_button.dart`
- `AppTextField` → `lib/shared/widgets/app_text_field.dart`
- `KpiCard` → `lib/shared/widgets/kpi_card.dart` (to implement)
- `DataTable` → use Flutter `PaginatedDataTable` or custom `lib/shared/widgets/data_table.dart`

Screens → Routes
- Onboarding → `/onboarding` (OnboardingPage)
- Login → `/login` (LoginPage)
- Bookings list → `/bookings` (BookingListPage)
- Admin dashboard → `/admin` (AdminHomePage)

API endpoints (examples required for each screen)
- Auth: `POST /api/auth/login`, `POST /api/auth/register`
- Bookings: `GET /api/bookings`, `POST /api/bookings`
- Inventory: `GET /api/inventory`
- Analytics: `GET /api/analytics/kpis`
- Tenants: `GET /api/tenants/{id}/branding`

Assets
- Place SVG icons in `assets/icons/`
- Add fonts under `assets/fonts/` and register in `pubspec.yaml`

Token usage
- `docs/frontend/design_tokens.json` is the source of truth. Implement `theme_from_tokens.dart` to read tokens and produce `ThemeData`.
