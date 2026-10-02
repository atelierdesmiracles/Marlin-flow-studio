#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "ERREUR: Python 3 est introuvable. Installe Python 3 puis relance ce script." >&2
  exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  "$PYTHON_BIN" -m venv .venv
fi
source .venv/bin/activate

# Installe les dépendances Python uniquement lorsqu'elles sont réellement absentes.
if ! python - <<'PY2'
import importlib.util
missing = [m for m in ("flask", "serial", "PySide6") if importlib.util.find_spec(m) is None]
raise SystemExit(1 if missing else 0)
PY2
then
  echo "[Marlin Flow Studio] Installation des dépendances Python..."
  python -m pip install --upgrade pip
  python -m pip install -r requirements-local.txt
fi

for cmd in node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERREUR: $cmd n'est pas installé. Installe Node.js (avec npm) puis relance ce script." >&2
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

# Ne reconstruire que si le bundle est absent. Si l'installation locale est incomplète,
# on la répare automatiquement.
if [ ! -f "dist/index.html" ]; then
  if [ ! -x "node_modules/.bin/vite" ]; then
    echo "[Marlin Flow Studio] Installation/réparation des dépendances npm..."
    if ! npm ci --no-audit --no-fund; then
      echo "[Marlin Flow Studio] npm ci a échoué, tentative npm install..."
      npm install --no-audit --no-fund
    fi
  fi

  if [ ! -x "node_modules/.bin/vite" ]; then
    echo "ERREUR: Vite reste indisponible après l'installation npm." >&2
    exit 1
  fi

  echo "[Marlin Flow Studio] Construction de l'interface web..."
  npm run build
else
  echo "[Marlin Flow Studio] Interface web déjà construite."
fi

if ! python -c 'import PySide6, flask, serial; print("Python desktop OK — PySide6", PySide6.__version__)'; then
  echo "ERREUR: les dépendances Python desktop sont incomplètes." >&2
  exit 1
fi

exec python desktop/MarlinFlowDesktop.py
