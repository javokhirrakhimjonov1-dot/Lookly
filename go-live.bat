@echo off
cd /d "C:\Users\Owner\OneDrive\Desktop\codes\Style-Organizer (1)\Style-Organizer"
title Lookly Server + ngrok Tunnel

echo === Building API server ===
call pnpm run --filter @workspace/api-server build
if %errorlevel% neq 0 (
  echo Build failed!
  pause
  exit /b 1
)

echo === Copying missing font assets (Windows pnpm workaround) ===
if exist "artifacts\lookly\dist\assets\__node_modules\.pnpm\@expo+vector-icons*" (
  for /d %%d in ("artifacts\lookly\dist\assets\__node_modules\.pnpm\@expo+vector-icons*") do (
    if not exist "%%d\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\Feather.ttf" (
      copy "artifacts\lookly\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\Feather.ttf" "%%d\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\" >nul 2>&1
    )
  )
)

echo === Killing old servers on port 5000 ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000"') do (
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo === Starting API server + Web app ===
set NODE_ENV=development
set GEMINI_API_KEY=AIzaSyC3vwfiaPOr2XUEfzjGOEfHlZ09rse6yKM
set PORT=5000
start "Lookly-API" /B cmd /c "node --enable-source-maps ".\artifacts\api-server\dist\index.mjs" >> ".\server-crash.log" 2>&1"
timeout /t 4 /nobreak >nul

echo === Verifying server ===
curl -s http://127.0.0.1:5000/api/healthz
if %errorlevel% neq 0 (
  echo Server failed to start. Check server-crash.log for details.
  pause
  exit /b 1
)
echo.
echo === Starting ngrok Tunnel ===
echo.
echo Using ngrok URL: https://splendid-liberty-ice.ngrok-free.dev
echo.
echo Your permanent dev domain: https://splendid-liberty-ice.ngrok-free.dev
echo This URL will NOT change between restarts.
echo.
start "Lookly-Tunnel" /B cmd /c "npx ngrok http 5000 --domain=splendid-liberty-ice.ngrok-free.dev --log=stdout > "%TEMP%\ngrok.log" 2>&1"
timeout /t 8 /nobreak >nul

echo === Public URL ===
echo Check the ngrok dashboard:    https://dashboard.ngrok.com/cloud-edge/endpoints
echo Or run: curl -s http://127.0.0.1:4040/api/tunnels
echo.
echo === Keep this window open to keep the server running ===
echo === Share the URL above with your testers ===
echo.
echo Press Ctrl+C to stop.
pause >nul

echo === Stopping ===
taskkill /f /fi "WINDOWTITLE eq Lookly-API" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Lookly-Tunnel" >nul 2>&1
echo Stopped.
