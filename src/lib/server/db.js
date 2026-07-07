import { env } from '$env/dynamic/private';
import { AsyncLocalStorage } from 'node:async_hooks';

const connectionString = env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/catersync';

// Create a singleton connection pool for PostgreSQL fallback (loaded dynamically to avoid bundling issues on Cloudflare)
let pgPool = null;
async function getPgPool() {
  if (pgPool) return pgPool;
  try {
    const pg = await import('pg');
    pgPool = new pg.default.Pool({
      connectionString,
      // Add reasonable connection pool limits for a local/offline server
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    pgPool.on('error', (err) => {
      console.error('⚠️ Unexpected error on idle PostgreSQL client:', err);
    });
    return pgPool;
  } catch (e) {
    console.warn('⚠️ Failed to initialize PostgreSQL pool:', e.message);
    return null;
  }
}

// Storage to keep track of request's platform object (Cloudflare Workers environment bindings)
export const platformStorage = new AsyncLocalStorage();

async function executeD1Query(db, sql, params) {
  // Convert PostgreSQL placeholders ($1, $2, etc.) to SQLite placeholders (?1, ?2, etc.)
  const translatedSql = sql.replace(/\$(\d+)/g, '?$1');

  // Serialize Javascript arrays / JSON to JSON strings for SQLite
  const sqliteParams = params.map(val => {
    if (Array.isArray(val) || (val && typeof val === 'object' && val.constructor === Object)) {
      return JSON.stringify(val);
    }
    return val;
  });

  try {
    const stmt = db.prepare(translatedSql);
    const res = await stmt.bind(...sqliteParams).all();

    // Format D1 results to match PG query format
    const arrayColumns = ['allergies', 'dietary_prefs', 'cuisine_tags', 'ingredients_json'];
    const booleanColumns = ['is_outdoor', 'low_stock_alerts_enabled', 'sound_enabled_default', 'is_active'];

    const rows = (res.results || []).map(row => {
      const formatted = { ...row };

      // Deserialize JSON strings back to Javascript arrays/objects
      for (const col of arrayColumns) {
        if (formatted[col] !== undefined && typeof formatted[col] === 'string') {
          try {
            formatted[col] = JSON.parse(formatted[col]);
          } catch (e) {}
        }
      }

      // Map numeric flags back to Javascript booleans
      for (const col of booleanColumns) {
        if (formatted[col] !== undefined && typeof formatted[col] === 'number') {
          formatted[col] = formatted[col] === 1;
        }
      }

      return formatted;
    });

    return { rows };
  } catch (err) {
    console.error('❌ Cloudflare D1 Query execution failed:', err);
    throw err;
  }
}

async function executeRemoteD1Proxy(sql, params) {
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || '42cd6827b074b6fa8b7a040dd9962bcf';
  const databaseId = env.CLOUDFLARE_DATABASE_ID || '0618bd9e-5cd1-464a-89dc-5416cfa05821';

  // Convert PostgreSQL placeholders ($1, $2, etc.) to SQLite placeholders (?1, ?2, etc.)
  const translatedSql = sql.replace(/\$(\d+)/g, '?$1');

  // Serialize Javascript arrays / JSON to JSON strings for SQLite
  const sqliteParams = params.map(val => {
    if (Array.isArray(val) || (val && typeof val === 'object' && val.constructor === Object)) {
      return JSON.stringify(val);
    }
    return val;
  });

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: translatedSql,
          params: sqliteParams
        })
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      const errMsg = data.errors && data.errors[0] ? data.errors[0].message : 'Unknown error';
      throw new Error(`Cloudflare D1 REST API Error: ${errMsg}`);
    }

    const res = data.result[0];
    if (!res.success) {
      const dbErrMsg = res.errors && res.errors[0] ? res.errors[0].message : 'Query compilation failed';
      throw new Error(`D1 Query Error: ${dbErrMsg}`);
    }

    // Format D1 results to match PG query format
    const arrayColumns = ['allergies', 'dietary_prefs', 'cuisine_tags', 'ingredients_json'];
    const booleanColumns = ['is_outdoor', 'low_stock_alerts_enabled', 'sound_enabled_default', 'is_active'];

    const rows = (res.results || []).map(row => {
      const formatted = { ...row };

      // Deserialize JSON strings back to Javascript arrays/objects
      for (const col of arrayColumns) {
        if (formatted[col] !== undefined && typeof formatted[col] === 'string') {
          try {
            formatted[col] = JSON.parse(formatted[col]);
          } catch (e) {}
        }
      }

      // Map numeric flags back to Javascript booleans
      for (const col of booleanColumns) {
        if (formatted[col] !== undefined && typeof formatted[col] === 'number') {
          formatted[col] = formatted[col] === 1;
        }
      }

      return formatted;
    });

    return { rows };
  } catch (err) {
    console.error('❌ Cloudflare D1 Remote Proxy execution failed:', err);
    throw err;
  }
}

export const pool = {
  async query(sql, params = []) {
    const platform = platformStorage.getStore();

    // 1. If we are running inside Cloudflare Pages (with D1 database binding)
    if (platform && platform.env && platform.env.DB) {
      const db = platform.env.DB;
      return await executeD1Query(db, sql, params);
    }

    // 2. If we are running locally in Node but configured to proxy to remote D1
    if (env.CLOUDFLARE_API_TOKEN) {
      return await executeRemoteD1Proxy(sql, params);
    }

    // 2. Fallback to PostgreSQL (Local / Offline dev mode)
    const activePool = await getPgPool();
    if (activePool) {
      return await activePool.query(sql, params);
    }

    throw new Error('No active database connection found (D1 binding is missing and PostgreSQL is offline).');
  }
};

// Run automatic schema upgrades if database is active (only on local PostgreSQL)
if (env.DATABASE_URL) {
  getPgPool().then((activePool) => {
    if (activePool) {
      activePool.query(`
        CREATE TABLE IF NOT EXISTS business_settings (
            id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            business_name VARCHAR(255) NOT NULL DEFAULT 'CaterSync',
            currency_symbol VARCHAR(5) NOT NULL DEFAULT '₱',
            overhead_rate NUMERIC(5,4) NOT NULL DEFAULT 0.12 CHECK (overhead_rate BETWEEN 0 AND 1),
            min_budget_per_guest NUMERIC(10,2) NOT NULL DEFAULT 150.00,
            risk_medium_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.35,
            risk_high_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.60,
            low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
            sound_enabled_default BOOLEAN NOT NULL DEFAULT false,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        INSERT INTO business_settings (id, business_name, currency_symbol) 
        VALUES (1, 'CaterSync-AI Operations', '₱')
        ON CONFLICT (id) DO NOTHING;
        ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
        
        -- SMTP Credentials Columns
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS gmail_address VARCHAR(255);
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS gmail_app_password VARCHAR(255);
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255);
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS smtp_port INT;
        
        ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(128);

        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(100) NOT NULL DEFAULT 'Operator',
            is_active BOOLEAN DEFAULT TRUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        INSERT INTO users (username, password_hash, role)
        VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Admin')
        ON CONFLICT (username) DO NOTHING;

        -- Migration for customer email
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT '';

        -- Phase 12 Database Schema Extensions (Operational Modules)
        CREATE TABLE IF NOT EXISTS roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS permissions (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY,
            user_id INT,
            action TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS branches (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            location VARCHAR(255)
        );

        -- B. CRM & Sales
        CREATE TABLE IF NOT EXISTS leads (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            contact VARCHAR(255),
            status VARCHAR(50) DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Quoted', 'Won', 'Lost')),
            lost_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS lead_activities (
            id SERIAL PRIMARY KEY,
            lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            activity_type VARCHAR(100) NOT NULL,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS quotations (
            id SERIAL PRIMARY KEY,
            lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
            total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
            status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected'))
        );
        CREATE TABLE IF NOT EXISTS quotation_items (
            id SERIAL PRIMARY KEY,
            quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
            item_name VARCHAR(255) NOT NULL,
            quantity INT NOT NULL,
            unit_price NUMERIC(10, 2) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS quotation_versions (
            id SERIAL PRIMARY KEY,
            quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
            version_number INT NOT NULL,
            content_json JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- C. Booking/Orders
        CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            item_type VARCHAR(100) NOT NULL, -- 'menu', 'rental', 'service', 'fee'
            item_name VARCHAR(255) NOT NULL,
            quantity NUMERIC(12, 2) NOT NULL,
            unit_price NUMERIC(10, 2) NOT NULL,
            total_price NUMERIC(12, 2) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS order_status_history (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            old_status VARCHAR(50),
            new_status VARCHAR(50) NOT NULL,
            changed_by INT,
            changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS resource_holds (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            resource_type VARCHAR(100) NOT NULL,
            resource_id INT NOT NULL,
            hold_start TIMESTAMP WITH TIME ZONE NOT NULL,
            hold_end TIMESTAMP WITH TIME ZONE NOT NULL
        );

        -- D. Contracts
        CREATE TABLE IF NOT EXISTS contracts (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Signed', 'Expired')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS contract_signatures (
            id SERIAL PRIMARY KEY,
            contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
            signer_name VARCHAR(255) NOT NULL,
            signature_svg TEXT,
            ip_address VARCHAR(45),
            signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- E. Menu/Recipe
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
            id SERIAL PRIMARY KEY,
            menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
            ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
            quantity NUMERIC(12, 4) NOT NULL,
            unit VARCHAR(50) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS menu_item_steps (
            id SERIAL PRIMARY KEY,
            menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
            step_number INT NOT NULL,
            instruction TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS allergen_tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS menu_item_allergens (
            menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
            allergen_tag_id INT NOT NULL REFERENCES allergen_tags(id) ON DELETE CASCADE,
            PRIMARY KEY (menu_item_id, allergen_tag_id)
        );
        CREATE TABLE IF NOT EXISTS menu_cost_history (
            id SERIAL PRIMARY KEY,
            menu_id INT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
            cost_per_serving NUMERIC(10, 2) NOT NULL,
            price_per_serving NUMERIC(10, 2) NOT NULL,
            recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- F. Inventory
        CREATE TABLE IF NOT EXISTS inventory_locations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS units_of_measure (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS unit_conversions (
            id SERIAL PRIMARY KEY,
            from_unit_id INT NOT NULL REFERENCES units_of_measure(id),
            to_unit_id INT NOT NULL REFERENCES units_of_measure(id),
            multiplier NUMERIC(12, 6) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stock_batches (
            id SERIAL PRIMARY KEY,
            ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            batch_number VARCHAR(100) NOT NULL,
            expiry_date DATE,
            quantity NUMERIC(12, 4) NOT NULL,
            unit_cost NUMERIC(10, 2) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id SERIAL PRIMARY KEY,
            ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            location_id INT REFERENCES inventory_locations(id),
            transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('Receipt', 'Consumption', 'Waste', 'Adjustment', 'Transfer', 'Return')),
            quantity NUMERIC(12, 4) NOT NULL,
            unit_cost NUMERIC(10, 2),
            reference_id INT,
            reference_type VARCHAR(100),
            performed_by INT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stocktakes (
            id SERIAL PRIMARY KEY,
            location_id INT NOT NULL REFERENCES inventory_locations(id),
            conducted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
            conducted_by INT
        );
        CREATE TABLE IF NOT EXISTS stocktake_lines (
            id SERIAL PRIMARY KEY,
            stocktake_id INT NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
            ingredient_id INT NOT NULL REFERENCES ingredients(id),
            system_qty NUMERIC(12, 4) NOT NULL,
            actual_qty NUMERIC(12, 4) NOT NULL,
            variance NUMERIC(12, 4) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS waste_logs (
            id SERIAL PRIMARY KEY,
            ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            quantity NUMERIC(12, 4) NOT NULL,
            reason VARCHAR(100) NOT NULL,
            logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- G. Purchasing
        CREATE TABLE IF NOT EXISTS purchase_order_headers (
            id SERIAL PRIMARY KEY,
            supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
            status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Sent', 'Partially Received', 'Closed')),
            total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS purchase_order_lines (
            id SERIAL PRIMARY KEY,
            purchase_order_id INT NOT NULL REFERENCES purchase_order_headers(id) ON DELETE CASCADE,
            ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
            quantity NUMERIC(12, 4) NOT NULL,
            unit_cost NUMERIC(10, 2) NOT NULL,
            total_cost NUMERIC(12, 2) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS goods_receipts (
            id SERIAL PRIMARY KEY,
            purchase_order_id INT REFERENCES purchase_order_headers(id) ON DELETE SET NULL,
            received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
            received_by INT
        );
        CREATE TABLE IF NOT EXISTS supplier_price_history (
            id SERIAL PRIMARY KEY,
            supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            price_per_unit NUMERIC(10, 2) NOT NULL,
            recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS supplier_performance_snapshots (
            id SERIAL PRIMARY KEY,
            supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            on_time_delivery_rate NUMERIC(5, 2),
            fulfillment_rate NUMERIC(5, 2),
            calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rfqs (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'Draft',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- H. Equipment/Venue
        CREATE TABLE IF NOT EXISTS equipment_assets (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            category VARCHAR(100),
            total_qty INT NOT NULL DEFAULT 1,
            damaged_qty INT NOT NULL DEFAULT 0,
            unit_cost NUMERIC(10, 2)
        );
        CREATE TABLE IF NOT EXISTS venues (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            capacity INT,
            address TEXT
        );
        CREATE TABLE IF NOT EXISTS equipment_bookings (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            equipment_id INT NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
            quantity INT NOT NULL,
            checked_out_at TIMESTAMP WITH TIME ZONE,
            checked_in_at TIMESTAMP WITH TIME ZONE
        );
        CREATE TABLE IF NOT EXISTS equipment_maintenance_logs (
            id SERIAL PRIMARY KEY,
            equipment_id INT NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
            action_taken TEXT NOT NULL,
            cost NUMERIC(10, 2),
            logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- I. Kitchen
        CREATE TABLE IF NOT EXISTS kitchen_tasks (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
            task_name VARCHAR(255) NOT NULL,
            prep_time_minutes INT NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed'))
        );
        CREATE TABLE IF NOT EXISTS production_status_logs (
            id SERIAL PRIMARY KEY,
            task_id INT NOT NULL REFERENCES kitchen_tasks(id) ON DELETE CASCADE,
            status VARCHAR(50) NOT NULL,
            logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS haccp_logs (
            id SERIAL PRIMARY KEY,
            task_id INT REFERENCES kitchen_tasks(id) ON DELETE SET NULL,
            temperature NUMERIC(5, 2) NOT NULL,
            hold_time_minutes INT,
            logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- J. Staffing
        CREATE TABLE IF NOT EXISTS staff_availability (
            id SERIAL PRIMARY KEY,
            staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            is_available BOOLEAN DEFAULT TRUE NOT NULL,
            CONSTRAINT uq_staff_date UNIQUE (staff_id, date)
        );
        CREATE TABLE IF NOT EXISTS staff_time_logs (
            id SERIAL PRIMARY KEY,
            staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            event_id INT REFERENCES events(id) ON DELETE SET NULL,
            clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
            clock_out TIMESTAMP WITH TIME ZONE,
            total_hours NUMERIC(5, 2)
        );
        CREATE TABLE IF NOT EXISTS staff_leave_requests (
            id SERIAL PRIMARY KEY,
            staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected'))
        );
        CREATE TABLE IF NOT EXISTS staff_certifications (
            id SERIAL PRIMARY KEY,
            staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            certification_name VARCHAR(255) NOT NULL,
            expiry_date DATE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payroll_runs (
            id SERIAL PRIMARY KEY,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payroll_lines (
            id SERIAL PRIMARY KEY,
            payroll_run_id INT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
            staff_id INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            total_hours NUMERIC(6, 2) NOT NULL,
            gross_pay NUMERIC(10, 2) NOT NULL
        );

        -- K. Logistics
        CREATE TABLE IF NOT EXISTS vehicles (
            id SERIAL PRIMARY KEY,
            plate_number VARCHAR(50) NOT NULL UNIQUE,
            model VARCHAR(100),
            capacity_kg NUMERIC(8, 2)
        );
        CREATE TABLE IF NOT EXISTS delivery_routes (
            id SERIAL PRIMARY KEY,
            vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
            route_date DATE NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending'
        );
        CREATE TABLE IF NOT EXISTS delivery_stops (
            id SERIAL PRIMARY KEY,
            route_id INT NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
            event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            stop_sequence INT NOT NULL,
            eta TIMESTAMP WITH TIME ZONE
        );
        CREATE TABLE IF NOT EXISTS proof_of_delivery (
            id SERIAL PRIMARY KEY,
            stop_id INT NOT NULL REFERENCES delivery_stops(id) ON DELETE CASCADE,
            recipient_name VARCHAR(255) NOT NULL,
            signature_svg TEXT,
            ip_address VARCHAR(45),
            signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- L. Billing
        CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            invoice_number VARCHAR(100) NOT NULL UNIQUE,
            total_amount NUMERIC(12, 2) NOT NULL,
            tax_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
            discount_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
            status VARCHAR(50) DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Cancelled')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS invoice_lines (
            id SERIAL PRIMARY KEY,
            invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            quantity NUMERIC(12, 2) NOT NULL,
            unit_price NUMERIC(10, 2) NOT NULL,
            total_price NUMERIC(12, 2) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            payment_method VARCHAR(100) NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            transaction_reference VARCHAR(255),
            paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payment_schedules (
            id SERIAL PRIMARY KEY,
            invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            due_date DATE NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending'
        );
        CREATE TABLE IF NOT EXISTS refunds (
            id SERIAL PRIMARY KEY,
            payment_id INT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
            amount NUMERIC(12, 2) NOT NULL,
            reason TEXT,
            refunded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- M. Accounting
        CREATE TABLE IF NOT EXISTS chart_of_accounts (
            id SERIAL PRIMARY KEY,
            account_code VARCHAR(50) NOT NULL UNIQUE,
            account_name VARCHAR(255) NOT NULL,
            account_type VARCHAR(100) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS journal_entries (
            id SERIAL PRIMARY KEY,
            reference VARCHAR(255),
            entry_date DATE NOT NULL,
            posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS journal_lines (
            id SERIAL PRIMARY KEY,
            journal_entry_id INT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
            account_id INT NOT NULL REFERENCES chart_of_accounts(id),
            debit NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
            credit NUMERIC(12, 2) DEFAULT 0.00 NOT NULL
        );
        CREATE TABLE IF NOT EXISTS expenses (
            id SERIAL PRIMARY KEY,
            description TEXT NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            spent_at DATE NOT NULL
        );

        -- N. Comms
        CREATE TABLE IF NOT EXISTS notifications_log (
            id SERIAL PRIMARY KEY,
            recipient VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'push'
            subject VARCHAR(255),
            message TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'Sent',
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS communication_log (
            id SERIAL PRIMARY KEY,
            customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
            message TEXT NOT NULL,
            logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notification_templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            subject VARCHAR(255),
            body_template TEXT NOT NULL
        );

        -- O/P. Portal/Feedback
        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
            rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comments TEXT,
            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS support_tickets (
            id SERIAL PRIMARY KEY,
            customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            subject VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'Open',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- R. Real AI
        CREATE TABLE IF NOT EXISTS model_registry (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            version VARCHAR(50) NOT NULL,
            file_path VARCHAR(500),
            is_active BOOLEAN DEFAULT TRUE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS prediction_accuracy_logs (
            id SERIAL PRIMARY KEY,
            model_name VARCHAR(255) NOT NULL,
            prediction_id INT NOT NULL,
            predicted_val NUMERIC(12, 4) NOT NULL,
            actual_val NUMERIC(12, 4) NOT NULL,
            error_rate NUMERIC(5, 4) NOT NULL,
            logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `).then(() => {
        console.log('✅ PostgreSQL Schema upgrades completed successfully.');
      }).catch((err) => {
        console.warn('⚠️ PostgreSQL Schema upgrade skipped or failed (offline simulation mode will handle config):', err.message);
      });
    }
  });
}

export default pool;
