@echo off
echo =========================================
echo Setting up Git Repository
echo =========================================
echo.

cd /d "%~dp0"

echo Step 1: Initializing Git...
"C:\Program Files\Git\bin\git.exe" init
echo.

echo Step 2: Adding all files...
"C:\Program Files\Git\bin\git.exe" add .
echo.

echo Step 3: Creating initial commit...
"C:\Program Files\Git\bin\git.exe" commit -m "Initial commit - Ride Request App"
echo.

echo =========================================
echo SUCCESS! Git repository ready!
echo =========================================
echo.
echo Next: Go to https://github.com/new
echo Create repository name: ride-request-app
echo Then come back here!
echo.
pause

