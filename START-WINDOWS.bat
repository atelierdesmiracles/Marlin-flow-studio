@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo [Marlin Flow Studio] Demarrage...

if not exist ".venv\Scripts\python.exe" (
  echo [1/4] Creation de l'environnement Python...
  py -3 -m venv .venv
  if errorlevel 1 goto :error
)

call ".venv\Scripts\activate.bat"
if errorlevel 1 goto :error

python -c "import importlib.util,sys; missing=[m for m in ('flask','serial','PySide6') if importlib.util.find_spec(m) is None]; sys.exit(1 if missing else 0)"
if errorlevel 1 (
  echo [2/4] Installation des dependances Python...
  python -m pip install --upgrade pip
  if errorlevel 1 goto :error
  python -m pip install -r requirements-local.txt
  if errorlevel 1 (
    for /f "tokens=*" %%A in ('python -c "import struct;print(struct.calcsize('P')*8)"') do set PYBITS=%%A
    if "!PYBITS!"=="32" (
      echo.
      echo [ERREUR] L'installation de PySide6 a echoue car ce Python est en 32 bits.
      echo PySide6/Qt ne publie plus de version 32 bits pour Windows.
      echo Installez un Python 64 bits ^(python.org, "Windows installer 64-bit"^), supprimez le dossier .venv, puis relancez ce script.
    )
    goto :error
  )
) else (
  echo [2/4] Dependances Python deja installees.
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js/npm n'est pas installe.
  echo Installe Node.js 20.19+ ou 22.12+ puis relancez ce script.
  goto :error
)

node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit((a>20 || (a===20 && b>=19) || (a===22 && b>=12) || a>22) ? 0 : 1)"
if errorlevel 1 (
  echo [ERREUR] Node.js 20.19+ ou 22.12+ est requis pour Vite 8.
  node --version
  goto :error
)

if not exist "dist\index.html" (
  if not exist "node_modules\.bin\vite.cmd" (
    echo [3/4] Installation/reparation des dependances npm...
    call npm ci --no-audit --no-fund
    if errorlevel 1 (
      echo [Marlin Flow Studio] npm ci a echoue, tentative npm install...
      call npm install --no-audit --no-fund
      if errorlevel 1 goto :error
    )
  )
  echo [3/4] Construction de l'interface web...
  call npm run build
  if errorlevel 1 goto :error
) else (
  echo [3/4] Interface web deja construite.
)

echo [4/4] Lancement de Marlin Flow Studio...
python desktop\MarlinFlowDesktop.py
set "EXITCODE=%ERRORLEVEL%"
endlocal & exit /b %EXITCODE%

:error
echo.
echo [ERREUR] Marlin Flow Studio n'a pas pu demarrer.
echo Verifiez le message ci-dessus.
pause
endlocal & exit /b 1
