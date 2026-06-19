@echo off
echo =============================================
echo  Reflections - Sync and Start Dev Server
echo =============================================
echo.

echo [1/2] Syncing source files to C:\dev\Reflections...
robocopy "C:\Users\spand\OneDrive\Desktop\Reflections\src" "C:\dev\Reflections\src" /E /IS /IT /NFL /NDL /NJH /NJS
robocopy "C:\Users\spand\OneDrive\Desktop\Reflections\public" "C:\dev\Reflections\public" /E /IS /IT /NFL /NDL /NJH /NJS 2>nul
copy /Y "C:\Users\spand\OneDrive\Desktop\Reflections\next.config.js" "C:\dev\Reflections\next.config.js" >nul
copy /Y "C:\Users\spand\OneDrive\Desktop\Reflections\tailwind.config.js" "C:\dev\Reflections\tailwind.config.js" >nul
copy /Y "C:\Users\spand\OneDrive\Desktop\Reflections\tsconfig.json" "C:\dev\Reflections\tsconfig.json" >nul

set "PKG_CHANGED=0"
fc /b "C:\Users\spand\OneDrive\Desktop\Reflections\package.json" "C:\dev\Reflections\package.json" >nul 2>nul
if errorlevel 1 set "PKG_CHANGED=1"
copy /Y "C:\Users\spand\OneDrive\Desktop\Reflections\package.json" "C:\dev\Reflections\package.json" >nul
echo Done syncing.
echo.

cd /d C:\dev\Reflections
if "%PKG_CHANGED%"=="1" (
  echo package.json changed - running npm install...
  npm install
  echo.
)

echo [2/2] Starting dev server from C:\dev\Reflections...
echo (Press Ctrl+C to stop)
echo.
npm run dev
pause
