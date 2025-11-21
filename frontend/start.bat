@echo off
echo ========================================
echo  AIO Game Library - Test Frontend
echo ========================================
echo.

echo [1/3] Checking Node.js installation...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)
node --version
echo.

echo [2/3] Checking Rust installation...
where rustc >nul 2>nul
if errorlevel 1 (
    echo WARNING: Rust not found. Tauri requires Rust.
    echo Install with: winget install --id Rustlang.Rustup
    echo.
    pause
)
echo.

echo [3/3] Starting development server...
echo.
echo IMPORTANT: Make sure the backend is running on http://localhost:8080
echo           Run this in another terminal: cd backend\api; go run main.go
echo.
pause

npm run tauri dev
