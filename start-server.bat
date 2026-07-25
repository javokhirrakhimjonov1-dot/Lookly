@echo off
REM ===== Lookly API Server - Startup Script =====
REM Run this to start the API server on port 5000

echo Stopping any old server on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000"') do (
  if not "%%a"=="" taskkill /f /pid %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

cd /d "%~dp0"
echo Starting API server from %CD%...

set NODE_ENV=development
set PORT=5000

REM GEMINI_API_KEY is loaded from the ignored .env file by the API server.
REM Never place real keys in this script or commit them to Git.

set "API_ENTRY=%~dp0artifacts\api-server\dist\index.mjs"
start "Lookly API Server" /B node --enable-source-maps "%API_ENTRY%"

echo Server starting on http://localhost:5000 ...
echo Press any key to stop the server.
pause

echo Stopping server...
taskkill /f /fi "WINDOWTITLE eq Lookly API Server" >nul 2>&1
echo Server stopped.
