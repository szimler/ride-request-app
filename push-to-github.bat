@echo off
echo =========================================
echo Pushing Code to GitHub
echo =========================================
echo.

cd /d "F:\Cursor\APP RIDES CEL"

echo Step 1: Adding remote repository...
"C:\Program Files\Git\bin\git.exe" remote add origin https://github.com/szimler/ride-request-app.git
echo.

echo Step 2: Renaming branch to main...
"C:\Program Files\Git\bin\git.exe" branch -M main
echo.

echo Step 3: Pushing to GitHub...
"C:\Program Files\Git\bin\git.exe" push -u origin main
echo.

echo =========================================
echo SUCCESS! Code uploaded to GitHub!
echo =========================================
echo.
echo Next: Deploy to Render
echo.
pause

