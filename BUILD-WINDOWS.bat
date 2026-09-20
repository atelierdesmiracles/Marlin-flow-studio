@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv-build\Scripts\python.exe" (
  echo [Build] Creation de l'environnement Python...
  py -3 -m venv .venv-build
  if errorlevel 1 goto :error
)

call ".venv-build\Scripts\activate.bat"
if errorlevel 1 goto :error

python -m pip install -U pip
if errorlevel 1 goto :error
python -m pip install -r desktop\requirements-desktop.txt pyinstaller
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

if exist release rmdir /s /q release
if not exist release mkdir release
if not exist .build\pyinstaller mkdir .build\pyinstaller
if not exist .build\spec mkdir .build\spec

pyinstaller --noconfirm --clean --onedir --name MarlinFlowStudio desktop\MarlinFlowDesktop.py --distpath release --workpath .build\pyinstaller --specpath .build\spec --hidden-import flask --hidden-import serial --hidden-import serial.tools.list_ports
if errorlevel 1 goto :error

if exist dist xcopy /E /I /Y dist release\MarlinFlowStudio\dist >nul
if exist MarlinLocalAgent.py copy /Y MarlinLocalAgent.py release\MarlinFlowStudio\MarlinLocalAgent.py >nul
if exist README.md copy /Y README.md release\MarlinFlowStudio\README.md >nul
if exist README_LOCAL_INTEGRATION.md copy /Y README_LOCAL_INTEGRATION.md release\MarlinFlowStudio\README_LOCAL_INTEGRATION.md >nul

echo.
echo ========================================
echo Build termine : release\MarlinFlowStudio\
echo ========================================
pause
endlocal & exit /b 0

:error
echo.
echo [ERREUR] Le build a echoue.
pause
endlocal & exit /b 1
