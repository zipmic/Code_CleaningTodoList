@echo off
cd /d "%~dp0"
echo.
echo  Building Cleanup Quest...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  Build failed! Read the errors above.
    pause
    exit /b 1
)
echo.
echo  Done! Opening the dist folder...
echo  Upload everything inside it to your FTP.
echo.
explorer dist
pause
