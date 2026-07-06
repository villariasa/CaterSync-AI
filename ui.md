# AI Catering Intelligence Platform — UI/UX Design Plan
## "The Pass" — A Kitchen-Ticket-Inspired Dashboard Identity

---

## 0. Grounding the Design

**Subject:** A working dashboard for a catering business owner — not a marketing site, a tool they'll stare at daily while planning events, checking stock, and reviewing profit.

**Audience:** A busy owner/operator, often on their feet, sometimes checking on a tablet in the kitchen, sometimes at a desk doing admin work. Not a designer, not impressed by decoration — impressed by clarity and speed.

**The page's single job:** Let the owner glance at "what needs my attention right now" and drill into any module without feeling lost.

**Where the personality comes from:** Real catering kitchens run on **order tickets** — the torn-edge chits that come off a printer at "the pass," the counter where the head chef reviews every dish before it goes out. That physical object — perforated edge, monospace stamp, urgency implied by paper — is the visual anchor for this whole system. Every module surfaces its data as a "ticket," so the software feels like an extension of a kitchen the owner already knows, not a generic SaaS template.

---

## 1. Design Token System

### Color — "Market Ledger" palette
Named, not decorative — each color has a job.

| Name | Hex | Role |
|---|---|---|
| Paper | `#F6F2EA` | Base background — warm, not stark white, evokes ticket/receipt stock |
| Ink | `#2A2521` | Primary text, near-black with warmth, not pure `#000` |
| Basil | `#3E6650` | Primary accent — actions, active states, positive numbers |
| Saffron | `#D9A441` | Secondary accent — highlights, in-progress states, upcoming events |
| Paprika | `#AC3B2A` | Alert/risk accent only — reserved exclusively for warnings, overruns, flags. Never used decoratively. |
| Steel | `#767068` | Muted text, borders, dividers, disabled states |

**Why not the obvious choice:** This deliberately avoids the near-ubiquitous cream+terracotta AI palette by making green (Basil) the dominant accent — tied to herbs/freshness, a real catering association — and demoting warm-red (Paprika) to an exclusively functional alert color rather than the hero tone. Saffron adds warmth without leaning orange-as-brand.

### Typography
| Role | Typeface | Why |
|---|---|---|
| Display (headings) | **Fraunces** (serif, warm, slightly irregular) | Reads like handwritten chalkboard-menu signage — has personality without being a generic geometric sans |
| Body | **Public Sans** | Clean, highly legible at small sizes, built for dense operational UI |
| Data/Utility (numbers, tickets, tables, timestamps) | **IBM Plex Mono** | Evokes the receipt-printer/ticket aesthetic; used for all quantities, prices, and stamps like `EVENT #048` |

Type scale: Display headings set large and slightly loose-tracked for warmth; body copy tight and efficient; mono data given a touch of letter-spacing to read like a printed ticket, not code.

### Layout Concept: "The Pass"
The dashboard home is organized as a **countertop of stations**, not a generic sidebar+cards grid. Each business function (Menu, Purchasing, Staffing, Prep, Profit, Forecast) is a **station card** styled as a torn ticket. Urgent items (risk flags, low stock, understaffed events) visually "print" to the top of the layout, like tickets landing at the pass.

```
┌─────────────────────────────────────────────────────────┐
│  ACIP           [Search]                    [Owner ⚙]    │
├─────────────────────────────────────────────────────────┤
│  ─── TICKETS FIRING NOW ───────────────────────────────  │
│  ⑂--------------------⑂  ⑂--------------------⑂         │
│  │ EVENT #048  🔴 RISK │  │ STOCK  🟡 LOW: Chicken │      │
│  │ Outdoor + rain      │  │ Reorder by Thu          │      │
│  ⑂--------------------⑂  ⑂--------------------⑂         │
│                                                             │
│  ─── STATIONS ─────────────────────────────────────────   │
│  ⑂-- MENU --⑂  ⑂-- PREP --⑂  ⑂-- STAFF --⑂  ⑂-- $ --⑂    │
│  │ Generate │  │ Timeline │  │ Assign   │  │ Profit  │    │
│  │ a menu   │  │ this wk  │  │ staff    │  │ report  │    │
│  ⑂----------⑂  ⑂----------⑂  ⑂----------⑂  ⑂---------⑂    │
│                                                             │
│  ─── THIS MONTH ───────────────────────────────────────   │
│  [ forecast chart — bookings & revenue, next 8 weeks ]     │
└─────────────────────────────────────────────────────────┘
```

### Signature Element
**The Ticket Card** — every module's output (a generated menu, a purchase order, a risk flag, a profit report) renders in the same reusable component: a card with a **perforated top edge** (CSS dashed/scalloped border), a **monospace stamp** in the corner (`EVENT #048`, `PO #0231`), and a soft drop-shadow like a paper chit lying on a counter. This single component is what makes the whole product feel like one coherent world instead of a set of disconnected admin screens.

---

## 2. Self-Critique (checked against generic AI-design defaults)

- ✗ Cream background + terracotta serif — avoided by making green the dominant accent and reserving warm-red strictly for alerts.
- ✗ Dark mode + neon accent — avoided entirely; this is a daytime kitchen-adjacent tool, dark backgrounds would fight the "paper ticket" concept.
- ✗ Broadsheet hairline/zero-radius layout — avoided; tickets have soft corners, perforation, and shadow, not newspaper columns.
- ✓ The ticket motif is pulled directly from the subject's real physical world (an actual kitchen artifact), not a decorative flourish — this is the "one real risk" the brief calls for.

---

## 3. Page-by-Page Breakdown

### Dashboard Home
- "Tickets Firing Now" row at top — risk flags, low stock, understaffed events — sorted by urgency, using Paprika sparingly for the most critical.
- "Stations" grid below — one card per module, each a quiet, quick-glance summary (not a full report) with a single clear call-to-action.
- Forecast chart anchors the bottom — the one place a data visualization takes center stage, since trend-over-time is the one thing tickets can't show well.

### Event Planner (Menu Generator + Food Quantity + Risk)
- Left: a short form (guest count, budget, theme, date, venue type) — kept to one screen, no wizard-style multi-step unless genuinely necessary.
- Right: live-updating "ticket" preview of the generated menu as fields are filled in — reinforces immediate cause-and-effect, feels responsive and alive.
- Risk flag (if any) appears as a Paprika-bordered ticket directly under the menu ticket, not a separate page — the owner sees the whole picture in one glance.

### Purchasing & Prep
- Purchase orders and kitchen timeline shown as parallel ticket lists — visually pairs "what to buy" with "when to cook it," since they're causally linked.
- Timeline itself uses a simple horizontal Gantt-style bar in Basil/Saffron, plain and readable, no unnecessary 3D or gradient effects.

### Staffing
- Assignment shown as a simple table with role, staff name, hours — Plex Mono for hours/rates reinforces the "ticket" data language established elsewhere.

### Profit Report
- Structured as a single large ticket: planned vs. actual costs, flagged line items in Paprika, template-generated explanation text directly underneath each flag — plain sentence-case, no jargon, states the number and the "why" in the same breath.

### Forecast
- One clean line/area chart (Basil for actuals, Saffron dashed for forecast band) — the only place charts dominate the screen, intentionally, since this module's whole value is the trend line.

---

## 4. Interaction & Motion

- **Ticket "print-in":** New tickets (a freshly generated menu, a new risk flag) animate in with a brief slide-down + fade, mimicking a ticket printing out — used once per event, not as ambient decoration.
- **Hover states:** Station cards lift slightly (shadow deepens) on hover — subtle, functional, signals interactivity without being flashy.
- **Reduced motion respected:** All animations degrade to instant appearance if the user's system requests reduced motion.
- **No animation for animation's sake** elsewhere — the ticket-print moment is the one "orchestrated" motion beat; everything else stays quiet.

---

## 5. Writing & Microcopy Guidelines

- Buttons name the action the owner takes, not the system's internals: **"Generate menu,"** not "Submit," **"Approve order,"** not "Confirm."
- Alerts state what happened and what to do, in plain sentence case: *"Chicken stock low — reorder by Thursday to avoid a gap."* Never apologetic, never vague.
- Empty states invite action: an empty Events list reads *"No events yet — plan your first one"* with the CTA immediately underneath, not a lonely illustration.
- Numbers are always given units and context inline (₱145,000 estimated cost, not just 145000) — this is an operational tool, ambiguity costs real money.

---

## 6. Accessibility & Responsiveness

- All ticket cards maintain a minimum 4.5:1 text contrast against the Paper background.
- Visible keyboard focus rings on every interactive element (Basil outline, 2px).
- Mobile/tablet: station cards stack vertically in priority order (urgent tickets always first); the forecast chart becomes horizontally scrollable rather than shrinking to illegibility.
- Color is never the only signal for risk/status — Paprika alerts always pair with a label ("RISK", "LOW STOCK"), not color alone, for colorblind users.

---

## 7. Component Library Summary (build order)

1. **Ticket Card** (the signature component — build first, everything else composes from it)
2. Station summary card (lightweight variant of the ticket card)
3. Form inputs (Event Planner) — plain, no unnecessary skeuomorphism
4. Alert/flag badge (Paprika, label + icon, used across Risk, Stock, Profit modules)
5. Timeline/Gantt bar (Prep + Staffing)
6. Chart component (Forecast — one shared style for all time-series visuals)
7. Table component (Purchasing, Staffing) — Plex Mono for numeric columns, Public Sans for labels

Building the Ticket Card first and deriving every other surface from it is what keeps the whole platform feeling like one designed product instead of ten separate screens bolted together.