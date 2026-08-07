@echo off
cd /d "%~dp0"
REM ===== Lookly Local App Startup Script =====
REM Build the current Expo web app and API before replacing port 5000.

echo Exporting the current Expo web app...
call pnpm -C artifacts\lookly exec expo export --platform web
if errorlevel 1 (
  echo Expo web export failed. The existing server was left running.
  exit /b 1
)

echo Building the API server...
call pnpm -C artifacts\api-server run build
if errorlevel 1 (
  echo API server build failed. The existing server was left running.
  exit /b 1
)

echo Stopping any old server on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do (
  if not "%%a"=="" taskkill /f /pid %%a >nul 2>&1
)
powershell -NoProfile -Command "Start-Sleep -Seconds 2"

set NODE_ENV=development
set PORT=5000

REM GEMINI_API_KEY is loaded from the ignored .env file by the API server.
REM Never place real keys in this script or commit them to Git.

set "API_ENTRY=%~dp0artifacts\api-server\dist\index.mjs"
echo Starting Lookly on http://localhost:5000 ...
node --enable-source-maps "%API_ENTRY%"
