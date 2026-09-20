#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install -U pip
python -m pip install -r desktop/requirements-desktop.txt pyinstaller
npm ci
npm run build

rm -rf release
mkdir -p release
pyinstaller --noconfirm --clean --onedir --name MarlinFlowStudio desktop/MarlinFlowDesktop.py --distpath release --workpath .build/pyinstaller --specpath .build/spec --hidden-import flask --hidden-import serial --hidden-import serial.tools.list_ports
cp -a dist release/MarlinFlowStudio/
cp MarlinLocalAgent.py release/MarlinFlowStudio/
cp README.md README_LOCAL_INTEGRATION.md release/MarlinFlowStudio/ 2>/dev/null || true

echo "Build terminé : release/MarlinFlowStudio/"
if command -v linuxdeploy >/dev/null 2>&1; then
  echo "linuxdeploy détecté ; production AppImage possible depuis ce dossier."
fi
