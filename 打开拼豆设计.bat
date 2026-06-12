@echo off
setlocal

set "APP_ROOT=%~dp0"
set "URL=http://127.0.0.1:4173"
set "LOG_FILE=%TEMP%\pixel-toy-designer.log"

cd /d "%APP_ROOT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  start "" "%URL%"
  exit /b 0
)

set "NODE_BIN="
for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_BIN set "NODE_BIN=%%I"

set "PYTHON_BIN="
for /f "delims=" %%I in ('where python 2^>nul') do if not defined PYTHON_BIN set "PYTHON_BIN=%%I"
if not defined PYTHON_BIN (
  for /f "delims=" %%I in ('where python3 2^>nul') do if not defined PYTHON_BIN set "PYTHON_BIN=%%I"
)

if defined NODE_BIN (
  start "pixel-toy-designer" /B "%NODE_BIN%" server.js > "%LOG_FILE%" 2>&1
) else if defined PYTHON_BIN (
  start "pixel-toy-designer" /B "%PYTHON_BIN%" server.py > "%LOG_FILE%" 2>&1
) else (
  start "" "%APP_ROOT%index.html"
  exit /b 1
)

timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  start "" "%URL%"
) else (
  start "" "%APP_ROOT%index.html"
)
