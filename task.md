# AI Catering Intelligence Platform (ACIP) — Detailed Tasklist

This document maps out the detailed execution checklist from the system design setup to the final model evaluations and UI polish.

---

## 📅 Phase 1: Foundations & Architecture Setup (Weeks 1-2)

### 🗄️ Database Setup
- [x] Choose primary database engine (PostgreSQL or MariaDB) and verify installation configuration
- [x] Write SQL schema definition files for all tables:
  - [x] `customers`, `events`, `menus`, `menu_items`
  - [x] `ingredients`, `suppliers`, `supplier_prices`, `purchase_orders`
  - [x] `event_menus`, `staff`, `staff_assignments`, `event_costs`
  - [x] `demand_forecasts`, `consumption_logs`, `risk_flags`
- [x] Build a database migration framework or runner script (e.g., Knex, Prisma, or simple SQL migrations)
- [x] Create a comprehensive data-seeding script (`seed.sql` or `seed.js`) generating realistic baseline records:
  - [x] Generate 50+ customers with varied dietary preferences/allergies
  - [x] Generate 100+ historical events with realistic budgets, menus, and dates
  - [x] Generate consumption logs mapped to events for training data bootstrapping

### 🐍 Python FastAPI Microservice Skeleton
- [x] Initialize Python virtual environment and set up `requirements.txt` with core dependencies:
  - `fastapi`, `uvicorn`, `scikit-learn`, `xgboost`, `prophet`, `statsmodels`, `pulp`, `ortools`, `jinja2`, `pandas`, `numpy`, `joblib`
- [x] Scaffold FastAPI project structure:
  ```
  ml-service/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py
  │   ├── core/           # Config and model loader
  │   ├── models/         # Serialized .pkl / .json model files
  │   ├── routes/         # Endpoints per ML module
  │   ├── training/       # Standalone training and evaluation scripts
  │   └── templates/      # Jinja2 text templates
  ├── Dockerfile
  └── requirements.txt
  ```
- [x] Implement base FastAPI routers, error handling, and CORS middleware
- [x] Create a model loader utility that handles safe loading of model files or gracefully falls back if a model file is missing

### ⚡ SvelteKit Frontend Skeleton
- [x] Scaffold SvelteKit application in the workspace root
- [x] Set up layout structure (`src/routes/+layout.svelte`) and install TailwindCSS or define core Vanilla CSS variables
- [x] Configure global style sheet (`src/app.css` or `src/index.css`) containing design tokens, color palette, and micro-animation keyframes
- [x] Set up database connection layer in SvelteKit server endpoints (`src/lib/server/db.js` or similar)
- [x] Build a shared API fetcher client to communicate with the Python ML microservice

### 🐋 Containerization & Dev Ops
- [x] Write `Dockerfile` for the SvelteKit frontend (Node multi-stage build)
- [x] Write `Dockerfile` for the Python ML service (lightweight python-slim base image)
- [x] Create `docker-compose.yml` to orchestrate:
  - `database` (with persistent volume)
  - `ml-service`
  - `frontend`
- [x] Test entire orchestrator configuration (configured for offline use with Postgres and SvelteKit/FastAPI)

---

## 📅 Phase 2: Core CRUD Features & Panel Layouts (Weeks 3-4)

### 👥 Customer & Event Panels
- [x] Build customer management interface:
  - [x] List customers with search, filters for allergies, and dietary preferences
  - [x] Form for adding/editing customers and recording preferred menu themes
- [x] Build event management interface:
  - [x] Calendar view showing scheduled events
  - [x] Interactive event planning form (guest counts, budget, theme, outdoor toggle, event date)

### 📦 Inventory & Suppliers Management
- [x] Design inventory tracking page showing stock levels, reorder points, and ingredient shelf lives
- [x] Implement supplier registry showcasing supplier reliability scores and average lead times
- [x] Add interface for matching suppliers to ingredients with price points (`supplier_prices`)

### 🍳 Menus & Staff Management
- [x] Build menu management page showing pre-set menus and custom recipe builders
- [x] Add menu item list displaying prep times and raw ingredient lists (stored as JSON)
- [x] Create staff roster tracking roles, hourly rates, and working hours limits
- [x] Implement logs page displaying database tables: consumption logs, event costs, and purchase orders

---

## 📅 Phase 3: Food Quantity Prediction & Purchasing (Weeks 5-6)

### 📈 Module 1: AI Food Quantity Prediction
- [x] Write `train_quantity_model.py` training script:
  - [x] Query historical data from `consumption_logs` and `events` tables
  - [x] Feature engineering: encode event types, calculate guest sizes, day of week, seasonal indexes, and historical dish consumption per guest
  - [x] Train **XGBoost Regressor** on tabular datasets
  - [x] Save trained model and scaler/encoder objects using `joblib`
- [x] Add `/predict/food-quantity` POST endpoint in FastAPI microservice:
  - [x] Accept `event_id`, `dish_id`, and `guest_count`
  - [x] Preprocess parameters, run inference, and return recommended raw quantities with standard confidence intervals
- [x] Integrate endpoint into the SvelteKit event booking page to auto-suggest recipe quantity limits based on guest numbers

### 🛒 Module 3: AI Ingredient Purchasing
- [x] Build purchasing solver algorithm:
  - [x] Compute total ingredient demand using Module 1 output
  - [x] Run **Economic Order Quantity (EOQ)** formula calculations (`EOQ = sqrt((2 * Demand * OrderCost) / HoldingCost)`)
  - [x] Account for perishables by capping purchase quantity with `shelf_life_days`
  - [x] Run a greedy supplier selection matching required items to the cheapest and most reliable supplier given lead time limits
- [x] Add `/optimize/ingredient-purchasing` POST endpoint in FastAPI:
  - [x] Return list of recommended purchase quantities, recommended suppliers, and suggested order dates
- [x] Build frontend screen allowing dashboard owners to review suggestions and click "Approve and Order" to generate rows in `purchase_orders`

---

## 📅 Phase 4: Menu Generation & Sales Forecasting (Weeks 7-8)

### 🍽️ Module 2: AI Menu Generator
- [x] Write **Integer Linear Programming** optimization logic (via **PuLP** or **Google OR-Tools**):
  - [x] Define decision variables representing inclusion/exclusion of dishes
  - [x] Formulate constraint: `sum(dish_costs) <= event_budget`
  - [x] Formulate objective function to maximize total profit margins and popularity scores
- [x] Design Jinja2 text templates mapping optimizer outputs to premium, client-facing menu descriptions
- [x] Add `/optimize/menu-generation` endpoint in FastAPI
- [x] Connect SvelteKit to this endpoint, allowing event planners to auto-generate beautiful menus instantly based on budget and theme

### 📊 Module 9: AI Sales Forecasting
- [x] Write time-series training script `train_sales_forecast.py`:
  - [x] Fetch aggregated weekly booking and revenue counts
  - [x] Load and train **Facebook Prophet** model capturing annual/weekly seasonality
  - [x] Load and train classical **SARIMA** model as a benchmark
- [x] Set up evaluation metric comparisons (Prophet MAPE vs SARIMA MAPE)
- [x] Add `/predict/sales-forecast` GET endpoint returning 4-12 week revenue predictions with confidence bands
- [x] Build interactive forecasting chart on the main SvelteKit dashboard using modern SVG chart components

---

## 📅 Phase 5: Kitchen Scheduling & Staff Assignment (Weeks 9-10)

### 🧑‍🤝‍🧑 Module 5: AI Staff Assignment
- [x] Develop staff count predictor:
  - [x] Train **Random Forest Regressor** to predict required staff counts per role based on guest count and menu complexity
- [x] Develop matching optimization:
  - [x] Implement **Hungarian Algorithm** (`scipy.optimize.linear_sum_assignment`) to match specific staff members to roles based on rates and skill-fits
- [x] Create `/optimize/staff-assignment` endpoint in FastAPI
- [x] Integrate recommendations into SvelteKit's event planning timeline, automatically listing recommended staff rosters

### ⏱️ Module 4: AI Kitchen Scheduler
- [x] Build kitchen scheduler model using **Google OR-Tools CP-SAT Solver**:
  - [x] Define tasks, durations, and precedence constraints (e.g., preparation -> cooking -> plating)
  - [x] Apply resource capacity bounds (e.g., max number of active staff, oven capacity limits)
  - [x] Optimize for minimized makespan (total preparation duration)
- [x] Add `/optimize/kitchen-schedule` endpoint in FastAPI
- [x] Create visual Gantt timeline in SvelteKit to display step-by-step task allocations for the kitchen staff

---

## 📅 Phase 6: Operational Risk & Profit Analysis (Weeks 11-12)

### ⚠️ Module 8: AI Event Risk Prediction
- [x] Write training script using **Logistic Regression** classifier to output risk probability:
  - [x] Use historical incident logs as targets
  - [x] Features: outdoor flag, guest count, days to event, historical staff availability, weather indices
- [x] Integrate simulated weather queries based on event locations and dates
- [x] Create `/predict/event-risk` endpoint returning risk labels (Low, Medium, High) and template-driven risk summaries
- [x] Render a premium risk banner on event detail dashboards showing alert factors

### 📉 Module 6: AI Profit Analyzer
- [x] Develop anomaly detection script:
  - [x] Train **Isolation Forest** on cost-to-revenue ratios of past events
  - [x] Flag post-event anomalies (e.g., excessive seafood cost, high labor cost hours)
- [x] Map flagged anomalies to structured recommendations using Jinja2 text templates
- [x] Create `/analyze/profit` endpoint in FastAPI
- [x] Build post-event audit report page displaying actual vs estimated margins alongside AI-powered tips

### 🎯 Module 7: AI Customer Preference Learning
- [x] Write preference recommender logic in Python:
  - [x] Compute cosine similarity matrices comparing customer history (past menu item tags, budgets) to available inventory menu choices
- [x] Create `/recommend/customer-preferences` endpoint in FastAPI
- [x] Integrate recommendations to auto-suggest menu themes when entering a returning customer's ID

---

## 📅 Phase 7: Verification, Polishing & Demo Prep (Weeks 13-14)

### 🧪 Verification & Testing
- [x] Write test suite for SvelteKit server routes
- [x] Write unit tests for FastAPI routes and ML model loaders
- [x] Validate metric logs:
  - [x] Log XGBoost MAE & RMSE values
  - [x] Log Prophet/SARIMA MAPE performance values
  - [x] Log Isolation Forest precision/recall scores
- [x] Verify complete offline functionality (confirm Docker Compose loads all UI, DB, and ML components without internet access)

### ✨ Premium CSS & UI Polish
- [x] Apply a cohesive modern theme (receipt style theme, paper token values, custom serif typography)
- [x] Set up interactive micro-animations (hover transitions, page fades, custom loading indicators for AI routes)
- [x] Refine the interactive Gantt chart and time-series dashboard charts

### 📋 Documentation & Defense Preparation
- [x] Complete the final `walkthrough.md` summarizing the project, verified benchmarks, and interface assets
- [x] Draft final presentation slides outline
- [x] Run dry-run walkthroughs of the demo strategy (planning an event -> viewing predictions -> reviewing auto-generated kitchen timelines)

---

## 📅 Phase 14: Top-Bar Navigation and Profile Dropdown System
- [x] Implement dark-mode colors and top-bar horizontal scroll styles in `layout.css`
- [x] Remove mobile bottom navigation bar and adjust `<main>` container padding in `+layout.svelte`
- [x] Refactor top navigation bar to be responsive (top-only, horizontally scrollable on mobile)
- [x] Replace logout button in top bar header with circular User Avatar dropdown launcher
- [x] Implement premium profile dropdown content (switcher list, diagnostics modal, Dark theme toggle, sound toggle, policy footer)
- [x] Bind document keydown listener for **Ctrl + B** keyboard shortcut to launch problem report modal
- [x] Run Svelte build verification compiler check (`npm run build`)


