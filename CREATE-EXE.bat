@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ========================================
echo   MARLIN FLOW STUDIO - CREATEUR EXE
echo ========================================
echo.

where py >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Python Launcher ^(py^) n'est pas installe.
  echo Installez Python 3.11 ou plus recent puis relancez ce script.
  goto :error
)

if not exist ".venv-build\Scripts\python.exe" (
  echo [1/6] Creation de l'environnement de build...
  py -3 -m venv .venv-build
  if errorlevel 1 goto :error
) else (
  echo [1/6] Environnement de build deja present.
)

call ".venv-build\Scripts\activate.bat"
if errorlevel 1 goto :error

echo [2/6] Mise a jour des outils...
python -m pip install --upgrade pip
if errorlevel 1 goto :error

echo [3/6] Installation des dependances desktop + PyInstaller...
python -m pip install -r desktop\requirements-desktop.txt pyinstaller
if errorlevel 1 goto :error

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js/npm n'est pas installe.
  goto :error
)

echo [4/6] Installation des dependances web...
call npm ci
if errorlevel 1 goto :error

echo [5/6] Construction de l'interface web...
call npm run build
if errorlevel 1 goto :error

if exist release rmdir /s /q release
if not exist .build\pyinstaller mkdir .build\pyinstaller
if not exist .build\spec mkdir .build\spec

set "PYI_ARGS=--noconfirm --clean --onedir --name MarlinFlowStudio"
set "PYI_ARGS=%PYI_ARGS% --distpath release --workpath .build\pyinstaller --specpath .build\spec"
set "PYI_ARGS=%PYI_ARGS% --hidden-import flask --hidden-import serial --hidden-import serial.tools.list_ports"
set "PYI_ARGS=%PYI_ARGS% --collect-all PySide6"
set "PYI_ARGS=%PYI_ARGS% --collect-all PySide6.QtWebEngineCore"
set "PYI_ARGS=%PYI_ARGS% --collect-all PySide6.QtWebEngineWidgets"

pyinstaller %PYI_ARGS% desktop\MarlinFlowDesktop.py
if errorlevel 1 goto :error

if exist dist xcopy /E /I /Y dist release\MarlinFlowStudio\dist >nul
if exist MarlinLocalAgent.py copy /Y MarlinLocalAgent.py release\MarlinFlowStudio\MarlinLocalAgent.py >nul
if exist requirements-local.txt copy /Y requirements-local.txt release\MarlinFlowStudio\requirements-local.txt >nul
if exist README.md copy /Y README.md release\MarlinFlowStudio\README.md >nul
if exist README_LOCAL_INTEGRATION.md copy /Y README_LOCAL_INTEGRATION.md release\MarlinFlowStudio\README_LOCAL_INTEGRATION.md >nul
if exist STARTUP_WORKFLOW.md copy /Y STARTUP_WORKFLOW.md release\MarlinFlowStudio\STARTUP_WORKFLOW.md >nul

rem Creer un lanceur BAT pratique a cote de l'EXE.
>release\MarlinFlowStudio\START-Marlin-Flow.bat echo @echo off
>>release\MarlinFlowStudio\START-Marlin-Flow.bat echo cd /d "%%~dp0"
>>release\MarlinFlowStudio\START-Marlin-Flow.bat echo start "Marlin Flow Studio" "%%~dp0MarlinFlowStudio.exe"

if not exist release\MarlinFlowStudio\MarlinFlowStudio.exe (
  echo [ERREUR] L'EXE n'a pas ete cree.
  goto :error
)

echo.
echo [6/6] Creation terminee.
echo.
echo EXE :
echo   %CD%\release\MarlinFlowStudio\MarlinFlowStudio.exe
echo.
echo Dossier portable :
echo   %CD%\release\MarlinFlowStudio\
echo.
echo Vous pouvez copier tout ce dossier sur un autre PC Windows.
echo.
pause
endlocal & exit /b 0

:error
echo.
echo [ERREUR] La creation de l'EXE a echoue.
echo Verifiez le message ci-dessus.
pause
endlocal & exit /b 1
