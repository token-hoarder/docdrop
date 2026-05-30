#!/usr/bin/env bash
# =============================================================================
# DocDrop - Startup Script (macOS / Linux)
# =============================================================================

set -e

# --- Colours -----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Colour

VENV_DIR=".venv"
PORT=8000
HOST="127.0.0.1"

printf "\n"
printf "${CYAN}${BOLD}╔══════════════════════════════════════════╗\n${NC}"
printf "${CYAN}${BOLD}║              DocDrop  🚀                 ║\n${NC}"
printf "${CYAN}${BOLD}╚══════════════════════════════════════════╝\n${NC}"
printf "\n"

# --- 1. Check Python 3 -------------------------------------------------------
printf "${BOLD}[1/4] Checking Python 3...${NC}\n"

if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null && python --version 2>&1 | grep -q "Python 3"; then
    PYTHON=python
else
    printf "${RED}✗ Python 3 is not installed or not on your PATH.${NC}\n"
    printf "  Install it from https://www.python.org/downloads/ and try again.\n"
    exit 1
fi

PYTHON_VERSION=$($PYTHON --version 2>&1)
printf "${GREEN}✓ Found ${PYTHON_VERSION}${NC}\n"

# --- 2. Create virtual environment if missing --------------------------------
printf "\n"
printf "${BOLD}[2/4] Setting up virtual environment...${NC}\n"

if [ ! -d "$VENV_DIR" ]; then
    printf "${YELLOW}  → Creating .venv (first run only)...${NC}\n"
    $PYTHON -m venv "$VENV_DIR"
    printf "${GREEN}✓ Virtual environment created${NC}\n"
else
    printf "${GREEN}✓ Virtual environment already exists${NC}\n"
fi

# Activate
source "$VENV_DIR/bin/activate"

# --- 3. Install / update dependencies ----------------------------------------
printf "\n"
printf "${BOLD}[3/4] Checking dependencies...${NC}\n"
STAMP="$VENV_DIR/.deps-stamp"
if [ ! -f "$STAMP" ] || [ requirements.txt -nt "$STAMP" ]; then
    printf "${YELLOW}  → Installing dependencies...${NC}\n"
    pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
    touch "$STAMP"
    printf "${GREEN}✓ Dependencies installed${NC}\n"
else
    printf "${GREEN}✓ Dependencies up to date${NC}\n"
fi

# --- 4. Launch the server & open browser -------------------------------------
printf "\n"
printf "${BOLD}[4/4] Starting the web server...${NC}\n"
if pkill -f "uvicorn app.main:app" 2>/dev/null; then
    printf "${YELLOW}  → Stopped existing server${NC}\n"
    sleep 0.5
fi
printf "\n"
printf "${CYAN}  App is running at → ${BOLD}http://${HOST}:${PORT}${NC}\n"
printf "${YELLOW}  Press Ctrl+C to stop the server${NC}\n"
printf "\n"

# Open browser after a short delay (background job)
(
    sleep 1.5
    if command -v open &>/dev/null; then
        open "http://${HOST}:${PORT}"          # macOS
    elif command -v xdg-open &>/dev/null; then
        xdg-open "http://${HOST}:${PORT}"     # Linux
    fi
) &

# Start uvicorn
python3 -m uvicorn app.main:app --host "$HOST" --port "$PORT"
