#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

for cmd in python3 npm node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERREUR: $cmd est requis pour construire Marlin Flow Studio." >&2
    exit 1
  fi
done

# Vite 8 nécessite Node >= 20.19 ou >= 22.12.
if ! node -e '
const [major, minor] = process.versions.node.split(".").map(Number);
const supported = (major === 20 && minor >= 19) || (major >= 22 && (major > 22 || minor >= 12));
process.exit(supported ? 0 : 1);
'; then
  echo "ERREUR: Node.js >= 20.19 ou >= 22.12 requis (les versions 21.x ne sont pas supportées par Vite 8)." >&2
  exit 1
fi

python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install -U pip
python -m pip install -r desktop/requirements-desktop.txt pyinstaller
npm ci

if [ ! -x "node_modules/.bin/vite" ]; then
  echo "ERREUR: Vite est absent après npm ci." >&2
  exit 1
fi

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
