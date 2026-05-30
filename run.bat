@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM  MarkItDown Web Hub - Startup Script (Windows)
REM =============================================================================

set VENV_DIR=.venv
set HOST=127.0.0.1
set PORT=8000

echo.
echo  ==========================================
echo   MarkItDown Web Hub
echo  ==========================================
echo.

REM --- 1. Check Python ---------------------------------------------------------
echo [1/4] Checking Python 3...

python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python 3 is not installed or not on your PATH.
    echo  Install it from https://www.python.org/downloads/ and try again.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo  Found %PYVER%

REM --- 2. Create virtual environment if missing --------------------------------
echo.
echo [2/4] Setting up virtual environment...

if not exist "%VENV_DIR%\" (
    echo   Creating .venv (first run only)...
    python -m venv %VENV_DIR%
    echo  Virtual environment created.
) else (
    echo  Virtual environment already exists.
)

REM Activate
call %VENV_DIR%\Scripts\activate.bat

REM --- 3. Install / update dependencies ----------------------------------------
echo.
echo [3/4] Installing dependencies...
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt --quiet
echo  All dependencies installed.

REM --- 4. Launch the server & open browser -------------------------------------
echo.
echo [4/4] Starting the web server...
echo.
echo   App is running at -^> http://%HOST%:%PORT%
echo   Press Ctrl+C to stop the server.
echo.

REM Open browser after a short delay
start "" /B cmd /C "timeout /t 2 >nul && start http://%HOST%:%PORT%"

REM Start uvicorn
python -m uvicorn app.main:app --host %HOST% --port %PORT%

endlocal
