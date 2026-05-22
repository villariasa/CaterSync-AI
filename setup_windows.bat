@echo off
setlocal enabledelayedexpansion

REM CaterSync AI - Windows Development Environment Setup
REM Installs/checks desktop, mobile, backend, and PostgreSQL development tooling.

set "TOOLS_MISSING=false"
set "PROJECT_ROOT=%CD%"
set "BACKEND_DIR=%PROJECT_ROOT%\catersync-backend"
set "ANDROID_PLATFORM=android-35"
set "ANDROID_BUILD_TOOLS=35.0.0"
set "ANDROID_CMDLINE_TOOLS_URL=https://dl.google.com/android/repository/commandlinetools-win-14742923_latest.zip"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_HOME=%ANDROID_SDK_ROOT%"

echo.
echo ========================================
echo CaterSync AI Development Environment Setup
echo ========================================
echo.

echo [INFO] Checking Windows Package Manager ^(winget^)...
winget --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] winget is required for automatic installation. Install App Installer from Microsoft Store, then rerun this script.
    set "TOOLS_MISSING=true"
)

REM 1. Git
echo [INFO] Checking Git installation...
git --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('git --version') do echo [INFO] Git is already installed: %%i
) else (
    echo [INFO] Installing Git...
    winget install --id Git.Git -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Git. Please install manually from https://git-scm.com/
        set "TOOLS_MISSING=true"
    )
)

git config --global user.name >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARNING] Git user is not configured. Run these later:
    echo git config --global user.name "Your Name"
    echo git config --global user.email "your.email@example.com"
)

REM 2. Python 3.9+
echo [INFO] Checking Python 3.9+ installation...
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('python --version') do echo [INFO] %%i is installed and meets requirements
) else (
    echo [INFO] Installing Python 3.11...
    winget install --id Python.Python.3.11 -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Python. Please install manually from https://python.org/
        set "TOOLS_MISSING=true"
    )
)

echo [INFO] Checking pip...
python -m pip --version >nul 2>&1
if !errorlevel! neq 0 (
    python -m ensurepip --upgrade
)

echo [INFO] Checking global Django installation...
python -c "import django" >nul 2>&1
if !errorlevel! neq 0 (
    echo [INFO] Installing Django globally for command-line access...
    python -m pip install django
    if !errorlevel! neq 0 (
        echo [WARNING] Global Django install failed. The backend virtualenv will still install Django.
    )
) else (
    for /f "tokens=*" %%i in ('python -c "import django; print(django.get_version())"') do echo [INFO] Django %%i is already installed globally
)

REM 3. PostgreSQL
echo [INFO] Checking PostgreSQL installation...
psql --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('psql --version') do echo [INFO] %%i
) else (
    echo [INFO] Installing PostgreSQL...
    winget install --id PostgreSQL.PostgreSQL -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install PostgreSQL. Please install manually from https://postgresql.org/
        set "TOOLS_MISSING=true"
    ) else (
        echo [WARNING] PostgreSQL may need a new terminal before psql appears in PATH.
    )
)

REM Refresh common PostgreSQL bin folders for this session.
for /d %%d in ("C:\Program Files\PostgreSQL\*\bin") do (
    if exist "%%d\psql.exe" set "PATH=%PATH%;%%d"
)

REM 4. Backend and database setup
echo.
echo ========================================
echo Backend, Django, and PostgreSQL Setup
echo ========================================
echo.

if exist "%PROJECT_ROOT%\scripts\setup_backend.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\setup_backend.ps1" -ProjectRoot "%PROJECT_ROOT%" -BackendDir "%BACKEND_DIR%"
    if !errorlevel! neq 0 (
        echo [ERROR] Backend setup helper failed.
        set "TOOLS_MISSING=true"
    )
) else (
    echo [ERROR] Missing backend setup helper: %PROJECT_ROOT%\scripts\setup_backend.ps1
    set "TOOLS_MISSING=true"
)

REM 5. Node.js
echo [INFO] Checking Node.js installation...
node --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo [INFO] Node.js %%i is already installed
) else (
    echo [INFO] Installing Node.js LTS...
    winget install --id OpenJS.NodeJS -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Node.js. Please install manually from https://nodejs.org/
        set "TOOLS_MISSING=true"
    )
)

npm --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do echo [INFO] npm %%i is installed
) else (
    echo [WARNING] npm not found. It should be installed with Node.js.
)

REM 6. Flutter
echo [INFO] Checking Flutter installation...
flutter --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%i in ('flutter --version ^| findstr "Flutter"') do echo [INFO] Flutter %%i is already installed
) else (
    echo [INFO] Installing Flutter SDK from the stable channel...
    if not exist "C:\development" mkdir "C:\development"
    if not exist "C:\development\flutter\bin\flutter.bat" (
        git clone https://github.com/flutter/flutter.git -b stable "C:\development\flutter"
        if !errorlevel! neq 0 (
            echo [ERROR] Failed to clone Flutter SDK. Install manually from https://docs.flutter.dev/get-started/install/windows
            set "TOOLS_MISSING=true"
        )
    )

    powershell -NoProfile -ExecutionPolicy Bypass -Command "$flutter='C:\development\flutter\bin'; $userPath=[Environment]::GetEnvironmentVariable('Path','User'); if (-not $userPath) { $userPath='' }; if ($userPath -notlike ('*' + $flutter + '*')) { $userPath=($userPath.TrimEnd(';') + ';' + $flutter).TrimStart(';'); [Environment]::SetEnvironmentVariable('Path',$userPath,'User') }"
    set "PATH=%PATH%;C:\development\flutter\bin"
)

flutter --version >nul 2>&1
if !errorlevel! equ 0 (
    echo [INFO] Ensuring Flutter uses the stable channel...
    flutter channel stable >nul 2>&1
    flutter upgrade >nul 2>&1
    if !errorlevel! neq 0 echo [WARNING] Flutter upgrade failed. You can retry later with: flutter upgrade
)

REM 7. Java JDK for Android builds
echo [INFO] Checking Java JDK installation...
java -version >nul 2>&1
if !errorlevel! equ 0 (
    echo [INFO] Java is already installed
) else (
    echo [INFO] Installing Microsoft OpenJDK 17...
    winget install --id Microsoft.OpenJDK.17 -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Java JDK 17. Please install JDK 17 manually.
        set "TOOLS_MISSING=true"
    )
)

for /d %%d in ("C:\Program Files\Microsoft\jdk-17*") do (
    if exist "%%d\bin\java.exe" (
        set "JAVA_HOME=%%d"
        setx JAVA_HOME "%%d" >nul 2>&1
    )
)

REM 8. VS Code
echo [INFO] Checking VS Code installation...
code --version >nul 2>&1
if !errorlevel! equ 0 (
    echo [INFO] VS Code is already installed
) else (
    echo [INFO] Installing VS Code...
    winget install --id Microsoft.VisualStudioCode -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install VS Code. Please install manually from https://code.visualstudio.com/
        set "TOOLS_MISSING=true"
    )
)

code --version >nul 2>&1
if !errorlevel! equ 0 (
    echo [INFO] Installing VS Code Flutter/Dart/Python extensions...
    code --install-extension Dart-Code.dart-code --force >nul 2>&1
    code --install-extension Dart-Code.flutter --force >nul 2>&1
    code --install-extension ms-python.python --force >nul 2>&1
)

REM 9. Android Studio and Android SDK
echo [INFO] Checking Android Studio installation...
if exist "C:\Program Files\Android\Android Studio" (
    echo [INFO] Android Studio appears to be installed
) else (
    echo [INFO] Installing Android Studio...
    winget install --id Google.AndroidStudio -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Android Studio. Please install manually from https://developer.android.com/studio
        set "TOOLS_MISSING=true"
    )
)

echo [INFO] Configuring Android SDK environment variables...
if not exist "!ANDROID_SDK_ROOT!" mkdir "!ANDROID_SDK_ROOT!"
setx ANDROID_SDK_ROOT "!ANDROID_SDK_ROOT!" >nul 2>&1
setx ANDROID_HOME "!ANDROID_HOME!" >nul 2>&1
set "PATH=%PATH%;!ANDROID_SDK_ROOT!\cmdline-tools\latest\bin;!ANDROID_SDK_ROOT!\platform-tools;!ANDROID_SDK_ROOT!\emulator"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$sdk=$env:ANDROID_SDK_ROOT; $paths=@((Join-Path $sdk 'cmdline-tools\latest\bin'), (Join-Path $sdk 'platform-tools'), (Join-Path $sdk 'emulator')); $userPath=[Environment]::GetEnvironmentVariable('Path','User'); if (-not $userPath) { $userPath='' }; foreach ($p in $paths) { if ($userPath -notlike ('*' + $p + '*')) { $userPath=($userPath.TrimEnd(';') + ';' + $p).TrimStart(';') } }; [Environment]::SetEnvironmentVariable('Path',$userPath,'User')"

set "SDKMANAGER=!ANDROID_SDK_ROOT!\cmdline-tools\latest\bin\sdkmanager.bat"
if not exist "!SDKMANAGER!" (
    echo [INFO] Installing Android SDK command-line tools...
    set "ANDROID_TOOLS_ZIP=%TEMP%\android_cmdline_tools.zip"
    set "ANDROID_TOOLS_TMP=%TEMP%\android_cmdline_tools"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force $env:ANDROID_TOOLS_TMP -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force -Path $env:ANDROID_TOOLS_TMP | Out-Null; Invoke-WebRequest -Uri $env:ANDROID_CMDLINE_TOOLS_URL -OutFile $env:ANDROID_TOOLS_ZIP; Expand-Archive -Path $env:ANDROID_TOOLS_ZIP -DestinationPath $env:ANDROID_TOOLS_TMP -Force; New-Item -ItemType Directory -Force -Path (Join-Path $env:ANDROID_SDK_ROOT 'cmdline-tools\latest') | Out-Null; Copy-Item -Path (Join-Path $env:ANDROID_TOOLS_TMP 'cmdline-tools\*') -Destination (Join-Path $env:ANDROID_SDK_ROOT 'cmdline-tools\latest') -Recurse -Force"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Android SDK command-line tools.
        set "TOOLS_MISSING=true"
    )
)

if exist "!SDKMANAGER!" (
    echo [INFO] Installing Android SDK platform tools, build tools, emulator, and platform !ANDROID_PLATFORM!...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "& $env:SDKMANAGER --sdk_root=$env:ANDROID_SDK_ROOT 'platform-tools' 'platforms;%ANDROID_PLATFORM%' 'build-tools;%ANDROID_BUILD_TOOLS%' 'emulator' 'cmdline-tools;latest'"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install one or more Android SDK packages.
        set "TOOLS_MISSING=true"
    )

    echo [INFO] Accepting Android SDK licenses...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "1..80 | ForEach-Object { 'y' } | & $env:SDKMANAGER --sdk_root=$env:ANDROID_SDK_ROOT --licenses"
    if !errorlevel! neq 0 echo [WARNING] Android SDK licenses may still need manual acceptance: flutter doctor --android-licenses
) else (
    echo [ERROR] sdkmanager was not found. Android SDK setup is incomplete.
    set "TOOLS_MISSING=true"
)

if exist "C:\Program Files\Android\Android Studio" (
    flutter config --android-studio-dir="C:\Program Files\Android\Android Studio" >nul 2>&1
)

echo.
echo [INFO] Running Flutter doctor...
flutter doctor >nul 2>&1
if !errorlevel! equ 0 (
    flutter doctor
) else (
    echo [WARNING] Flutter is not ready in this terminal. Restart and run: flutter doctor
)

echo.
echo ========================================
echo CaterSync AI Development Environment Setup Complete
echo ========================================
echo.
echo Summary:
git --version 2>nul || echo [MISSING] Git
python --version 2>nul || echo [MISSING] Python
python -c "import django; print('[OK] Global Django:', django.get_version())" 2>nul || echo [MISSING] Global Django
psql --version 2>nul | findstr /C:"psql" || echo [MISSING] PostgreSQL psql
if exist "%BACKEND_DIR%\manage.py" (echo [OK] Django backend scaffolded) else echo [MISSING] Django backend scaffold
if exist "%BACKEND_DIR%\.env" (echo [OK] Backend database .env configured) else echo [MISSING] Backend database .env
node --version 2>nul && echo [OK] Node.js installed || echo [MISSING] Node.js
npm --version 2>nul && echo [OK] npm installed || echo [MISSING] npm
java -version 2>nul && echo [OK] Java installed || echo [MISSING] Java
flutter --version 2>nul | findstr "Flutter" || echo [MISSING] Flutter
code --version 2>nul | findstr /C:"." && echo [OK] VS Code installed || echo [MISSING] VS Code
if exist "!ANDROID_SDK_ROOT!\platform-tools\adb.exe" (echo [OK] Android platform-tools installed) else echo [MISSING] Android platform-tools
if exist "!SDKMANAGER!" (echo [OK] Android sdkmanager installed) else echo [MISSING] Android sdkmanager

echo.
echo Next steps:
echo 1. Restart your command prompt to refresh PATH variables.
echo 2. Run flutter doctor and fix any remaining Android prompts.
echo 3. If licenses still show as missing, run flutter doctor --android-licenses.
echo 4. Start backend with: cd catersync-backend ^&^& .venv\Scripts\python manage.py runserver
echo 5. Configure Git name/email if it was not already configured.

if "!TOOLS_MISSING!"=="true" (
    echo.
    echo [WARNING] Some setup steps failed. Review the messages above and rerun after fixing them.
)

echo.
pause
