@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js / npm could not be found.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Building BioBug Rescue...
  call npm.cmd run build -- --configLoader bundle
  if errorlevel 1 (
    echo Build failed. Share the error above.
    pause
    exit /b 1
  )
)
echo.
echo BioBug Rescue - local test preview
echo Open http://127.0.0.1:5174/#virtual-lab after Vite prints Local below.
echo Keep this window open while testing. Press Ctrl+C to stop.
echo MaleCNS needs its separate Python backend.
echo.
call npm.cmd run preview -- --configLoader bundle --port 5174 --strictPort
echo The preview stopped. If startup failed, share the error above.
pause
