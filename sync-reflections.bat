@echo off
echo Syncing Reflections source files...
xcopy /E /Y /I "C:\Users\spand\OneDrive\Desktop\Reflections\src" "C:\dev\Reflections\src"
echo.
echo Done! If the dev server is already running, it will hot-reload.
echo If not, run: cd C:\dev\Reflections and then: npm run dev
pause
