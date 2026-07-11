@echo off
REM ── ngrok Static Domain — Lookly Production ──
REM Prerequisites:
REM   1. Go to https://dashboard.ngrok.com/cloud-edge/domains
REM   2. Claim a free static domain (e.g. lookly.ngrok-free.app)
REM   3. Update the NGROK_DOMAIN variable below
REM   4. Run this script instead of go-live.bat
REM
REM Once done, the URL will NEVER CHANGE between restarts.

set NGROK_DOMAIN=lookly.ngrok-free.app
npx ngrok http 5000 --domain=%NGROK_DOMAIN% --log=stdout
