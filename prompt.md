# Claude Execution Prompt - CaterSync AI Phase 2

You are working in the `CaterSync-AI` repository. Your job is to complete **Phase 2: Backend Core Development** from `tasklist.md` as quickly and accurately as possible.

Do not regenerate the whole task list. Do not work on Phase 3+ frontend screens, AI model training, deployment production hardening, or broad redesigns unless they are required to complete Phase 2 backend tasks.

## Current Project State

The project already has:

- Django backend in `catersync-backend/`
- PostgreSQL configured through `catersync-backend/.env`
- Django REST Framework, SimpleJWT, CORS, Channels, and logging configured
- JWT token endpoints already wired
- Django admin basic branding already wired
- Full SQL schema applied through `apps/tenants/migrations/0001_initial_catersync_schema.py`
- Flutter app scaffold exists, but Phase 2 is backend-focused
- Phase 1 setup is mostly complete

Before making changes, inspect:

- `tasklist.md`
- `database_schema.sql`
- `catersync-backend/config/settings.py`
- `catersync-backend/config/urls.py`
- `catersync-backend/apps/**`

## Primary Goal

Complete Phase 2 in order, starting from the first unchecked Phase 2 item:

1. `2.1.2 Multi-Tenant Architecture`
2. `2.1.3 Authentication & Authorization System`
3. `2.2 Core Business Logic APIs`
4. `2.3 Communication & Integration APIs`

Work from the top of Phase 2 downward. Keep changes production-minded but scoped.

## Speed Rules

Move fast, but do not guess blindly.

- Do not spend a long time planning. Inspect only the files needed for the next task.
- Prefer small, working vertical slices over large unfinished rewrites.
- If a task is too large, complete the smallest useful backend slice and document what remains.
- Do not pause to ask questions unless the repo is missing information that cannot be reasonably inferred.
- Do not write long explanations while working. Implement, verify, update the checklist, then summarize.
- Avoid speculative abstractions. Use the existing Django app structure.
- Do not rewrite unrelated files.

## Accuracy Rules

- Keep Django and PostgreSQL in sync.
- Do not directly edit applied database objects without a Django migration.
- If you add tables, functions, triggers, indexes, or constraints, use Django migrations.
- If the existing SQL schema already created a table, prefer unmanaged Django models mapped to that table unless a safer managed migration path is clearly needed.
- Never expose `.env` secrets.
- Do not mark a task complete unless it is implemented and verified.
- If partial work is done, leave the task unchecked and write a short note in your final response.

## Required Phase 2 Implementation Direction

### Multi-Tenant Architecture

Implement backend support for tenant-aware access:

- Map the existing `organizations` table to a Django model.
- Add tenant utilities/middleware or request helpers as appropriate.
- Ensure API queries are scoped by organization where applicable.
- Add tenant registration and tenant management endpoints.
- Add tests or API checks for tenant scoping.

### Authentication & Authorization

Build on SimpleJWT:

- Add registration/login/profile endpoints.
- Add user model mapping for the existing `users` table or a compatible auth bridge.
- Add role-based permissions using roles from the schema.
- Add password validation and secure password hashing.
- Add audit/activity logging for auth-sensitive actions when practical.
- Add session/logout/token blacklist behavior if needed.

### Core Business APIs

Create DRF serializers, viewsets, URLs, permissions, and tests for:

- Users/staff
- Customers
- Bookings
- Menu categories/items/packages/occasions as needed for bookings
- Inventory items/categories/stock movements
- Payments/invoices

Use pagination, filtering, permissions, and organization scoping.

### Communication & Integration APIs

Implement backend foundations for:

- Notifications
- Email notification service abstraction
- WebSocket/Channels routing foundation
- Chat/message storage if schema support exists or create migrations if needed
- External integration stubs with clear interfaces, not fake production secrets

## Expected File Patterns

Prefer this structure inside each Django app:

- `models.py`
- `serializers.py`
- `views.py`
- `urls.py`
- `permissions.py` when needed
- `services.py` for business logic
- `tests.py` or `tests/`

Update `config/urls.py` to include app URLs.

## Verification Commands

Run these before marking relevant tasks complete:

```powershell
cd catersync-backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py showmigrations
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py test
```

If tests are not yet comprehensive, add focused tests for the behavior you implement.

Also verify important API endpoints manually with Django test client, DRF APIClient tests, or direct local requests.

## Checklist Update Rules

After verification, update `tasklist.md`:

- Change `[ ]` to `[x]` only for tasks that are truly complete.
- Do not mark whole groups complete if only a scaffold exists.
- Keep Phase 1 and Phase 3+ untouched unless your work actually completes a listed item.

## Final Response Format

Keep the final response short and useful:

- State what Phase 2 tasks were completed.
- List key files changed.
- List verification commands and results.
- List remaining unchecked Phase 2 blockers.

Prioritize accurate working backend code over long commentary.
