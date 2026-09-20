#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
URL = "http://127.0.0.1:38765"
TOKEN = ROOT / ".marlin-agent" / "token"

print("Marlin Flow Studio — diagnostic agent local")
print(f"Projet : {ROOT}")
print(f"Token  : {TOKEN}")
print(f"Existe : {TOKEN.exists()}")

try:
    with urlopen(URL + "/api/ping", timeout=2) as r:
        data = json.loads(r.read().decode("utf-8"))
    print(f"PING   : OK ({r.status}) {data}")
except Exception as exc:
    print(f"PING   : ECHEC — {exc}")
    raise SystemExit(2)

if not TOKEN.exists():
    print("AUTH   : ECHEC — token absent")
    raise SystemExit(3)

token = TOKEN.read_text(encoding="utf-8").strip()
try:
    req = Request(URL + "/api/status", headers={"X-Marlin-Agent-Token": token})
    with urlopen(req, timeout=2) as r:
        data = json.loads(r.read().decode("utf-8"))
    print(f"AUTH   : OK ({r.status})")
    print(f"Agent  : {data.get('agent')} {data.get('version')}")
    print(f"Projet : {data.get('project_dir')}")
    print(f"PIO    : {data.get('platformio_installed')}")
    print(f"Série  : {data.get('serial_connected')} {data.get('serial_port') or ''}")
except Exception as exc:
    print(f"AUTH   : ECHEC — {exc}")
    raise SystemExit(4)

print("RESULT : agent local opérationnel")
