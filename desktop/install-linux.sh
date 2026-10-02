#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for cmd in python3 npm node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERREUR: $cmd est requis pour installer Marlin Flow Studio." >&2
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

if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -r requirements-local.txt

npm ci --no-audit --no-fund
if [ ! -x "node_modules/.bin/vite" ]; then
  echo "ERREUR: Vite est absent après npm ci." >&2
  exit 1
fi

npm run build
python -c 'import PySide6, flask, serial; print("Python desktop OK — PySide6", PySide6.__version__)'
exec python desktop/MarlinFlowDesktop.py
