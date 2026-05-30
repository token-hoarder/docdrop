#!/usr/bin/env bash
# =============================================================================
# MarkItDown Web Hub - Startup Script (macOS / Linux)
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

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║        MarkItDown Web Hub  🚀            ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# --- 1. Check Python 3 -------------------------------------------------------
echo -e "${BOLD}[1/4] Checking Python 3...${NC}"

if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null && python --version 2>&1 | grep -q "Python 3"; then
    PYTHON=python
else
    echo -e "${RED}✗ Python 3 is not installed or not on your PATH.${NC}"
    echo "  Install it from https://www.python.org/downloads/ and try again."
    exit 1
fi

PYTHON_VERSION=$($PYTHON --version 2>&1)
echo -e "${GREEN}✓ Found ${PYTHON_VERSION}${NC}"

# --- 2. Create virtual environment if missing --------------------------------
echo ""
echo -e "${BOLD}[2/4] Setting up virtual environment...${NC}"

if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}  → Creating .venv (first run only)...${NC}"
    $PYTHON -m venv "$VENV_DIR"
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate
source "$VENV_DIR/bin/activate"

# --- 3. Install / update dependencies ----------------------------------------
echo ""
echo -e "${BOLD}[3/4] Installing dependencies...${NC}"
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo -e "${GREEN}✓ All dependencies installed${NC}"

# --- 4. Launch the server & open browser -------------------------------------
echo ""
echo -e "${BOLD}[4/4] Starting the web server...${NC}"
echo ""
echo -e "${CYAN}  App is running at → ${BOLD}http://${HOST}:${PORT}${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop the server${NC}"
echo ""

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
