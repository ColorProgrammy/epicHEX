@echo off
echo Starting EpicHEX Image Viewer v1.1...
echo.
echo Drag and drop .ehex files onto this window to view them!
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

if "%~1"=="" (
    echo Starting viewer...
    node source/viewer.js
) else (
    echo Opening file: %~1
    node source/viewer.js "%~1"
)

pause