@echo off
echo ============================================================
echo  Intelligent Aircraft Detection System - YOLOv8 Service
echo ============================================================
echo.

REM Navigate to detect_service directory
cd /d "%~dp0"

REM Check if virtual environment exists
IF NOT EXIST "venv\Scripts\activate.bat" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv venv
    echo [SETUP] Virtual environment created.
    echo.
)

REM Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install/upgrade dependencies
echo [INFO] Installing Python dependencies...
pip install -r requirements.txt --quiet

echo.
echo [INFO] Starting YOLOv8 Detection Service on http://localhost:5001
echo [INFO] Press Ctrl+C to stop the service
echo.

REM Start FastAPI server
python -m uvicorn main:app --host 0.0.0.0 --port 5001 --workers 1

pause
