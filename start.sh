#!/bin/bash

# CaterSync-AI Dev Server Runner
# Runs both Python FastAPI service and SvelteKit Dev Server concurrently.
# Automatically cleans up background processes on Ctrl+C.

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting CaterSync-AI Platform local runner...${NC}"

# Function to handle exit signals and kill background processes
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"
    # Kill all background processes started by this script
    jobs -p | xargs -r kill -9 2>/dev/null
    exit 0
}

# Trap Ctrl+C (SIGINT) and exit (SIGTERM)
trap cleanup SIGINT SIGTERM

# --- 1. Python FastAPI Service setup & execution ---
echo -e "${GREEN}🐍 Setting up Python FastAPI ML service...${NC}"
cd ml-service

if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment in ml-service/venv...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    echo -e "${YELLOW}Installing dependencies in venv...${NC}"
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo -e "${BLUE}🔥 Starting FastAPI ML service on port 8000...${NC}"
# Start FastAPI in background
uvicorn app.main:app --port 8000 --reload &
ML_PID=$!

# Move back to root directory
cd ..

# --- 2. SvelteKit Web Application setup & execution ---
echo -e "${GREEN}⚡ Setting up SvelteKit frontend...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing SvelteKit node modules...${NC}"
    npm install
fi

echo -e "${BLUE}🔥 Starting SvelteKit dev server...${NC}"
# Run SvelteKit in the foreground so stdout logs are visible
npm run dev

# Wait for background jobs if any
wait
