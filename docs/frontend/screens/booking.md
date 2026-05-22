# Booking Flow Screens

Flow
- Search / Browse packages
- Package details and availability calendar
- Select date/time and extras
- Checkout / Payment screen
- Confirmation + ticket with QR

Key Components
- Package card, availability calendar, guest count selector, price breakdown, promo code entry

API Needs (for handoff)
- `GET /api/packages`
- `GET /api/packages/{id}`
- `POST /api/bookings`
- `POST /api/payments` (or payment provider flow)
