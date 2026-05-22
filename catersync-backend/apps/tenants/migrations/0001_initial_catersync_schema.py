from pathlib import Path

from django.db import migrations


SCHEMA_SENTINEL_TABLE = "organizations"


def _schema_path() -> Path:
    return Path(__file__).resolve().parents[4] / "database_schema.sql"


def apply_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        raise RuntimeError("CaterSync schema migration requires PostgreSQL.")

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT to_regclass(%s)", [f"public.{SCHEMA_SENTINEL_TABLE}"])
        if cursor.fetchone()[0]:
            return

    sql = _schema_path().read_text(encoding="utf-8")
    sql = sql.replace(
        "COMMENT ON DATABASE postgres IS 'CaterSync-AI: Multi-tenant AI-powered catering management system';",
        "",
    )
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(sql)


def unapply_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    sql = """
        DROP VIEW IF EXISTS
            v_financial_summary,
            v_inventory_alerts,
            v_kitchen_schedule,
            v_customer_loyalty,
            v_active_bookings
        CASCADE;

        DROP FUNCTION IF EXISTS create_notification(UUID, UUID, VARCHAR, VARCHAR, TEXT, JSONB) CASCADE;
        DROP FUNCTION IF EXISTS update_inventory_stock(UUID, DECIMAL, VARCHAR, VARCHAR, UUID, UUID) CASCADE;
        DROP FUNCTION IF EXISTS update_customer_stats(UUID) CASCADE;
        DROP FUNCTION IF EXISTS update_booking_totals(UUID) CASCADE;
        DROP FUNCTION IF EXISTS generate_order_number(UUID) CASCADE;
        DROP FUNCTION IF EXISTS generate_booking_reference(UUID) CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

        DROP TABLE IF EXISTS
            file_uploads,
            notifications,
            activity_logs,
            customer_analytics,
            ai_insights,
            delivery_assignments,
            delivery_vehicles,
            event_assignments,
            staff_availability,
            recipe_ingredients,
            stock_movements,
            inventory_items,
            inventory_categories,
            kitchen_order_items,
            kitchen_orders,
            invoices,
            payments,
            booking_services,
            booking_menu_items,
            bookings,
            occasions,
            package_items,
            packages,
            menu_items,
            menu_categories,
            customer_tag_assignments,
            customer_tags,
            customers,
            users,
            organizations
        CASCADE;

        DROP TYPE IF EXISTS kitchen_order_status CASCADE;
        DROP TYPE IF EXISTS payment_method CASCADE;
        DROP TYPE IF EXISTS payment_status CASCADE;
        DROP TYPE IF EXISTS booking_status CASCADE;
        """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(sql)


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.RunPython(apply_schema, unapply_schema),
    ]
