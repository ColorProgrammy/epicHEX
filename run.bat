@echo off
echo Starting EpicHEX Image Editor...
echo.
echo This will install required dependencies and start the application.
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo Starting application...
node main.js

pause