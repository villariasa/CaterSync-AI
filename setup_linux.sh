#!/bin/bash

# CaterSync AI - Phase 1.1.1 Development Environment Setup Script (Linux)
# This script checks for and installs required development tools if not already present

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_status "Starting CaterSync AI Development Environment Setup..."

# 1. Check and install Git
print_status "Checking Git installation..."
if command_exists git; then
    GIT_VERSION=$(git --version)
    print_status "Git is already installed: $GIT_VERSION"
else
    print_status "Installing Git..."
    sudo apt update
    sudo apt install -y git
    print_status "Git installation completed"
fi

# Configure Git if not configured
if [ -z "$(git config --global user.name 2>/dev/null)" ]; then
    print_warning "Git user not configured. Please run:"
    echo "git config --global user.name 'Your Name'"
    echo "git config --global user.email 'your.email@example.com'"
fi

# 2. Check and install Python 3.9+
print_status "Checking Python installation..."
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    
    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 9 ]; then
        print_status "Python $PYTHON_VERSION is already installed and meets requirements (3.9+)"
    else
        print_warning "Python $PYTHON_VERSION is installed but below 3.9. Installing Python 3.9..."
        sudo apt update
        sudo apt install -y python3.9 python3.9-pip python3.9-venv
    fi
else
    print_status "Installing Python 3.9+..."
    sudo apt update
    sudo apt install -y python3.9 python3.9-pip python3.9-venv python3-pip
    print_status "Python installation completed"
fi

# Check and install pip if not present
if ! command_exists pip3; then
    print_status "Installing pip3..."
    sudo apt install -y python3-pip
fi

# 3. Check and install Django
print_status "Checking Django installation..."
if python3 -c "import django" 2>/dev/null; then
    DJANGO_VERSION=$(python3 -c "import django; print(django.get_version())")
    print_status "Django $DJANGO_VERSION is already installed"
else
    print_status "Installing Django..."
    pip3 install django
    print_status "Django installation completed"
fi

# 4. Check and install PostgreSQL 13+
print_status "Checking PostgreSQL installation..."
if command_exists psql; then
    PG_VERSION=$(psql --version | grep -oP '\d+\.\d+' | head -1)
    PG_MAJOR=$(echo $PG_VERSION | cut -d'.' -f1)
    
    if [ "$PG_MAJOR" -ge 13 ]; then
        print_status "PostgreSQL $PG_VERSION is already installed and meets requirements (13+)"
    else
        print_warning "PostgreSQL $PG_VERSION is installed but below version 13"
        print_status "Installing PostgreSQL 13+..."
        sudo apt update
        sudo apt install -y postgresql postgresql-contrib
    fi
else
    print_status "Installing PostgreSQL 13+..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    print_status "PostgreSQL installation completed"
    print_warning "Please configure PostgreSQL:"
    echo "sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'your_password';\""
fi

# 5. Check and install Node.js
print_status "Checking Node.js installation..."
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status "Node.js $NODE_VERSION is already installed"
else
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
    print_status "Node.js installation completed"
fi

# Check and install npm if not present
if ! command_exists npm; then
    print_status "Installing npm..."
    sudo apt install -y npm
fi

# 6. Check and install Flutter SDK
print_status "Checking Flutter installation..."
if command_exists flutter; then
    FLUTTER_VERSION=$(flutter --version | grep "Flutter" | cut -d' ' -f2)
    print_status "Flutter $FLUTTER_VERSION is already installed"
else
    print_status "Installing Flutter SDK..."
    
    # Create flutter directory
    mkdir -p ~/development
    cd ~/development
    
    # Download and extract Flutter
    wget https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.16.0-stable.tar.xz
    tar xf flutter_linux_3.16.0-stable.tar.xz
    
    # Add to PATH in .bashrc if not already present
    if ! grep -q "export PATH=\"\$PATH:~/development/flutter/bin\"" ~/.bashrc; then
        echo 'export PATH="$PATH:~/development/flutter/bin"' >> ~/.bashrc
        print_status "Added Flutter to PATH in ~/.bashrc"
    fi
    
    # Source the bashrc for current session
    export PATH="$PATH:~/development/flutter/bin"
    
    print_status "Flutter SDK installation completed"
    print_warning "Please run 'source ~/.bashrc' or restart your terminal to update PATH"
fi

# 7. Check and install VS Code
print_status "Checking VS Code installation..."
if command_exists code; then
    print_status "VS Code is already installed"
else
    print_status "Installing VS Code..."
    wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
    sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
    sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
    sudo apt update
    sudo apt install -y code
    print_status "VS Code installation completed"
fi

# 8. Check for Android Studio (optional)
print_status "Checking Android Studio installation..."
if [ -d "/opt/android-studio" ] || [ -d "~/android-studio" ]; then
    print_status "Android Studio appears to be installed"
else
    print_warning "Android Studio not found. You may want to install it manually from:"
    echo "https://developer.android.com/studio"
fi

print_status "Running Flutter doctor to check setup..."
if command_exists flutter; then
    flutter doctor
else
    print_warning "Flutter not in PATH. Please run 'source ~/.bashrc' first, then 'flutter doctor'"
fi

print_status "CaterSync AI Development Environment Setup Complete!"
print_status "Summary of installed tools:"
echo "✓ Git: $(git --version 2>/dev/null || echo 'Not in PATH')"
echo "✓ Python: $(python3 --version 2>/dev/null || echo 'Not found')"
echo "✓ Django: $(python3 -c 'import django; print(django.get_version())' 2>/dev/null || echo 'Not found')"
echo "✓ PostgreSQL: $(psql --version 2>/dev/null | head -1 || echo 'Not in PATH')"
echo "✓ Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "✓ npm: $(npm --version 2>/dev/null || echo 'Not found')"
echo "✓ Flutter: $(flutter --version 2>/dev/null | head -1 || echo 'Not in PATH - run source ~/.bashrc')"
echo "✓ VS Code: $(code --version 2>/dev/null | head -1 || echo 'Not found')"

print_status "Next steps:"
echo "1. If Flutter is not in PATH, run: source ~/.bashrc"
echo "2. Configure PostgreSQL with: sudo -u postgres psql"
echo "3. Run 'flutter doctor' to verify Flutter setup"
echo "4. Install Android Studio manually if needed for mobile development"