# AI Catering Intelligence Platform
## Full Capstone Technical Plan — Architecture, Models, Modules, Timeline
### (Revised: Fully Self-Hosted, No External AI API Dependency)

---

## 1. Project Positioning

**Name:** AI Catering Intelligence Platform (ACIP)

**One-line pitch:** A catering management system where every core business decision — what to cook, how much to buy, who to schedule, whether to accept a booking, how much profit was made — is backed by a self-trained AI model instead of manual guesswork or a third-party API.

**Why this beats generic retail/POS capstones:**
- Narrow, well-defined domain with clear, measurable pain points (waste, understaffing, budget overruns).
- Produces a *portfolio* of self-trained ML techniques (regression, time-series, classification, recommendation, optimization) rather than one model reused everywhere, or a thin wrapper around someone else's API.
- Every model is trained, tuned, and explainable by you — a stronger technical defense than an LLM-wrapper capstone, since you can answer detailed questions about how each piece actually works.
- Zero ongoing API cost, zero external dependency, fully runs offline on a laptop.

---

## 2. System Architecture (High Level)

```
                    ┌─────────────────────────────┐
                    │        SvelteKit Frontend     │
                    │   (Owner Dashboard, Forms,    │
                    │    Reports, Charts)            │
                    └──────────────┬────────────────┘
                                   │ REST
                    ┌──────────────▼────────────────┐
                    │     Application API Layer      │
                    │   (Node/SvelteKit endpoints)   │
                    └───┬─────────────────────────┬───┘
                        │                         │
         ┌──────────────▼───┐          ┌──────────▼──────────┐
         │  MariaDB/Postgres │          │  ML Inference Service │
         │  (core business   │          │  (FastAPI, Python)    │
         │  data + history)  │          │  - loads trained models│
         └───────────────────┘          │  - runs optimizers     │
                                         │  - fills text templates│
                                         └──────────┬─────────────┘
                                                     │
                                       ┌─────────────▼─────────────┐
                                       │   Trained Models Registry   │
                                       │  (versioned .pkl / .json    │
                                       │   files per module)         │
                                       └──────────────────────────────┘
```

**Key architectural decision:** All intelligence lives in a self-contained Python **FastAPI** microservice that your SvelteKit app calls over HTTP. No external AI API calls anywhere in the system. Natural-language output (menu descriptions, profit report explanations) is generated with **Python string templates (Jinja2)**, driven by model output — not by any language model.

---

## 3. Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | SvelteKit + TailwindCSS |
| Backend/API | SvelteKit server routes or Node/Express |
| Database | MariaDB or PostgreSQL |
| ML Training | Python — scikit-learn, XGBoost, Prophet, statsmodels |
| ML Serving | FastAPI (Python) — one `/predict` endpoint per module |
| Optimization | Google OR-Tools (scheduling) + PuLP (menu selection LP) |
| Text generation | Jinja2 templates (no LLM, fully deterministic) |
| Model storage | Joblib/Pickle for scikit-learn models, JSON for Prophet params |
| Deployment | Docker Compose (frontend, API, ML service, DB as separate containers) — runs entirely offline, no internet dependency after setup |

---

## 4. Core Database Schema

```sql
-- Core entities
customers (id, name, contact, allergies, dietary_prefs, preferred_theme, created_at)
events (id, customer_id, event_type, guest_count, event_date, budget, theme, status, venue_type, is_outdoor)
menus (id, name, category, cost_per_serving, price_per_serving, cuisine_tags)
menu_items (id, menu_id, dish_name, ingredients_json, prep_time_minutes)

-- Inventory & suppliers
ingredients (id, name, unit, current_stock, reorder_point, shelf_life_days)
suppliers (id, name, reliability_score, avg_lead_time_days)
supplier_prices (id, supplier_id, ingredient_id, price_per_unit, last_updated)
purchase_orders (id, supplier_id, ingredient_id, quantity, order_date, delivery_date, cost)

-- Operations
event_menus (event_id, menu_id, quantity_planned, quantity_consumed_actual)
staff (id, name, role, hourly_rate, max_hours_per_week)
staff_assignments (id, event_id, staff_id, role, hours_assigned)
event_costs (event_id, ingredient_cost, labor_cost, overhead_cost, actual_revenue)

-- AI-support tables (populated by the models themselves)
demand_forecasts (id, week_start, predicted_bookings, predicted_revenue, model_version)
consumption_logs (event_id, dish_id, guests, planned_qty, actual_qty_consumed)
risk_flags (event_id, risk_score, reason, generated_at)
```

Design note: `consumption_logs` is the single most valuable table in the whole system — it's the training data source for food quantity prediction, waste analysis, and profit analysis. Start logging this from day one, even manually, since real data beats synthetic data for your defense.

---

## 5. Module-by-Module Breakdown

Each module below includes: **Purpose → Data Needed → Model/Algorithm → Training Approach → Output → Integration**. Every module runs entirely on CPU — no GPU required anywhere in this system.

### Module 1 — AI Food Quantity Prediction
- **Purpose:** Predict how much of each dish to prepare for a given event, minimizing over/under-preparation.
- **Data:** `consumption_logs` joined with `events` (guest_count, event_type, time_of_day, season) and `menu_items`.
- **Model:** **XGBoost Regressor** (handles small/medium tabular data well, gives feature importance, trains in seconds on CPU).
- **Features:** guest_count, event_type (encoded), dish category, day_of_week, season, historical average consumption per guest for that dish.
- **Target:** actual_quantity_consumed per guest (normalized), so it generalizes across event sizes.
- **Training:** Bootstrap with synthetic data generated from realistic per-guest averages (~0.3–0.5 kg food/guest depending on meal type) while you collect real logs. Retrain monthly as `consumption_logs` grows.
- **Output:** Predicted quantity per dish, with confidence interval.
- **Integration:** Called by Menu Generator and Ingredient Purchasing modules.

### Module 2 — AI Menu Generator
- **Purpose:** Given budget, guest count, and theme, generate a menu that fits cost constraints while maximizing profit margin.
- **Data:** `menus`, `menu_items` (cost_per_serving), customer preference tags.
- **Model:** **Constrained Integer Programming** (via PuLP or OR-Tools) — a knapsack-style optimizer that selects dish combinations maximizing a satisfaction/profit score subject to `total_cost ≤ budget`.
- **Text generation:** A Jinja2 template turns the optimizer's selected dish list into a readable menu ("Elegant Filipino Menu for 250 guests — estimated cost ₱145,000, profit margin 22%") — fully deterministic, no LLM.
- **Output:** Structured menu (JSON) + templated description + estimated cost/profit breakdown.
- **Integration:** Feeds Food Quantity Prediction (once dishes are chosen, guest count determines quantities) and Ingredient Purchasing.

### Module 3 — AI Ingredient Purchasing
- **Purpose:** Determine what to buy, how much, and when.
- **Data:** Output of Module 1 (predicted quantities), `ingredients.current_stock`, `supplier_prices`, `suppliers.avg_lead_time_days`.
- **Model:** **Economic Order Quantity (EOQ)** formula combined with a **greedy supplier-selection algorithm** that picks the cheapest reliable supplier per ingredient given lead-time constraints.
- **Formula:** `EOQ = sqrt((2 * Demand * OrderCost) / HoldingCost)`, adjusted for perishables (shelf_life_days caps max order size).
- **Output:** Purchase order list with supplier recommendation and required order date (working backward from `avg_lead_time_days`).
- **Integration:** Auto-generates draft `purchase_orders` rows; owner approves via dashboard.

### Module 4 — AI Kitchen Scheduler
- **Purpose:** Generate a prep timeline for the kitchen team leading up to an event.
- **Data:** `menu_items.prep_time_minutes`, event_date, staff availability.
- **Model:** **Constraint Satisfaction / Job-Shop Scheduling** using Google OR-Tools' CP-SAT solver. Scheduling problems like this are NP-hard, so solving them well is genuine, defensible technical work even though it's not a "trained" model in the traditional sense.
- **Constraints:** task precedence (marinate before cook), staff availability windows, kitchen equipment capacity (e.g., only 2 ovens).
- **Output:** Timeline (task, start_time, assigned_staff, duration).
- **Integration:** Rendered as a Gantt-style timeline in the dashboard.

### Module 5 — AI Staff Assignment
- **Purpose:** Recommend number and role of staff needed, and assign specific people.
- **Data:** `staff_assignments` history, event_size, menu_complexity (derived from number of dishes + prep_time sum).
- **Model:** Two parts:
  1. **Random Forest Regressor** trained on historical events to predict `required_staff_count` per role from guest_count + menu_complexity + distance_to_venue.
  2. **Hungarian Algorithm** (`scipy.optimize.linear_sum_assignment`) to optimally match available staff to roles, minimizing cost or maximizing skill-fit.
- **Output:** Recommended staff count per role + specific staff-to-event assignment.
- **Integration:** Feeds into Kitchen Scheduler for timeline staff allocation.

### Module 6 — AI Profit Analyzer
- **Purpose:** Post-event report explaining actual profit, cost overruns, and improvement suggestions.
- **Data:** `event_costs`, `event_menus` (planned vs actual quantity), `purchase_orders`.
- **Model:** **Isolation Forest** trained on historical cost-per-guest ratios to flag events where a specific cost category (e.g., seafood) deviated significantly from the norm.
- **Text generation:** Jinja2 template maps flagged anomalies to pre-written suggestion patterns (e.g., "{category} exceeded budget by {pct}%. Consider negotiating with suppliers or adjusting portion sizes.") — deterministic, no LLM.
- **Output:** Profit report with flagged line items and templated recommendations.
- **Integration:** Feeds back into Menu Generator's cost assumptions and future budget estimates.

### Module 7 — AI Customer Preference Learning
- **Purpose:** Personalize menu/theme suggestions for returning customers.
- **Data:** `customers`, `events`, `event_menus` history per customer.
- **Model:** **Content-based recommendation** using cosine similarity over a feature vector (past dish categories, cuisine tags, budget range, theme) — explainable and well-suited to a single business's limited customer volume.
- **Output:** Ranked list of recommended dishes/themes for a specific returning customer.
- **Integration:** Surfaces automatically when a returning customer's ID is entered into the Event Planner form.

### Module 8 — AI Event Risk Prediction
- **Purpose:** Flag operational risks (weather, overbooking, resource conflicts) for upcoming events.
- **Data:** `events.is_outdoor`, `events.event_date`, weather API (optional, e.g., OpenWeatherMap — note: this is a data source, not an AI API, so it doesn't violate your "no AI dependency" goal), staff/equipment availability.
- **Model:** **Logistic Regression** trained on historical "problem events" (tag past events as had_issue = 1/0), using features: is_outdoor, guest_count, season, days_until_event, resource_utilization_pct.
- **Output:** Risk score (low/medium/high) + specific flags via template ("Outdoor event + rain forecast + only 60% of required tents in stock").
- **Integration:** Displayed as an alert banner on the event detail page.

### Module 9 — AI Sales Forecasting
- **Purpose:** Forecast future bookings/revenue by week/month to guide staffing and purchasing decisions in advance.
- **Data:** Historical `events` (date, revenue) aggregated weekly/monthly.
- **Model:** **Facebook Prophet** (handles seasonality and small datasets well) — compare against a classical **SARIMA** model in your evaluation section to show you understand the tradeoffs between approaches.
- **Output:** Forecasted bookings/revenue for next 4–12 weeks with confidence bands.
- **Integration:** Populates `demand_forecasts` table; drives proactive ingredient stocking suggestions and staff hiring alerts.

---

## 6. Model Portfolio Summary (for your technical defense)

| Module | Technique | Category | Runs on |
|---|---|---|---|
| Food Quantity Prediction | XGBoost Regression | Supervised regression | CPU |
| Menu Generator | Integer Programming + Jinja2 templates | Optimization + deterministic text | CPU |
| Ingredient Purchasing | EOQ + Greedy supplier selection | Operations research | CPU |
| Kitchen Scheduler | OR-Tools CP-SAT Solver | Combinatorial optimization | CPU |
| Staff Assignment | Random Forest + Hungarian Algorithm | Regression + assignment optimization | CPU |
| Profit Analyzer | Isolation Forest + Jinja2 templates | Anomaly detection + deterministic text | CPU |
| Customer Preference Learning | Content-based cosine similarity | Recommender system | CPU |
| Event Risk Prediction | Logistic Regression | Classification | CPU |
| Sales Forecasting | Prophet / SARIMA | Time-series forecasting | CPU |

This spread (regression, classification, time-series, recommendation, anomaly detection, combinatorial optimization) is a genuinely advanced, fully self-trained ML capstone with zero external AI dependency.

---

## 7. Development Timeline (14-Week Plan)

| Weeks | Milestone |
|---|---|
| 1–2 | Finalize schema, set up DB, scaffold SvelteKit app + FastAPI service skeleton |
| 3–4 | Build core CRUD (events, customers, menus, inventory) — the foundation everything else depends on |
| 5–6 | Module 1 (Food Quantity Prediction) + Module 3 (Ingredient Purchasing) — get synthetic/real data flowing |
| 7–8 | Module 2 (Menu Generator) + Module 9 (Sales Forecasting) |
| 9–10 | Module 5 (Staff Assignment) + Module 4 (Kitchen Scheduler) |
| 11 | Module 8 (Event Risk Prediction) |
| 12 | Module 6 (Profit Analyzer) + Module 7 (Customer Preference Learning) |
| 13 | End-to-end testing, model evaluation writeups, UI polish |
| 14 | Documentation, defense slides, demo rehearsal |

---

## 8. Evaluation Metrics (per module, for your paper/defense)

- **Food Quantity Prediction:** MAE / RMSE against actual consumption; % reduction in over-preparation vs. baseline (naive guest_count × fixed average).
- **Menu Generator:** % of generated menus within budget constraint; average profit margin achieved.
- **Ingredient Purchasing:** Stockout rate reduction; average order cost vs. naive reorder strategy.
- **Kitchen Scheduler:** Solver feasibility rate; average schedule compactness (total idle time).
- **Staff Assignment:** Accuracy of predicted staff count vs. actual used; assignment cost minimized vs. random assignment baseline.
- **Profit Analyzer:** Precision/recall of anomaly flags against manually-reviewed "known problem events."
- **Customer Preference Learning:** Recommendation acceptance rate (did the owner/customer pick a suggested dish?).
- **Event Risk Prediction:** Precision/recall against historically flagged problem events.
- **Sales Forecasting:** MAPE (Mean Absolute Percentage Error) against actual bookings.

---

## 9. Demo Strategy for Defense Day (No Chat Interface — Dashboard Walkthrough)

Structure your live demo as a single narrative, walking through the dashboard:

1. Owner opens a new event form → enters guest count, budget, theme.
2. Menu Generator (LP optimizer) suggests a menu within budget; templated description appears.
3. Food Quantity Prediction auto-fills expected quantities per dish.
4. Ingredient Purchasing auto-generates a draft purchase order.
5. Kitchen Scheduler produces the prep timeline (Gantt view).
6. Staff Assignment recommends and assigns staff.
7. Fast-forward to a **past** event: Profit Analyzer report shows a flagged anomaly and templated explanation.
8. Close with the Sales Forecasting chart showing next month's predicted bookings.

This tells one coherent story — plan → execute → review → forecast — entirely offline, with every number traceable to a model you trained yourself.

---

## 10. Stretch Goals (if time permits)

- Computer vision buffet consumption estimation (CNN on food tray photos, transfer learning from a pretrained model like ResNet — still fully self-hosted, no API).
- Association rule mining (Apriori algorithm) on historical order combinations for upsell suggestions (e.g., "customers who order lechon also often add a live pasta station").
- A conversational layer using a **self-hosted open-source model** (e.g., Llama 3.1 8B or Mistral 7B via Ollama, run locally) — only pursue this once the core 9 modules are solid and you have spare time, since it adds real setup complexity (needs at least a modest GPU or patience on CPU).