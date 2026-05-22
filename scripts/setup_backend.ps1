param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$BackendDir = (Join-Path (Get-Location).Path "catersync-backend")
)

$ErrorActionPreference = "Stop"

function Prompt-Default {
    param(
        [string]$Message,
        [string]$Default
    )

    $value = Read-Host "$Message [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }

    return $value
}

function Read-SecretText {
    param(
        [string]$Message,
        [string]$Default = ""
    )

    $secure = Read-Host $Message -AsSecureString
    if ($secure.Length -eq 0) {
        return $Default
    }

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Get-CommandSource {
    param([string[]]$Names)

    foreach ($name in $Names) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            return $cmd.Source
        }
    }

    return $null
}

function Get-PsqlPath {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $postgresRoot = "C:\Program Files\PostgreSQL"
    if (Test-Path $postgresRoot) {
        $candidate = Get-ChildItem -Path $postgresRoot -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($candidate) {
            return $candidate.FullName
        }
    }

    return $null
}

function Invoke-Native {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$FailureMessage
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string[]]$Value
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $Value, $encoding)
}

Write-Host ""
Write-Host "========================================"
Write-Host "CaterSync AI Backend Setup"
Write-Host "========================================"
Write-Host ""

$setupBackend = Prompt-Default "Set up Django backend and PostgreSQL connection now?" "Y"
if ($setupBackend -match "^(n|no)$") {
    Write-Host "[INFO] Backend setup skipped."
    exit 0
}

$python = Get-CommandSource @("python", "py")
if (-not $python) {
    throw "Python was not found in PATH. Install Python 3.9+ before backend setup."
}

$venvDir = Join-Path $BackendDir ".venv"
$requirementsDir = Join-Path $BackendDir "requirements"
$backendPython = Join-Path $venvDir "Scripts\python.exe"
$managePy = Join-Path $BackendDir "manage.py"
$envPath = Join-Path $BackendDir ".env"
$envExamplePath = Join-Path $BackendDir ".env.example"
$gitignorePath = Join-Path $BackendDir ".gitignore"
$settingsPath = Join-Path $BackendDir "config\settings.py"

$dbHost = Prompt-Default "PostgreSQL host" "localhost"
$dbPort = Prompt-Default "PostgreSQL port" "5432"
$pgAdminUser = Prompt-Default "PostgreSQL admin user" "postgres"
$pgAdminPassword = Read-SecretText "PostgreSQL admin password for $pgAdminUser (hidden, blank skips DB/user creation)"
$dbName = Prompt-Default "Application database name" "catersync_ai"
$dbUser = Prompt-Default "Application database user" "catersync_user"
$dbPassword = Read-SecretText "Application database password (hidden, blank uses catersync_password)" "catersync_password"

Write-Host "[INFO] Creating backend folders..."
New-Item -ItemType Directory -Force -Path $BackendDir, $requirementsDir | Out-Null

if (-not (Test-Path $backendPython)) {
    Write-Host "[INFO] Creating Python virtual environment..."
    Invoke-Native $python @("-m", "venv", $venvDir) "Failed to create backend virtual environment."
}

Write-Host "[INFO] Writing backend requirements..."
Set-Content -Path (Join-Path $requirementsDir "base.txt") -Encoding ASCII -Value @(
    "Django>=5.0,<6.0",
    "djangorestframework>=3.15,<4.0",
    "djangorestframework-simplejwt>=5.3,<6.0",
    "django-cors-headers>=4.3,<5.0",
    "django-environ>=0.11,<1.0",
    "psycopg2-binary>=2.9,<3.0",
    "channels>=4.0,<5.0",
    "channels-redis>=4.2,<5.0",
    "whitenoise>=6.6,<7.0",
    "celery>=5.3,<6.0",
    "redis>=5.0,<6.0",
    "pandas>=2.2,<3.0",
    "scikit-learn>=1.4,<2.0",
    "numpy>=1.26,<3.0",
    "python-dotenv>=1.0,<2.0"
)

Set-Content -Path (Join-Path $requirementsDir "development.txt") -Encoding ASCII -Value @(
    "-r base.txt",
    "django-debug-toolbar>=4.3,<5.0",
    "pytest>=8.0,<9.0",
    "pytest-django>=4.8,<5.0",
    "coverage>=7.4,<8.0"
)

Set-Content -Path (Join-Path $requirementsDir "production.txt") -Encoding ASCII -Value @(
    "-r base.txt",
    "gunicorn>=22.0,<24.0",
    "sentry-sdk>=2.0,<3.0"
)

Set-Content -Path (Join-Path $requirementsDir "testing.txt") -Encoding ASCII -Value @(
    "-r development.txt",
    "factory-boy>=3.3,<4.0",
    "faker>=25.0,<40.0"
)

Write-Host "[INFO] Installing backend Python packages..."
Invoke-Native $backendPython @("-m", "pip", "install", "--upgrade", "pip") "Failed to upgrade pip."
Invoke-Native $backendPython @("-m", "pip", "install", "-r", (Join-Path $requirementsDir "development.txt")) "Failed to install backend requirements."

$psql = Get-PsqlPath
$databaseReady = $false

if (-not $psql) {
    Write-Host "[WARNING] psql was not found. The Django .env will be written, but database creation/migrations are skipped."
}
elseif ([string]::IsNullOrWhiteSpace($pgAdminPassword)) {
    Write-Host "[WARNING] No PostgreSQL admin password entered. Database/user creation skipped."
}
else {
    Write-Host "[INFO] Creating PostgreSQL database and application user..."
    $dbSetupSql = Join-Path $env:TEMP "catersync_db_setup.sql"
    @"
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user');
\gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password');
\gexec
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8''', :'app_db', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_db');
\gexec
GRANT ALL PRIVILEGES ON DATABASE :"app_db" TO :"app_user";
\connect :app_db
GRANT ALL ON SCHEMA public TO :"app_user";
ALTER SCHEMA public OWNER TO :"app_user";
"@ | Set-Content -Path $dbSetupSql -Encoding ASCII

    $env:PGPASSWORD = $pgAdminPassword
    & $psql -h $dbHost -p $dbPort -U $pgAdminUser -d postgres -v ON_ERROR_STOP=1 -v "app_user=$dbUser" -v "app_password=$dbPassword" -v "app_db=$dbName" -f $dbSetupSql
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] Database/user creation failed. Check PostgreSQL credentials and service status."
    }
}

if ($psql) {
    Write-Host "[INFO] Testing application database connection..."
    $env:PGPASSWORD = $dbPassword
    & $psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "SELECT current_database(), current_user;" | Out-Host
    $databaseReady = ($LASTEXITCODE -eq 0)
    if (-not $databaseReady) {
        Write-Host "[WARNING] Could not connect using the application database credentials yet."
    }
}

Write-Host "[INFO] Creating Django project skeleton..."
if (-not (Test-Path $managePy)) {
    Invoke-Native $backendPython @("-m", "django", "startproject", "config", $BackendDir) "Failed to create Django project."
}

$appsRoot = Join-Path $BackendDir "apps"
New-Item -ItemType Directory -Force -Path $appsRoot | Out-Null
New-Item -ItemType File -Force -Path (Join-Path $appsRoot "__init__.py") | Out-Null

$localApps = @(
    "authentication",
    "tenants",
    "customers",
    "bookings",
    "inventory",
    "finance",
    "communications",
    "analytics",
    "ai_services"
)

foreach ($app in $localApps) {
    $appDir = Join-Path $appsRoot $app
    $appConfig = Join-Path $appDir "apps.py"
    if (-not (Test-Path $appConfig)) {
        New-Item -ItemType Directory -Force -Path $appDir | Out-Null
        Invoke-Native $backendPython @($managePy, "startapp", $app, $appDir) "Failed to create Django app: $app"
    }

    if (Test-Path $appConfig) {
        (Get-Content $appConfig) -replace "name = '$app'", "name = 'apps.$app'" |
            Set-Content -Path $appConfig -Encoding UTF8
    }
}

$secretKey = (& $backendPython -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())").Trim()

Write-Host "[INFO] Writing Django .env files..."
Write-Utf8NoBom -Path $envPath -Value @(
    "DJANGO_SECRET_KEY=$secretKey",
    "DJANGO_DEBUG=True",
    "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1",
    "CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000",
    "DB_NAME=$dbName",
    "DB_USER=$dbUser",
    "DB_PASSWORD=$dbPassword",
    "DB_HOST=$dbHost",
    "DB_PORT=$dbPort"
)

Write-Utf8NoBom -Path $envExamplePath -Value @(
    "DJANGO_SECRET_KEY=change-me",
    "DJANGO_DEBUG=True",
    "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1",
    "CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000",
    "DB_NAME=catersync_ai",
    "DB_USER=catersync_user",
    "DB_PASSWORD=change-me",
    "DB_HOST=localhost",
    "DB_PORT=5432"
)

Set-Content -Path $gitignorePath -Encoding ASCII -Value @(
    ".env",
    ".venv/",
    "__pycache__/",
    "*.pyc",
    "db.sqlite3",
    "media/",
    "staticfiles/",
    ".coverage",
    "htmlcov/"
)

Write-Host "[INFO] Writing Django settings.py..."
Write-Utf8NoBom -Path $settingsPath -Value @'
from pathlib import Path
from datetime import timedelta
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, []),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "channels",
]

LOCAL_APPS = [
    "apps.authentication",
    "apps.tenants",
    "apps.customers",
    "apps.bookings",
    "apps.inventory",
    "apps.finance",
    "apps.communications",
    "apps.analytics",
    "apps.ai_services",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST"),
        "PORT": env("DB_PORT"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
'@.Split([Environment]::NewLine)

Write-Host "[INFO] Running Django system check..."
Push-Location $BackendDir
try {
    & $backendPython manage.py check
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] Django check failed. Review backend settings."
    }
    elseif ($databaseReady) {
        Write-Host "[INFO] Running Django migrations..."
        & $backendPython manage.py migrate
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARNING] Django migrations failed. Verify database credentials and privileges."
        }
    }
    else {
        Write-Host "[WARNING] Skipping migrations because the application database connection is not verified."
    }

    $createSuperuser = Prompt-Default "Create a Django superuser now?" "N"
    if ($createSuperuser -match "^(y|yes)$") {
        & $backendPython manage.py createsuperuser
    }
}
finally {
    Pop-Location
}

$schemaPath = Join-Path $ProjectRoot "database_schema.sql"
if ($psql -and $databaseReady -and (Test-Path $schemaPath)) {
    $loadSchema = Prompt-Default "Load database_schema.sql into $dbName now? Optional; use after schema review." "N"
    if ($loadSchema -match "^(y|yes)$") {
        $env:PGPASSWORD = $dbPassword
        & $psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f $schemaPath
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARNING] database_schema.sql did not load cleanly. Review schema errors before retrying."
        }
    }
}

Write-Host ""
Write-Host "[INFO] Backend setup complete."
Write-Host "[INFO] Backend directory: $BackendDir"
Write-Host "[INFO] Django env file: $envPath"
Write-Host "[INFO] Database target: $dbUser@$dbHost`:$dbPort/$dbName"
