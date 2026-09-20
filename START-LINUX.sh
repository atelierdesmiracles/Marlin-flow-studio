#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ ! -x ".venv/bin/python" ]; then
  "$PYTHON_BIN" -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-local.txt
if command -v npm >/dev/null 2>&1; then
  npm ci
  npm run build
else
  echo "ERREUR: npm n'est pas installé. Installe Node.js/npm puis relance ce script." >&2
  exit 1
fi
python -c 'import PySide6, flask, serial; print("Python desktop OK — PySide6", PySide6.__version__)'
python desktop/MarlinFlowDesktop.py
