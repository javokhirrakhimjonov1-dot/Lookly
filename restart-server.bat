@echo off
cd /d "C:\Users\Owner\OneDrive\Desktop\codes\Style-Organizer (1)\Style-Organizer"

echo === Stopping old API servers ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000"') do (
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo === Building API server ===
call pnpm run --filter @workspace/api-server build
if %errorlevel% neq 0 (
  echo Build failed!
  pause
  exit /b 1
)

echo === Starting API server ===
set NODE_ENV=development
set PORT=5000
REM GEMINI_API_KEY is loaded from artifacts\api-server\.env. Never put a real key in this script.
start "Lookly-API" /B node --enable-source-maps ".\artifacts\api-server\dist\index.mjs"
timeout /t 3 /nobreak >nul

echo === Testing endpoints ===
curl -s http://localhost:5000/api/healthz
echo.
curl -s -X POST http://localhost:5000/api/suggest-outfits -H "Content-Type: application/json" -d "{\"items\":[{\"id\":\"1\",\"name\":\"T-Shirt\",\"category\":\"top\",\"color\":\"white\",\"colorHex\":\"#FFFFFF\",\"seasons\":[\"summer\"],\"fabricWeight\":\"light\"},{\"id\":\"2\",\"name\":\"Jeans\",\"category\":\"bottom\",\"color\":\"blue\",\"colorHex\":\"#1565C0\",\"seasons\":[\"summer\"],\"fabricWeight\":\"medium\"},{\"id\":\"3\",\"name\":\"Sneakers\",\"category\":\"shoes\",\"color\":\"white\",\"colorHex\":\"#FFFFFF\",\"seasons\":[\"summer\"],\"fabricWeight\":\"light\"}],\"temperature\":25,\"weatherCode\":0}" | findstr "outfits"
echo.
echo === Server is RUNNING on http://localhost:5000 ===
echo === Press any key to STOP the server ===
pause >nul

echo === Stopping server ===
taskkill /f /fi "WINDOWTITLE eq Lookly-API" >nul 2>&1
echo Server stopped.
