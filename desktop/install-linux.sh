#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-local.txt
npm ci
npm run build
python -c 'import PySide6, flask, serial; print("Python desktop OK — PySide6", PySide6.__version__)'
python desktop/MarlinFlowDesktop.py
