@echo off
setlocal enabledelayedexpansion

REM CaterSync AI - Phase 1.1.1 Development Environment Setup Script (Windows)
REM This script checks for and installs required development tools if not already present

echo.
echo ========================================
echo CaterSync AI Development Environment Setup
echo ========================================
echo.

REM Function to check if command exists
set "TOOLS_MISSING=false"

REM 1. Check and install Git
echo [INFO] Checking Git installation...
git --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('git --version') do echo [INFO] Git is already installed: %%i
) else (
    echo [INFO] Installing Git...
    echo [WARNING] Git not found. Installing via winget...
    winget install --id Git.Git -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Git via winget. Please install manually from https://git-scm.com/
        set "TOOLS_MISSING=true"
    ) else (
        echo [INFO] Git installation completed
    )
)

REM Check Git configuration
git config --global user.name >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARNING] Git user not configured. Please run:
    echo git config --global user.name "Your Name"
    echo git config --global user.email "your.email@example.com"
)

REM 2. Check and install Python 3.9+
echo [INFO] Checking Python installation...
python --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%i in ('python --version') do (
        set "PYTHON_VERSION=%%i"
        for /f "tokens=1,2 delims=." %%a in ("!PYTHON_VERSION!") do (
            set "PYTHON_MAJOR=%%a"
            set "PYTHON_MINOR=%%b"
        )
        if !PYTHON_MAJOR! geq 3 (
            if !PYTHON_MINOR! geq 9 (
                echo [INFO] Python !PYTHON_VERSION! is already installed and meets requirements ^(3.9+^)
            ) else (
                echo [WARNING] Python !PYTHON_VERSION! is installed but below 3.9. Installing Python 3.9+...
                winget install --id Python.Python.3.11 -e --source winget
            )
        ) else (
            echo [WARNING] Python !PYTHON_VERSION! is installed but below 3.9. Installing Python 3.9+...
            winget install --id Python.Python.3.11 -e --source winget
        )
    )
) else (
    echo [INFO] Installing Python 3.11...
    winget install --id Python.Python.3.11 -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Python via winget. Please install manually from https://python.org/
        set "TOOLS_MISSING=true"
    ) else (
        echo [INFO] Python installation completed
    )
)

REM 3. Check and install pip (usually comes with Python)
echo [INFO] Checking pip installation...
pip --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('pip --version') do echo [INFO] pip is already installed: %%i
) else (
    echo [INFO] Installing pip...
    python -m ensurepip --upgrade
)

REM 4. Check and install Django
echo [INFO] Checking Django installation...
python -c "import django" >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('python -c "import django; print(django.get_version())"') do (
        echo [INFO] Django %%i is already installed
    )
) else (
    echo [INFO] Installing Django...
    pip install django
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Django
        set "TOOLS_MISSING=true"
    ) else (
        echo [INFO] Django installation completed
    )
)

REM 5. Check and install PostgreSQL 13+
echo [INFO] Checking PostgreSQL installation...
psql --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=3" %%i in ('psql --version') do (
        set "PG_VERSION=%%i"
        for /f "tokens=1 delims=." %%a in ("!PG_VERSION!") do (
            set "PG_MAJOR=%%a"
        )
        if !PG_MAJOR! geq 13 (
            echo [INFO] PostgreSQL !PG_VERSION! is already installed and meets requirements ^(13+^)
        ) else (
            echo [WARNING] PostgreSQL !PG_VERSION! is installed but below version 13
            echo [INFO] Installing PostgreSQL 15+...
            winget install --id PostgreSQL.PostgreSQL -e --source winget
        )
    )
) else (
    echo [INFO] Installing PostgreSQL 15+...
    winget install --id PostgreSQL.PostgreSQL -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install PostgreSQL via winget. Please install manually from https://postgresql.org/
        set "TOOLS_MISSING=true"
    ) else (
        echo [INFO] PostgreSQL installation completed
        echo [WARNING] Please configure PostgreSQL after installation
    )
)

REM 6. Check and install Node.js
echo [INFO] Checking Node.js installation...
node --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo [INFO] Node.js %%i is already installed
) else (
    echo [INFO] Installing Node.js LTS...
    winget install --id OpenJS.NodeJS -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Node.js via winget. Please install manually from https://nodejs.org/
        set "TOOLS_MISSING=true"
    ) else (
        echo [INFO] Node.js installation completed
    )
)

REM Check and install npm (usually comes with Node.js)
npm --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do echo [INFO] npm %%i is already installed
) else (
    echo [WARNING] npm not found. It should be installed with Node.js
)

REM 7. Check and install Flutter SDK
echo [INFO] Checking Flutter installation...
flutter --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%i in ('flutter --version ^| findstr "Flutter"') do (
        echo [INFO] Flutter %%i is already installed
    )
) else (
    echo [INFO] Installing Flutter SDK...
    
    REM Create flutter directory
    if not exist "C:\development" mkdir "C:\development"
    cd /d "C:\development"
    
    REM Download Flutter using PowerShell
    echo [INFO] Downloading Flutter SDK...
    powershell -Command "Invoke-WebRequest -Uri 'https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.16.0-stable.zip' -OutFile 'flutter_windows_stable.zip'"
    
    REM Extract Flutter
    echo [INFO] Extracting Flutter SDK...
    powershell -Command "Expand-Archive -Path 'flutter_windows_stable.zip' -DestinationPath '.' -Force"
    
    REM Add to PATH (requires restart or new command prompt)
    echo [INFO] Adding Flutter to system PATH...
    setx PATH "%PATH%;C:\development\flutter\bin" /M >nul 2>&1
    if !errorlevel! neq 0 (
        echo [WARNING] Failed to add Flutter to system PATH. Please add C:\development\flutter\bin manually
    ) else (
        echo [INFO] Flutter added to system PATH
    )
    
    REM Set for current session
    set "PATH=%PATH%;C:\development\flutter\bin"
    
    echo [INFO] Flutter SDK installation completed
    echo [WARNING] Please restart your command prompt or reboot to update PATH
)

REM 8. Check and install VS Code
echo [INFO] Checking VS Code installation...
code --version >nul 2>&1
if !errorlevel! equ 0 (
    echo [INFO] VS Code is already installed
) else (
    echo [INFO] Installing VS Code...
    winget install --id Microsoft.VisualStudioCode -e --source winget
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install VS Code via winget. Please install manually from https://code.visualstudio.com/
        set "TOOLS_MISSING=true"
    ) else (
        echo [INFO] VS Code installation completed
    )
)

REM 9. Check for Android Studio (optional)
echo [INFO] Checking Android Studio installation...
if exist "C:\Program Files\Android\Android Studio" (
    echo [INFO] Android Studio appears to be installed
) else (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        echo [INFO] Android SDK appears to be installed
    ) else (
        echo [WARNING] Android Studio not found. You may want to install it manually from:
        echo https://developer.android.com/studio
    )
)

echo.
echo [INFO] Running Flutter doctor to check setup...
flutter doctor >nul 2>&1
if !errorlevel! equ 0 (
    flutter doctor
) else (
    echo [WARNING] Flutter not in PATH. Please restart your command prompt first, then run 'flutter doctor'
)

echo.
echo ========================================
echo CaterSync AI Development Environment Setup Complete!
echo ========================================
echo.
echo Summary of installed tools:
git --version 2>nul || echo ✗ Git: Not in PATH
python --version 2>nul || echo ✗ Python: Not found
python -c "import django; print('✓ Django:', django.get_version())" 2>nul || echo ✗ Django: Not found
psql --version 2>nul | findstr /C:"psql" || echo ✗ PostgreSQL: Not in PATH
node --version 2>nul && echo ✓ Node.js: || echo ✗ Node.js: Not found
npm --version 2>nul && echo ✓ npm: || echo ✗ npm: Not found
flutter --version 2>nul | findstr "Flutter" || echo ✗ Flutter: Not in PATH - restart command prompt
code --version 2>nul | findstr /C:"." && echo ✓ VS Code: Installed || echo ✗ VS Code: Not found

echo.
echo Next steps:
echo 1. If any tools failed to install, please install them manually
echo 2. Restart your command prompt to update PATH variables
echo 3. Configure PostgreSQL if needed
echo 4. Run 'flutter doctor' to verify Flutter setup
echo 5. Install Android Studio manually if needed for mobile development
echo 6. Configure Git with your name and email if not done

if "!TOOLS_MISSING!"=="true" (
    echo.
    echo [WARNING] Some tools failed to install automatically.
    echo Please check the error messages above and install manually if needed.
)

echo.
pause