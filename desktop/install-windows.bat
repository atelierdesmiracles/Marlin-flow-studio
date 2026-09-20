@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

if not exist ".venv\Scripts\python.exe" (
  echo [Installation] Creation de l'environnement Python...
  py -3 -m venv .venv
  if errorlevel 1 goto :error
)

call ".venv\Scripts\activate.bat"
if errorlevel 1 goto :error

python -m pip install --upgrade pip
if errorlevel 1 goto :error
python -m pip install -r requirements-local.txt
if errorlevel 1 goto :error

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js/npm n'est pas installe.
  goto :error
)

call npm ci
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error

python -c "import PySide6, flask, serial; print('Python desktop OK - PySide6 ' + PySide6.__version__)"
if errorlevel 1 goto :error

python desktop\MarlinFlowDesktop.py
set "EXITCODE=%ERRORLEVEL%"
endlocal & exit /b %EXITCODE%

:error
echo.
echo [ERREUR] L'installation ou le demarrage a echoue.
pause
endlocal & exit /b 1
