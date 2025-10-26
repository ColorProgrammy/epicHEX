@echo off
echo Starting EpicHEX Image Editor v1.1...
echo.
echo Drag and drop .ehex files onto this window to open them!
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

if "%~1"=="" (
    echo Starting application...
    node source/main.js
) else (
    echo Opening file: %~1
    node source/main.js "%~1"
)

pause