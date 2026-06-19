@echo off
echo ================================
echo   BetaTesterAI -- Installing
echo ================================

node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed.
  echo Download it from https://nodejs.org
  pause
  exit /b 1
)

echo [OK] Node.js found
echo.
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed
  pause
  exit /b 1
)

echo.
echo Installing Chromium browser...
call npx playwright install chromium
if %errorlevel% neq 0 (
  echo [ERROR] Playwright install failed
  pause
  exit /b 1
)

echo.
echo ================================
echo   Installation complete!
echo ================================
echo.
echo To start BetaTesterAI, double-click start.bat
echo Then open: http://localhost:3747
echo.
pause
