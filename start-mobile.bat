@echo off
cd /d "C:\Users\Owner\OneDrive\Desktop\codes\Style-Organizer (1)\Style-Organizer"

echo === Getting local IP address ===
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do set IP=%%a
set IP=%IP: =%
echo Laptop IP: %IP%

echo.
echo === Building API server ===
call pnpm run --filter @workspace/api-server build

echo.
echo === Starting API server on %IP%:5000 ===
set NODE_ENV=development
set GEMINI_API_KEY=AIzaSyC3vwfiaPOr2XUEfzjGOEfHlZ09rse6yKM
set PORT=5000
start "Lookly-API" /B node --enable-source-maps ".\artifacts\api-server\dist\index.mjs"
timeout /t 3 /nobreak >nul

echo === Starting Expo with tunnel (iPhone QR code) ===
echo.
echo API server: http://%IP%:5000
echo.
echo 1. Install Expo Go on your iPhone from the App Store
echo 2. Make sure phone is on SAME WiFi network as this laptop
echo 3. Scan the QR code that appears below with your iPhone camera
echo.
start "Lookly-Expo" /B cmd /c "cd /d \"%~dp0artifacts\lookly\" && set EXPO_PUBLIC_API_URL=http://%IP%:5000/api && npx expo start --tunnel"

echo Waiting for Expo to start...
timeout /t 10 /nobreak >nul
echo.
echo === CHECK THE EXPO WINDOW FOR QR CODE ===
echo.
echo Press any key to stop both servers.
pause >nul

echo === Stopping servers ===
taskkill /f /fi "WINDOWTITLE eq Lookly-API" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Lookly-Expo" >nul 2>&1
echo Done.
