#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Marlin Flow Studio - Local Agent.

Local-only execution engine for the Marlin Flow Studio web/desktop UI.

Responsibilities:
- PlatformIO Core bootstrap in a private virtual environment
- Build / Clean / Upload / Build+Upload with live log history
- Safe text-file read/write inside the selected project
- Configuration.h / Configuration_adv.h with optimistic SHA-256 locking
- Git status / pull --ff-only
- Serial ports / connect / disconnect / G-code send
- Marlin metadata detection (version + MOTHERBOARD)
- Persistent selected project path
- HTTP API bound to 127.0.0.1 only

No arbitrary shell endpoint is exposed.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import venv
import zipfile

try:
    from flask import Flask, jsonify, request
except ImportError:  # pragma: no cover
    Flask = None

try:
    import serial
    import serial.tools.list_ports
except ImportError:  # pragma: no cover
    serial = None

APP_NAME = "Marlin Flow Local Agent"
AGENT_VERSION = "2.13.0"
ALLOWED_PROJECT_ORIGINS = set()
HOST = "127.0.0.1"
PORT = 38765
MAX_TEXT_FILE = 4 * 1024 * 1024
CONFIG_FILES = ("Config.h", "Configuration.h", "Configuration_adv.h")
LOCAL_ORIGIN_PREFIXES = ("http://127.0.0.1:", "http://localhost:")

APP_DIR = Path(os.environ.get("MARLIN_AGENT_ROOT") or (Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent))
VENV_DIR = APP_DIR / ".platformio-venv"
CONFIG_DIR = APP_DIR / ".marlin-agent"
TOKEN_FILE = CONFIG_DIR / "token"
STATE_FILE = CONFIG_DIR / "state.json"
MARLIN_REPO = "https://github.com/MarlinFirmware/Marlin.git"
MARLIN_API = "https://api.github.com/repos/MarlinFirmware/Marlin/releases"


class AgentState:
    def __init__(self):
        self.lock = threading.RLock()
        self.project_dir = APP_DIR
        self.process: subprocess.Popen[str] | None = None
        self.operation: str | None = None
        self.operation_started: float | None = None
        self.log_seq = 0
        self.logs: list[dict] = []
        self.serial_connection = None
        self.serial_port: str | None = None
        self.serial_baud: int | None = None

    def log(self, message: str, level: str = "info") -> dict:
        with self.lock:
            self.log_seq += 1
            item = {
                "id": self.log_seq,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "epoch": time.time(),
                "level": level,
                "message": str(message),
            }
            self.logs.append(item)
            self.logs = self.logs[-4000:]
        return item

    def logs_after(self, since: int = 0, limit: int = 500) -> list[dict]:
        with self.lock:
            out = [x for x in self.logs if x["id"] > since]
            return out[-limit:]


STATE = AgentState()


def ensure_dirs() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_token() -> str:
    ensure_dirs()
    if TOKEN_FILE.exists():
        value = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if value:
            return value
    value = secrets.token_urlsafe(32)
    TOKEN_FILE.write_text(value, encoding="utf-8")
    try:
        os.chmod(TOKEN_FILE, 0o600)
    except OSError:
        pass
    return value


def load_persisted_project() -> None:
    ensure_dirs()
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}
        raw = data.get("project_dir")
        if raw:
            candidate = Path(raw).expanduser().resolve()
            if candidate.is_dir() and (candidate / "platformio.ini").exists():
                STATE.project_dir = candidate
    except Exception:
        pass


def save_persisted_project() -> None:
    ensure_dirs()
    payload = {"project_dir": str(STATE.project_dir), "updated_at": time.time()}
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


AGENT_TOKEN = load_token()
load_persisted_project()


def pio_python() -> Path:
    return VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def pio_bin() -> Path:
    return VENV_DIR / ("Scripts/platformio.exe" if os.name == "nt" else "bin/platformio")


def pio_installed() -> bool:
    return pio_bin().exists()


def create_venv() -> None:
    if pio_python().exists():
        return
    STATE.log(f"Création de l'environnement PlatformIO : {VENV_DIR}")
    venv.EnvBuilder(with_pip=True, symlinks=False, clear=False).create(VENV_DIR)
    STATE.log("Environnement Python créé.", "success")


def start_process(command: list[Path | str], cwd: Path, operation: str) -> bool:
    with STATE.lock:
        if STATE.process is not None:
            STATE.log("Une opération est déjà en cours.", "warning")
            return False
        if not cwd.is_dir():
            STATE.log(f"Dossier de projet invalide : {cwd}", "error")
            return False
        try:
            flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            env["PLATFORMIO_CORE_DIR"] = str(VENV_DIR / ".pio")
            cmd = [str(x) for x in command]
            STATE.operation = operation
            STATE.operation_started = time.time()
            STATE.log("$ " + " ".join(cmd), "command")
            STATE.process = subprocess.Popen(
                cmd,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env=env,
                creationflags=flags,
            )
            process = STATE.process
        except Exception as exc:
            STATE.process = None
            STATE.operation = None
            STATE.operation_started = None
            STATE.log(f"Impossible de lancer {operation}: {exc}", "error")
            return False

    def worker() -> None:
        try:
            if process.stdout:
                for line in iter(process.stdout.readline, ""):
                    if not line:
                        break
                    line = line.rstrip("\r\n")
                    if not line:
                        continue
                    upper = line.upper()
                    if any(x in upper for x in ("ERROR", "FAILED", "FATAL", "EXCEPTION")):
                        level = "error"
                    elif "WARN" in upper:
                        level = "warning"
                    elif any(x in upper for x in ("SUCCESS", "UPLOADED", "DONE")):
                        level = "success"
                    else:
                        level = "info"
                    STATE.log(line, level)
            rc = process.wait()
            STATE.log(f"{operation} terminé avec le code {rc}.", "success" if rc == 0 else "error")
        except Exception as exc:
            STATE.log(f"Erreur pendant {operation}: {exc}", "error")
        finally:
            with STATE.lock:
                STATE.process = None
                STATE.operation = None
                STATE.operation_started = None

    threading.Thread(target=worker, daemon=True, name=f"agent-{operation}").start()
    return True


def install_platformio_async() -> bool:
    with STATE.lock:
        if STATE.process is not None:
            return False
        try:
            create_venv()
        except Exception as exc:
            STATE.log(f"Création de l'environnement impossible : {exc}", "error")
            return False
        return start_process(
            [pio_python(), "-m", "pip", "install", "--upgrade", "pip", "platformio"],
            APP_DIR,
            "install-platformio",
        )


def env_name(payload: dict | None) -> str | None:
    value = (payload or {}).get("environment")
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    if not re.fullmatch(r"[A-Za-z0-9_.:+-]+", value):
        raise ValueError("Nom d'environnement PlatformIO invalide.")
    return value


def upload_port(payload: dict | None) -> str | None:
    value = str((payload or {}).get("upload_port") or "").strip()
    if not value:
        return None
    if len(value) > 200 or any(ord(c) < 32 for c in value):
        raise ValueError("Port de téléversement invalide.")
    return value


def pio_args(target: str | None, payload: dict | None) -> list[str]:
    args = ["run"]
    if target:
        args += ["--target", target]
    env = env_name(payload)
    if env:
        args += ["-e", env]
    port = upload_port(payload)
    if port and target == "upload":
        args += ["--upload-port", port]
    return args


def execute_pio(args: list[str], operation: str) -> bool:
    if not pio_installed():
        STATE.log("PlatformIO Core n'est pas installé.", "error")
        return False
    if not (STATE.project_dir / "platformio.ini").exists():
        STATE.log("platformio.ini introuvable dans le projet.", "error")
        return False
    if operation in {"build", "build-upload", "upload"}:
        doctor = marlin_doctor()
        if doctor.get("errors"):
            for item in doctor.get("checks", []):
                if item.get("status") == "error":
                    STATE.log(f"PRÉ-VÉRIFICATION : {item.get('label')} — {item.get('detail')}", "error")
            STATE.log("BUILD BLOQUÉ : corrigez les erreurs du Marlin Doctor avant de compiler.", "error")
            return False
    return start_process([pio_bin(), *args], STATE.project_dir, operation)






def _parse_ini_file(path: Path) -> tuple[list[str], dict[str, dict[str, str]]]:
    if not path.exists():
        return [], {}
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return [], {}
    sections: dict[str, dict[str, str]] = {}
    current = None
    last_key = None
    for raw in text.splitlines():
        match = re.match(r"^\s*\[\s*([^\]]+)\s*\]\s*$", raw)
        if match:
            current = match.group(1).strip()
            sections.setdefault(current, {})
            last_key = None
            continue
        if not current or not raw.strip() or raw.lstrip().startswith(("#", ";")):
            continue
        if raw[:1].isspace() and last_key:
            sections[current][last_key] = f"{sections[current][last_key]} {raw.strip()}".strip()
            continue
        if "=" in raw:
            key, value = raw.split("=", 1)
            last_key = key.strip().lower()
            sections[current][last_key] = value.strip()
    envs = []
    for name in sections:
        if name.lower().startswith("env:"):
            env = name.split(":", 1)[1].strip()
            if env:
                envs.append(env)
    return envs, sections


def _resolve_extra_config_paths(base_dir: Path, raw: str) -> list[Path]:
    """Resolve PlatformIO extra_configs values, including glob patterns.

    Marlin commonly uses values such as `ini/*.ini` in platformio.ini.
    The resolver stays inside the project tree and ignores missing entries.
    """
    result, seen = [], set()
    base_dir = base_dir.resolve()
    for value in re.split(r"[,\n]", raw or ""):
        value = os.path.expandvars(value.strip().strip('"').strip("'"))
        if not value:
            continue
        raw_path = Path(value).expanduser()
        pattern = raw_path if raw_path.is_absolute() else base_dir / raw_path
        candidates: list[Path] = []
        try:
            # Path.glob works for both literal paths and Marlin's `*.ini` patterns.
            if any(ch in str(pattern) for ch in "*?["):
                candidates.extend(pattern.parent.glob(pattern.name))
            else:
                candidates.append(pattern)
        except (OSError, ValueError):
            pass
        # Marlin projects occasionally refer to `foo.ini` while storing it in `ini/`.
        if not raw_path.is_absolute() and raw_path.parent == Path('.') and not candidates:
            try:
                fallback = base_dir / "ini" / raw_path.name
                if fallback.exists():
                    candidates.append(fallback)
            except OSError:
                pass
        for candidate in sorted(candidates, key=lambda x: str(x).lower()):
            try:
                resolved = candidate.resolve()
                resolved.relative_to(STATE.project_dir.resolve())
            except (OSError, ValueError):
                continue
            if resolved.is_file() and resolved.suffix.lower() == ".ini" and str(resolved) not in seen:
                seen.add(str(resolved))
                result.append(resolved)
    return result


def read_ini() -> dict:
    path = STATE.project_dir / "platformio.ini"
    if not path.exists():
        return {
            "exists": False,
            "path": str(path),
            "environments": [],
            "default_envs": [],
            "selected_environment": None,
            "content": "",
            "environment_details": [],
            "environment_sources": {},
            "extra_configs": [],
            "environment_count": 0,
            "ini_directory_sources": [],
        }

    content = path.read_text(encoding="utf-8", errors="replace")
    _, root_sections = _parse_ini_file(path)
    platform_section = next((values for name, values in root_sections.items() if name.lower() == "platformio"), {})
    default_envs = [x.strip() for x in re.split(r"[,;\s]+", platform_section.get("default_envs", "")) if x.strip()]
    # Development environments are sourced from the Marlin repository's own
    # `ini/` directory. This is the authoritative source for the selector and
    # for compatibility analysis. We support both layouts encountered in
    # local projects: <project>/ini and <project>/Marlin/ini.
    env_sections: dict[str, dict] = {}
    templates: dict[str, dict] = {}
    sources: dict[str, str] = {}
    source_files: list[str] = []
    visited: set[str] = set()

    marlin_ini_dir = None
    for candidate in (STATE.project_dir / "ini", STATE.project_dir / "Marlin" / "ini"):
        if candidate.is_dir():
            marlin_ini_dir = candidate.resolve()
            break

    def ingest(ini_path: Path, depth: int = 0, source_kind: str = "project"):
        if depth > 20:
            return
        try:
            key = str(ini_path.resolve())
        except OSError:
            return
        if key in visited or not ini_path.is_file():
            return
        visited.add(key)
        try:
            rel = ini_path.relative_to(STATE.project_dir).as_posix()
        except ValueError:
            rel = str(ini_path)
        source_files.append(rel)

        _, sections = _parse_ini_file(ini_path)
        for section_name, values in sections.items():
            if section_name.lower() == "platformio":
                continue
            if section_name.lower().startswith("env:"):
                env = section_name.split(":", 1)[1].strip()
                if env:
                    env_sections.setdefault(env, {
                        "name": env,
                        "section": section_name,
                        "source": rel,
                        "source_kind": source_kind,
                        "values": {},
                    })["values"].update(values)
            else:
                # PlatformIO template sections such as [common_stm32] and
                # [stm32_variant] are not build environments themselves, but
                # their values are inherited by [env:*] via `extends`.
                templates.setdefault(section_name, {"source": rel, "source_kind": source_kind, "values": {}})["values"].update(values)

        nested_platform = next((values for name, values in sections.items() if name.lower() == "platformio"), {})
        for child in _resolve_extra_config_paths(ini_path.parent, nested_platform.get("extra_configs", "")):
            ingest(child, depth + 1, source_kind)

    # Parse the root file only for default_envs and its declared extra_configs
    # metadata. Do not take root [env:*] sections as development environments.
    # The authoritative environment catalog is always the project's own
    # Marlin/ini directory.
    if marlin_ini_dir is not None:
        for ini_file in sorted(marlin_ini_dir.glob("*.ini"), key=lambda x: x.name.lower()):
            ingest(ini_file, source_kind="marlin-ini")
        # Some Marlin configurations use extra_configs from a file inside ini/.
        # `ingest` above recursively resolves those references.
    else:
        # Keep a useful diagnostic when a project is incomplete, but do not
        # silently fall back to the bundled database: that can expose environments
        # that do not belong to the selected Marlin source tree.
        STATE.log("Dossier Marlin/ini introuvable : aucun environnement de développement Marlin ne sera proposé.", "warning")

    def resolve_template(name: str, stack: tuple[str, ...] = ()) -> dict:
        if not name:
            return {}
        key = next((k for k in templates if k.lower() == name.lower()), None)
        if not key or key in stack or len(stack) > 20:
            return {}
        base = dict(templates[key].get("values", {}))
        parents = re.split(r"[,\s]+", str(base.get("extends", ""))) if base.get("extends") else []
        resolved = {}
        for parent in filter(None, parents):
            resolved.update(resolve_template(parent, stack + (key,)))
        resolved.update(base)
        return resolved

    def resolve_environment(name: str, stack: tuple[str, ...] = ()) -> dict:
        if name in stack or len(stack) > 20:
            return {}
        entry = env_sections.get(name)
        if not entry:
            # Case-insensitive lookup for inherited template names.
            match = next((k for k in env_sections if k.lower() == name.lower()), None)
            entry = env_sections.get(match) if match else None
        if not entry:
            return {}
        values = dict(entry.get("values", {}))
        parents = re.split(r"[,\s]+", str(values.get("extends", ""))) if values.get("extends") else []
        resolved = {}
        for parent in filter(None, parents):
            # Prefer an environment parent if one exists; otherwise use a
            # regular PlatformIO template section.
            if parent in env_sections or any(k.lower() == parent.lower() for k in env_sections):
                resolved.update(resolve_environment(parent, stack + (name,)))
            else:
                resolved.update(resolve_template(parent, stack + (name,)))
        resolved.update(values)
        return resolved

    details = []
    for env_name in sorted(env_sections, key=str.lower):
        entry = env_sections[env_name]
        values = resolve_environment(env_name)
        rel = entry.get("source", "")
        # For an env coming from ini/, keep the actual file visible in the UI.
        architecture = Path(rel).stem.replace("-", " ").upper()
        details.append({
            "name": env_name,
            "source": rel,
            "architecture": architecture,
            "source_kind": entry.get("source_kind", "project"),
            "in_ini_directory": bool(re.search(r"(?:^|[/\\])ini[/\\][^/\\]+\.ini$", rel, re.I)) and entry.get("source_kind") == "marlin-ini",
            "board": values.get("board"),
            "platform": values.get("platform"),
            "framework": values.get("framework"),
            "extends": values.get("extends"),
            "upload_protocol": values.get("upload_protocol"),
            "upload_command": values.get("upload_command"),
            "board_build_variant": values.get("board_build.variant"),
            "board_build_core": values.get("board_build.core"),
            "board_build_mcu": values.get("board_build.mcu"),
            "build_flags": values.get("build_flags"),
            "resolved": True,
            "raw": values,
        })
        sources[env_name] = rel

    selected = next((env for env in default_envs if env in env_sections), None)
    if selected is None and default_envs:
        # Case-insensitive safety fallback, still restricted to Marlin/ini.
        selected = next((k for k in env_sections if k.lower() == default_envs[0].lower()), None)

    ini_directory_sources = [rel for rel in source_files if bool(re.search(r"(?:^|[/\\])ini[/\\][^/\\]+\.ini$", rel, re.I))]

    return {
        "exists": True,
        "path": str(path),
        "sha256": sha256(path),
        "environments": [x["name"] for x in details],
        "default_envs": default_envs,
        "selected_environment": selected,
        "content": content,
        "environment_details": details,
        "environment_sources": sources,
        "extra_configs": source_files[1:],
        "ini_directory_sources": ini_directory_sources,
        "environment_count": len(details),
        "development_environment_source": str(marlin_ini_dir) if marlin_ini_dir else None,
        "development_environment_source_relative": (marlin_ini_dir.relative_to(STATE.project_dir).as_posix() if marlin_ini_dir else None),
        "development_environment_mode": "marlin-ini" if marlin_ini_dir else "missing",
    }





def set_default_env(environment: str) -> dict:
    """Persist a build environment, only when defined by the project's Marlin/ini tree."""
    name = str(environment or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_.:+-]+", name):
        raise ValueError("Nom d'environnement PlatformIO invalide.")
    info = read_ini()
    match = next((env for env in info.get("environments", []) if env.lower() == name.lower()), None)
    if match is None:
        raise ValueError(f"Environnement inexistant dans le dossier Marlin/ini : {name}")
    path = STATE.project_dir / "platformio.ini"
    text = path.read_text(encoding="utf-8", errors="replace")
    section = re.search(r"(?im)^\s*\[platformio\]\s*$", text)
    if not section:
        text = f"[platformio]\ndefault_envs = {match}\n\n" + text
    else:
        start_pos = section.end()
        nxt = re.search(r"(?m)^\s*\[[^\]]+\]\s*$", text[start_pos:])
        end_pos = start_pos + (nxt.start() if nxt else len(text[start_pos:]))
        block = text[start_pos:end_pos]
        if re.search(r"(?im)^\s*default_envs\s*=", block):
            block = re.sub(r"(?im)^\s*default_envs\s*=.*$", f"default_envs = {match}", block, count=1)
        else:
            block = f"\ndefault_envs = {match}\n" + block
        text = text[:start_pos] + block + text[end_pos:]
    atomic_write_text(path, text)
    STATE.log(f"Environnement PlatformIO sélectionné depuis Marlin/ini : {match}", "success")
    return {**read_ini(), "selected_environment": match}

def sha256(path: Path) -> str | None:
    if not path.exists() or not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_project_path(raw: str) -> Path:
    value = str(raw or "").strip()
    if not value:
        raise ValueError("Chemin requis.")
    path = Path(value).expanduser().resolve()
    root = STATE.project_dir.resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise ValueError("Le fichier doit se trouver à l'intérieur du projet local.")
    return path


def config_path(filename: str) -> Path:
    if filename not in CONFIG_FILES:
        raise ValueError("Fichier de configuration non autorisé.")
    candidates = [
        STATE.project_dir / filename,
        STATE.project_dir / "Marlin" / filename,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return STATE.project_dir / "Marlin" / filename if (STATE.project_dir / "Marlin").is_dir() else candidates[0]


def _configuration_roots() -> list[Path]:
    roots = [STATE.project_dir, STATE.project_dir / "Marlin"]
    return [p for p in roots if p.is_dir()]


def _find_configuration_file(filename: str) -> Path | None:
    for root in _configuration_roots():
        candidate = root / filename
        if candidate.is_file():
            return candidate
    return None


def _parse_marlin_version_value(value: str | None) -> tuple[int, ...] | None:
    if not value:
        return None
    m = re.search(r"(\d+(?:\.\d+){1,3})", str(value))
    if not m:
        return None
    return tuple(int(x) for x in m.group(1).split("."))


def _version_at_least(version: tuple[int, ...] | None, wanted: tuple[int, ...]) -> bool:
    if version is None:
        return False
    padded = version + (0,) * (len(wanted) - len(version))
    return padded >= wanted


def _extract_defines(text: str) -> dict[str, str]:
    """Extract active #define KEY value pairs without evaluating conditional code."""
    defines: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line.startswith("#define"):
            continue
        m = re.match(r"#define\s+([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$", line)
        if not m:
            continue
        key, value = m.group(1), m.group(2).strip()
        if key.startswith("CONFIGURATION_") or key.startswith("STRING_") and key.endswith("_VERSION"):
            continue
        defines[key] = value
    return defines


def _target_define_inventory() -> set[str]:
    keys: set[str] = set()
    for filename in CONFIG_FILES:
        path = _find_configuration_file(filename)
        if not path:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"^\s*//?\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)", text, re.MULTILINE):
            keys.add(m.group(1))
    return keys


def _ini_value(value: str) -> str:
    value = value.strip()
    if value == "":
        return "on"
    # Marlin's config.ini accepts literal values. Keep expressions, arrays and strings intact.
    if value.startswith('"') and value.endswith('"'):
        return value
    if value in {"true", "TRUE", "on", "ON"}:
        return "on"
    if value in {"false", "FALSE", "off", "OFF"}:
        return "off"
    return value


def _read_project_marlin_version() -> str | None:
    info = detect_marlin_info()
    return info.get("version")


def _config_migration_report(source_files: dict[str, str]) -> dict:
    target_version_raw = _read_project_marlin_version()
    target_version = _parse_marlin_version_value(target_version_raw)
    source_defines: dict[str, str] = {}
    source_versions: dict[str, str] = {}
    for filename, content in source_files.items():
        source_defines.update(_extract_defines(content))
        for macro in ("CONFIGURATION_H_VERSION", "CONFIGURATION_ADV_H_VERSION"):
            m = re.search(rf"^\s*#define\s+{macro}\s+(\d+)", content, re.MULTILINE)
            if m:
                source_versions[macro] = m.group(1)
    target_keys = _target_define_inventory()
    accepted, skipped = {}, {}
    for key, value in source_defines.items():
        if key in target_keys:
            accepted[key] = value
        else:
            skipped[key] = value
    return {
        "target_version": target_version_raw,
        "source_configuration_versions": source_versions,
        "source_define_count": len(source_defines),
        "accepted_count": len(accepted),
        "skipped_count": len(skipped),
        "accepted": accepted,
        "skipped": skipped,
        "target_has_config_h": _find_configuration_file("Config.h") is not None,
        "target_uses_config_h": _version_at_least(target_version, (2, 1, 3)),
    }


def migrate_configuration(source_files: dict[str, str], dry_run: bool = False) -> dict:
    if not isinstance(source_files, dict) or not source_files:
        raise ValueError("Aucun fichier de configuration source fourni.")
    allowed = {"Config.h", "Configuration.h", "Configuration_adv.h", "config.ini", "schema.json", "schema.yml", "marlin_config.json"}
    normalized = {str(k): str(v) for k, v in source_files.items() if str(k) in allowed and isinstance(v, str)}
    if not normalized:
        raise ValueError("Aucun fichier de configuration pris en charge.")

    report = _config_migration_report(normalized)
    accepted = report["accepted"]
    if "MOTHERBOARD" not in accepted:
        # If an existing target already has a valid motherboard, don't invent one.
        current = detect_marlin_info().get("motherboard")
        if current:
            accepted["MOTHERBOARD"] = current
            report["motherboard_source"] = "target-project"
        else:
            report["motherboard_source"] = None
            raise ValueError("Migration refusée : MOTHERBOARD est absent de la configuration source et du projet cible.")
    else:
        report["motherboard_source"] = "source"

    target_version = _parse_marlin_version_value(report.get("target_version"))
    changes = []
    backups = []
    written = []

    # Preferred path for Marlin >= 2.1.0: use Marlin's official config.ini
    # preprocessing instead of replacing current headers wholesale.
    if _version_at_least(target_version, (2, 1, 0)):
        config_ini = _find_configuration_file("config.ini") or (STATE.project_dir / "Marlin" / "config.ini")
        section_name = "mfs_migrated"
        lines = [
            "",
            "# ===== Marlin Flow Studio migrated configuration =====",
            "# Generated from an older configuration. The current Marlin headers remain untouched.",
            f"[config:{section_name}]",
        ]
        for key in sorted(accepted):
            if key in {"CONFIGURATION_H_VERSION", "CONFIGURATION_ADV_H_VERSION", "STRING_CONFIG_H_AUTHOR"}:
                continue
            lines.append(f"{key.lower()} = {_ini_value(accepted[key])}")
        migrated_section = "\n".join(lines) + "\n"
        if not dry_run:
            current_text = config_ini.read_text(encoding="utf-8", errors="replace") if config_ini.exists() else "[config:base]\nini_use_config = none\n"
            base_match = re.search(r"(?im)^\s*ini_use_config\s*=\s*(.*?)\s*$", current_text)
            old_value = base_match.group(1).strip() if base_match else "none"
            new_value = section_name if old_value.lower() in {"", "none"} else f"{old_value}, {section_name}"
            if base_match:
                current_text = current_text[:base_match.start(1)] + new_value + current_text[base_match.end(1):]
            else:
                current_text = "[config:base]\nini_use_config = " + new_value + "\n\n" + current_text
            # Replace a previous MFS section rather than accumulating stale migrations.
            section_re = re.compile(rf"(?ms)^\[config:{re.escape(section_name)}\]\s*.*?(?=^\[|\Z)")
            if section_re.search(current_text):
                current_text = section_re.sub(migrated_section.lstrip(), current_text)
            else:
                current_text = current_text.rstrip() + migrated_section
            result = write_text_file(config_ini, current_text, backup=True)
            written.append(str(config_ini)); backups.append(result.get("backup"))
        report["strategy"] = "config.ini"
        report["written"] = written
        report["backups"] = backups
        report["preview"] = migrated_section
        changes.append(f"{len(accepted)} paramètres appliqués via [config:{section_name}]")
    else:
        # Legacy Marlin: patch only defines that already exist in the target templates.
        for filename in ("Configuration.h", "Configuration_adv.h"):
            target = _find_configuration_file(filename)
            if not target:
                continue
            text = target.read_text(encoding="utf-8", errors="replace")
            before = text
            for key, value in accepted.items():
                pattern = re.compile(rf"^(\s*//?\s*#define\s+{re.escape(key)})(?:\s+.*)?$", re.MULTILINE)
                if pattern.search(text):
                    text = pattern.sub(lambda m: f"#define {key} {value}" if value else f"#define {key}", text, count=1)
            if text != before and not dry_run:
                result = write_text_file(target, text, backup=True)
                written.append(str(target)); backups.append(result.get("backup")); changes.append(f"{target.name} mis à jour")
        report["strategy"] = "template-merge"
        report["written"] = written
        report["backups"] = backups
        report["preview"] = None

    # Hard validation: never allow a migrated project to lose MOTHERBOARD.
    post = detect_marlin_info()
    report["post_migration_motherboard"] = post.get("motherboard")
    report["post_migration_version"] = post.get("version")
    report["changes"] = changes
    if not dry_run and not post.get("motherboard"):
        raise RuntimeError("Migration terminée sans MOTHERBOARD détectable : build bloqué pour sécurité.")
    STATE.log(f"Migration de configuration : {report['accepted_count']} paramètres acceptés, {report['skipped_count']} ignorés.", "success")
    return report


def read_text_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(path.name)
    size = path.stat().st_size
    if size > MAX_TEXT_FILE:
        raise ValueError(f"Fichier trop volumineux ({size} octets).")
    return path.read_text(encoding="utf-8", errors="replace")


def read_config(filename: str) -> dict:
    path = config_path(filename)
    return {"filename": filename, "path": str(path), "content": read_text_file(path), "sha256": sha256(path)}


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(content, encoding="utf-8", newline="")
    tmp.replace(path)


def write_text_file(path: Path, content: str, expected_sha256: str | None = None, backup: bool = True) -> dict:
    if not isinstance(content, str):
        raise ValueError("content doit être une chaîne.")
    if len(content.encode("utf-8")) > MAX_TEXT_FILE:
        raise ValueError("Le contenu est trop volumineux.")
    current = sha256(path)
    if expected_sha256 and current != expected_sha256:
        raise RuntimeError("Le fichier a changé depuis sa dernière lecture.")
    backup_path = path.with_suffix(path.suffix + ".bak")
    if backup and path.exists():
        shutil.copy2(path, backup_path)
    atomic_write_text(path, content)
    return {"path": str(path), "sha256": sha256(path), "backup": str(backup_path) if backup_path.exists() else None}


def list_files() -> list[dict]:
    out: list[dict] = []
    ignored = {".git", ".pio", ".venv", "node_modules", ".platformio-venv"}
    for path in STATE.project_dir.rglob("*"):
        try:
            if not path.is_file() or any(part in ignored for part in path.parts):
                continue
            rel = path.relative_to(STATE.project_dir).as_posix()
            if path.stat().st_size > MAX_TEXT_FILE:
                continue
            out.append({"path": rel, "size": path.stat().st_size, "suffix": path.suffix.lower()})
        except OSError:
            continue
    out.sort(key=lambda x: x["path"].lower())
    return out[:2000]


def _artifact_roots() -> list[Path]:
    roots: list[Path] = []
    project = STATE.project_dir.resolve()
    direct = project / ".pio" / "build"
    if direct.is_dir():
        roots.append(direct)
    # Also support projects whose PlatformIO build directory is nested (for example
    # a wrapper project containing a Marlin checkout). Limit the walk to shallow
    # paths and skip large/runtime trees.
    skipped = {".git", ".venv", ".platformio-venv", "node_modules"}
    try:
        for base in project.rglob(".pio"):
            if not base.is_dir() or any(part in skipped for part in base.parts):
                continue
            candidate = base / "build"
            if candidate.is_dir() and candidate not in roots:
                try:
                    candidate.relative_to(project)
                except ValueError:
                    continue
                if len(candidate.relative_to(project).parts) <= 8:
                    roots.append(candidate)
    except OSError:
        pass
    return roots


def build_artifacts() -> list[dict]:
    extensions = {".bin", ".hex", ".uf2", ".elf", ".img"}
    ignored_names = {"firmware.hex.tmp"}
    out = []
    seen: set[str] = set()
    for root in _artifact_roots():
        for path in root.rglob("*"):
            try:
                if not path.is_file() or path.name in ignored_names or path.suffix.lower() not in extensions:
                    continue
                rel = path.relative_to(STATE.project_dir).as_posix()
                if rel in seen:
                    continue
                seen.add(rel)
                stat = path.stat()
                try:
                    environment = path.relative_to(root).parts[0]
                except (ValueError, IndexError):
                    environment = ""
                out.append({
                    "path": rel,
                    "name": path.name,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "extension": path.suffix.lower(),
                    "environment": environment,
                    "sha256": sha256(path),
                })
            except OSError:
                continue
    out.sort(key=lambda x: x["modified"], reverse=True)
    return out[:100]


def removable_mounts() -> list[dict]:
    mounts: list[dict] = []
    seen: set[str] = set()

    def add_mount(mount: str, label: str = "", device: str = "", size: int | None = None, free: int | None = None):
        try:
            p = Path(mount).expanduser().resolve()
        except Exception:
            return
        if not p.is_dir() or str(p) in seen:
            return
        try:
            if not os.access(p, os.W_OK):
                return
        except OSError:
            return
        try:
            usage = shutil.disk_usage(p)
            total = usage.total
            available = usage.free
        except OSError:
            total = size
            available = free
        seen.add(str(p))
        mounts.append({
            "mount": str(p),
            "label": label or p.name,
            "device": device,
            "size_bytes": total or 0,
            "free_bytes": available or 0,
        })

    if os.name == "nt":
        import ctypes
        DRIVE_REMOVABLE = 2
        get_drive_type = ctypes.windll.kernel32.GetDriveTypeW
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            drive = f"{letter}:\\"
            try:
                if get_drive_type(drive) == DRIVE_REMOVABLE:
                    add_mount(drive, label=drive.rstrip("\\"))
            except Exception:
                continue
    elif sys.platform == "darwin":
        volumes = Path("/Volumes")
        if volumes.is_dir():
            for p in volumes.iterdir():
                if p.name not in {"Macintosh HD", "Data"}:
                    add_mount(str(p))
    else:
        # lsblk gives a reliable removable flag on Linux and works with ext4/vfat/exfat/etc.
        lsblk = shutil.which("lsblk")
        if lsblk:
            try:
                proc = subprocess.run([lsblk, "-J", "-o", "NAME,MOUNTPOINT,RM,TYPE,LABEL,SIZE"], capture_output=True, text=True, timeout=5)
                data = json.loads(proc.stdout or "{}") if proc.returncode == 0 else {}
                def walk(devs):
                    for dev in devs or []:
                        if str(dev.get("rm", "0")) == "1" and dev.get("mountpoint"):
                            add_mount(str(dev["mountpoint"]), str(dev.get("label") or ""), str(dev.get("name") or ""))
                        walk(dev.get("children", []))
                walk(data.get("blockdevices", []))
            except Exception:
                pass
        user = os.environ.get("USER") or os.environ.get("USERNAME") or ""
        for base in (Path("/run/media") / user, Path("/media") / user):
            if base.is_dir():
                for p in base.iterdir():
                    add_mount(str(p))
        # Common manually mounted removable locations. These are presented only if they
        # exist and are writable; the UI lets the user choose explicitly.
        mnt = Path("/mnt")
        if mnt.is_dir():
            for p in mnt.iterdir():
                if p.is_dir():
                    try:
                        if os.access(p, os.W_OK):
                            add_mount(str(p))
                    except OSError:
                        pass

    mounts.sort(key=lambda x: (x["label"].lower(), x["mount"].lower()))
    return mounts[:50]


def safe_artifact_path(raw: str) -> Path:
    value = str(raw or "").strip()
    if not value:
        raise ValueError("Firmware requis.")
    candidate = (STATE.project_dir / value).resolve()
    try:
        rel = candidate.relative_to(STATE.project_dir.resolve())
    except ValueError:
        raise ValueError("Le firmware doit se trouver dans le projet.")
    if ".pio" not in rel.parts or "build" not in rel.parts:
        raise ValueError("Seuls les artefacts issus de .pio/build peuvent être enregistrés.")
    if candidate.suffix.lower() not in {".bin", ".hex", ".uf2", ".elf", ".img"} or not candidate.is_file():
        raise ValueError("Firmware introuvable ou format non pris en charge.")
    return candidate


def save_artifact_to_removable(artifact_raw: str, mount_raw: str, filename: str = "", overwrite: bool = False) -> dict:
    artifact = safe_artifact_path(artifact_raw)
    mounts = removable_mounts()
    selected = None
    for item in mounts:
        if str(Path(item["mount"]).resolve()) == str(Path(str(mount_raw or "")).expanduser().resolve()):
            selected = item
            break
    if not selected:
        raise ValueError("Carte mémoire non détectée ou non accessible.")

    original = Path(filename or artifact.name).name
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._ -]{0,119}", original):
        raise ValueError("Nom de fichier invalide.")
    if Path(original).suffix.lower() != artifact.suffix.lower():
        raise ValueError("L'extension du firmware ne peut pas être modifiée.")

    destination_root = Path(selected["mount"]).resolve()
    destination = (destination_root / original).resolve()
    try:
        destination.relative_to(destination_root)
    except ValueError:
        raise ValueError("Destination invalide.")
    if destination.exists() and not overwrite:
        raise FileExistsError(f"Le fichier existe déjà sur la carte : {destination.name}")
    try:
        free_bytes = shutil.disk_usage(destination_root).free
        if free_bytes < artifact.stat().st_size:
            raise OSError("Espace insuffisant sur la carte mémoire.")
    except OSError as exc:
        if "Espace insuffisant" in str(exc):
            raise
    shutil.copy2(artifact, destination)
    if destination.stat().st_size != artifact.stat().st_size:
        raise IOError("La copie du firmware est incomplète.")
    STATE.log(f"Firmware enregistré sur la carte mémoire : {destination}", "success")
    return {
        "source": str(artifact),
        "destination": str(destination),
        "filename": destination.name,
        "size": destination.stat().st_size,
        "sha256": sha256(destination),
        "mount": selected["mount"],
        "label": selected["label"],
    }


def detect_marlin_info() -> dict:
    result = {"version": None, "motherboard": None, "configuration_path": None, "version_path": None}
    for rel in ("Marlin/Version.h", "Version.h"):
        path = STATE.project_dir / rel
        if path.exists():
            result["version_path"] = str(path)
            text = path.read_text(encoding="utf-8", errors="replace")
            v = re.search(r"^\s*#define\s+SHORT_BUILD_VERSION\s+\"([^\"]+)\"", text, re.MULTILINE)
            if not v:
                v = re.search(r"^\s*#define\s+STRING_DISTRIBUTION_DATE\s+\"([^\"]+)\"", text, re.MULTILINE)
            result["version"] = v.group(1) if v else None
            break
    for filename in CONFIG_FILES:
        path = config_path(filename)
        if path.exists():
            text = path.read_text(encoding="utf-8", errors="replace")
            result["configuration_path"] = str(path)
            m = re.search(r"^\s*#define\s+MOTHERBOARD\s+(\S+)", text, re.MULTILINE)
            if m:
                result["motherboard"] = m.group(1)
                break
    return result



def marlin_doctor() -> dict:
    """Run a non-destructive project health check before build/migration."""
    checks = []
    def check(key, label, status, detail, fix=None):
        checks.append({"key": key, "label": label, "status": status, "detail": detail, "fix": fix})

    project = STATE.project_dir
    pio_ini = project / "platformio.ini"
    check("project", "Projet local", "ok" if project.is_dir() else "error", str(project))
    check("platformio", "platformio.ini", "ok" if pio_ini.exists() else "error", "Présent" if pio_ini.exists() else "Introuvable", "Sélectionner un projet PlatformIO")
    info = detect_marlin_info()
    check("marlin", "Version Marlin", "ok" if info.get("version") else "warning", info.get("version") or "Version non détectée")
    check("motherboard", "MOTHERBOARD", "ok" if info.get("motherboard") else "error", info.get("motherboard") or "Absent de la configuration active", "Importer/migrer une configuration contenant MOTHERBOARD")

    ini = read_ini()
    envs = ini.get("environments", [])
    selected = ini.get("selected_environment") or (ini.get("default_envs") or [None])[0]
    check("environments", "Environnements Marlin/ini", "ok" if envs else "error", f"{len(envs)} environnement(s) détecté(s)", "Vérifier le dossier Marlin/ini")
    check("selected_env", "Environnement sélectionné", "ok" if selected and selected in envs else "warning", selected or "Aucun default_envs défini", "Sélectionner un environnement PlatformIO")

    config_paths = []
    for filename in ("Config.h", "Configuration.h", "Configuration_adv.h"):
        path = _find_configuration_file(filename)
        if path:
            config_paths.append(path)
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
                lines = text.splitlines()
                balance = 0
                malformed = []
                for idx, line in enumerate(lines, 1):
                    m = re.match(r"^\s*#\s*(if|ifdef|ifndef)\b", line)
                    if m: balance += 1
                    if re.match(r"^\s*#\s*endif\b", line):
                        balance -= 1
                        if balance < 0: malformed.append(idx); balance = 0
                if balance or malformed:
                    check("preprocessor_" + filename, f"Préprocesseur {filename}", "error", f"Blocs #if/#endif déséquilibrés ({balance:+d})", "Restaurer/migrer le fichier depuis le modèle de la version cible")
                else:
                    check("preprocessor_" + filename, f"Préprocesseur {filename}", "ok", "Structure #if/#endif cohérente")
            except OSError as exc:
                check("read_" + filename, filename, "error", str(exc))
    if not config_paths:
        check("config", "Fichiers de configuration", "error", "Aucun Config.h/Configuration.h trouvé", "Créer ou sélectionner un projet Marlin valide")

    pio_ok = pio_installed()
    check("pio", "PlatformIO Core", "ok" if pio_ok else "warning", str(pio_bin()) if pio_ok else "Non installé", "Installer PlatformIO depuis l'onglet Agent local")
    git = git_status()
    check("git", "Git", "ok" if git.get("repository") else "warning", f"{git.get('branch','')} · {git.get('commit','')}" if git.get('repository') else "Pas de dépôt Git détecté")

    blocking = [c for c in checks if c["status"] == "error"]
    warnings = [c for c in checks if c["status"] == "warning"]
    return {
        "success": True,
        "timestamp": time.time(),
        "project": str(project),
        "marlin": info,
        "selected_environment": selected,
        "checks": checks,
        "errors": len(blocking),
        "warnings": len(warnings),
        "ready": not blocking,
    }

def git_status() -> dict:
    """Fast, bounded Git status probe used by UI diagnostics.

    The Doctor must never block the HTTP request for a long time because Git
    is missing, a repository is on a slow filesystem, or a credential helper
    is waiting.
    """
    git = shutil.which("git")
    if not git:
        return {"installed": False, "repository": False, "clean": False, "status": []}
    try:
        probe = subprocess.run(
            [git, "rev-parse", "--is-inside-work-tree"],
            cwd=str(STATE.project_dir), capture_output=True, text=True, timeout=2,
        )
        if probe.returncode != 0 or probe.stdout.strip() != "true":
            return {"installed": True, "repository": False, "clean": False, "status": []}

        branch_probe = subprocess.run(
            [git, "branch", "--show-current"],
            cwd=str(STATE.project_dir), capture_output=True, text=True, timeout=2,
        )
        commit_probe = subprocess.run(
            [git, "rev-parse", "--short", "HEAD"],
            cwd=str(STATE.project_dir), capture_output=True, text=True, timeout=2,
        )
        status_probe = subprocess.run(
            [git, "status", "--short"],
            cwd=str(STATE.project_dir), capture_output=True, text=True, timeout=3,
        )
        changes = status_probe.stdout.splitlines() if status_probe.returncode == 0 else []
        return {
            "installed": True, "repository": True,
            "branch": branch_probe.stdout.strip(),
            "commit": commit_probe.stdout.strip(),
            "status": changes, "clean": not changes,
        }
    except subprocess.TimeoutExpired:
        return {"installed": True, "repository": True, "clean": False, "status": [], "error": "Git a dépassé le délai de diagnostic."}
    except Exception as exc:
        return {"installed": True, "repository": False, "clean": False, "status": [], "error": str(exc)}


def git_pull_async() -> bool:
    git = shutil.which("git")
    if not git:
        STATE.log("Git n'est pas installé.", "error")
        return False
    return start_process([git, "pull", "--ff-only"], STATE.project_dir, "git-pull")


def git_installed() -> bool:
    return bool(shutil.which("git"))


def latest_marlin_release() -> dict:
    req = urllib.request.Request(
        MARLIN_API + "?per_page=30",
        headers={"User-Agent": "MarlinFlowStudio/1.5.1", "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))
    for release in data:
        if release.get("draft") or release.get("prerelease"):
            continue
        tag = str(release.get("tag_name") or "").strip()
        if not tag or not re.match(r"^\d+\.\d+(?:\.\d+)*$", tag.lstrip("v")):
            continue
        return {
            "tag": tag,
            "name": release.get("name") or tag,
            "published_at": release.get("published_at"),
            "html_url": release.get("html_url"),
            "zipball_url": release.get("zipball_url") or f"https://github.com/MarlinFirmware/Marlin/archive/refs/tags/{tag}.zip",
            "source": "GitHub Releases API",
        }
    raise RuntimeError("Aucune version stable de Marlin n'a été trouvée.")


def _safe_extract_zip(archive: Path, destination: Path) -> None:
    destination = destination.resolve()
    with zipfile.ZipFile(archive) as zf:
        for info in zf.infolist():
            target = (destination / info.filename).resolve()
            try:
                target.relative_to(destination)
            except ValueError:
                raise RuntimeError("Archive Marlin non sûre : chemin invalide.")
        zf.extractall(destination)


def _copy_extracted_root(source_root: Path, target: Path) -> None:
    entries = [p for p in source_root.iterdir()]
    if len(entries) == 1 and entries[0].is_dir():
        source_root = entries[0]
    target.mkdir(parents=True, exist_ok=True)
    for child in source_root.iterdir():
        shutil.move(str(child), str(target / child.name))


def create_marlin_project(destination_parent: str, project_name: str, tag: str | None = None) -> dict:
    parent = Path(str(destination_parent or "")).expanduser().resolve()
    if not parent.is_dir():
        raise ValueError("Le dossier de destination n'existe pas.")
    name = str(project_name or "").strip()
    if not name or name in {".", ".."} or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._ -]{0,79}", name):
        raise ValueError("Nom de projet invalide. Utilisez 1 à 80 caractères sans séparateurs de chemin.")
    release = latest_marlin_release() if not tag else {**latest_marlin_release(), "tag": str(tag).strip()}
    tag_name = release["tag"]
    target = (parent / name).resolve()
    try:
        target.relative_to(parent)
    except ValueError:
        raise ValueError("Le projet doit rester dans le dossier choisi.")
    if target.exists():
        if any(target.iterdir()):
            raise ValueError(f"Le dossier existe déjà et n'est pas vide : {target}")
    else:
        target.mkdir(parents=True, exist_ok=False)

    STATE.log(f"Création du projet Marlin {tag_name} dans {target}", "info")
    git = shutil.which("git")
    used_git = False
    try:
        if git:
            STATE.log("Git détecté : clonage du tag officiel…", "info")
            clone = subprocess.run(
                [git, "clone", "--depth", "1", "--branch", tag_name, MARLIN_REPO, str(target)],
                cwd=str(parent), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600,
            )
            if clone.returncode == 0 and (target / "platformio.ini").exists():
                used_git = True
            else:
                detail = (clone.stdout + "\n" + clone.stderr).strip()[-2000:]
                STATE.log(f"Clone Git indisponible, repli ZIP : {detail}", "warning")
                for child in list(target.iterdir()):
                    if child.is_dir() and child.name == ".git":
                        shutil.rmtree(child, ignore_errors=True)
                    elif child.is_dir():
                        shutil.rmtree(child, ignore_errors=True)
                    else:
                        child.unlink(missing_ok=True)
        if not used_git:
            zip_url = release.get("zipball_url") or f"https://github.com/MarlinFirmware/Marlin/archive/refs/tags/{tag_name}.zip"
            STATE.log("Téléchargement de l'archive Marlin officielle…", "info")
            with tempfile.TemporaryDirectory(prefix="marlin-download-") as tmp:
                archive = Path(tmp) / "marlin.zip"
                req = urllib.request.Request(zip_url, headers={"User-Agent": "MarlinFlowStudio/1.5.1", "Accept": "application/octet-stream"})
                with urllib.request.urlopen(req, timeout=180) as response, archive.open("wb") as fh:
                    shutil.copyfileobj(response, fh, length=1024 * 1024)
                extract_root = Path(tmp) / "extract"
                extract_root.mkdir()
                _safe_extract_zip(archive, extract_root)
                _copy_extracted_root(extract_root, target)
        if not (target / "platformio.ini").exists():
            raise RuntimeError("Le téléchargement est terminé mais platformio.ini est introuvable.")
        metadata = {
            "project_name": name,
            "marlin_tag": tag_name,
            "source": "GitHub MarlinFirmware/Marlin",
            "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "git_repository": used_git,
        }
        (target / ".marlin-flow.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
        STATE.project_dir = target
        save_persisted_project()
        STATE.log(f"Projet Marlin créé : {target}", "success")
        return {"path": str(target), "marlin": detect_marlin_info(), "platformio_ini": read_ini(), "git": git_status(), "release": release, "git_repository": used_git}
    except Exception:
        if target.exists() and not (target / "platformio.ini").exists():
            shutil.rmtree(target, ignore_errors=True)
        raise


def serial_ports() -> dict:
    if serial is None:
        return {"installed": False, "ports": []}
    ports = []
    for p in serial.tools.list_ports.comports():
        ports.append({
            "device": p.device,
            "description": p.description,
            "manufacturer": p.manufacturer,
            "vid": p.vid,
            "pid": p.pid,
            "serial_number": p.serial_number,
            "location": getattr(p, "location", None),
        })
    return {"installed": True, "ports": ports}


def serial_disconnect() -> None:
    conn = STATE.serial_connection
    STATE.serial_connection = None
    STATE.serial_port = None
    STATE.serial_baud = None
    if conn:
        try:
            conn.close()
        except Exception:
            pass
        STATE.log("Port série déconnecté.", "info")


def _serial_device_is_safe_for_authorization(port: str) -> bool:
    """Allow elevation only for real local serial device nodes."""
    if os.name == "nt":
        return bool(re.fullmatch(r"(?i)COM[0-9]{1,3}", port))
    try:
        resolved = os.path.realpath(port)
    except Exception:
        return False
    return bool(
        re.fullmatch(r"/dev/tty(USB|ACM)[0-9]+", resolved)
        or re.fullmatch(r"/dev/ttyS[0-9]+", resolved)
        or re.fullmatch(r"/dev/ttyAMA[0-9]+", resolved)
    )


def authorize_serial_device(port: str) -> dict:
    """Request OS authorization for one serial device, then return."""
    port = str(port or "").strip()
    if os.name == "nt":
        raise RuntimeError("Windows refuse l'accès au port série. Lancez Marlin Flow Studio en administrateur ou vérifiez le pilote USB.")
    if not _serial_device_is_safe_for_authorization(port):
        raise RuntimeError("Le port demandé n'est pas un périphérique série Linux autorisé.")

    target = os.path.realpath(port)
    # Linux: grant temporary read/write access exactly as requested by the user.
    # Device nodes are recreated by udev after reconnect/reboot, so this is not
    # intended as a persistent permission change. The target is strictly limited
    # by _serial_device_is_safe_for_authorization() above.
    command = f"chmod 666 -- {shlex.quote(target)}"

    pkexec = shutil.which("pkexec")
    if pkexec:
        STATE.log(f"Autorisation système demandée pour {port}…", "warning")
        proc = subprocess.run([pkexec, "/bin/sh", "-c", command], text=True, capture_output=True, timeout=45)
        if proc.returncode == 0:
            STATE.log(f"Autorisation accordée pour {port}.", "success")
            return {"authorized": True, "method": "polkit", "port": port, "persistent": False}
        detail = (proc.stderr or proc.stdout or "").strip()
        if detail:
            STATE.log(f"Polkit : {detail}", "warning")

    sudo = shutil.which("sudo")
    if sudo:
        STATE.log(f"Tentative sudo pour autoriser {port}…", "warning")
        proc = subprocess.run([sudo, "/bin/sh", "-c", command], text=True, capture_output=True, timeout=60)
        if proc.returncode == 0:
            STATE.log(f"Autorisation sudo accordée pour {port}.", "success")
            return {"authorized": True, "method": "sudo", "port": port, "persistent": False}
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError("Autorisation système refusée ou impossible. " + (detail or "Activez Polkit ou autorisez l'accès série à votre utilisateur."))
    raise RuntimeError("Aucun mécanisme d'autorisation (pkexec/sudo) n'est disponible.")


def serial_connect(port: str, baudrate: int = 115200) -> None:
    if serial is None:
        raise RuntimeError("pyserial n'est pas installé dans l'Agent local.")
    port = str(port or "").strip()
    if not port or len(port) > 100:
        raise ValueError("Port série invalide.")
    baudrate = int(baudrate)
    allowed = {9600, 19200, 38400, 57600, 115200, 230400, 250000, 500000, 1000000}
    if baudrate not in allowed:
        raise ValueError(f"Baudrate non autorisé : {baudrate}.")

    serial_disconnect()
    kwargs = {
        "port": port,
        "baudrate": baudrate,
        "timeout": 0.05,
        "write_timeout": 3,
        "rtscts": False,
        "dsrdtr": False,
    }
    # pyserial supports exclusive access on POSIX. It prevents two tools from
    # silently opening the same printer port at the same time.
    if os.name != "nt":
        kwargs["exclusive"] = True
    try:
        conn = serial.Serial(**kwargs)
    except Exception as exc:
        permission_denied = isinstance(exc, PermissionError) or getattr(exc, "errno", None) in (13, 1) or "Permission denied" in str(exc)
        if permission_denied and os.name != "nt":
            try:
                authorize_serial_device(port)
                conn = serial.Serial(**kwargs)
            except Exception as auth_exc:
                raise RuntimeError(f"Accès au port {port} refusé. L'autorisation système n'a pas abouti : {auth_exc}") from auth_exc
        else:
            raise RuntimeError(f"Ouverture du port {port} impossible : {exc}") from exc

    STATE.serial_connection = conn
    STATE.serial_port = port
    STATE.serial_baud = baudrate
    try:
        conn.reset_input_buffer()
        conn.reset_output_buffer()
    except Exception:
        pass
    STATE.log(f"Port série connecté : {port} @ {baudrate}", "success")

    def reader() -> None:
        buffer = bytearray()
        while STATE.serial_connection is conn:
            try:
                chunk = conn.read(4096)
                if not chunk:
                    continue
                buffer.extend(chunk)
                # Marlin normally terminates responses with CR/LF. Keep partial
                # lines until the next read so status messages are not lost.
                while b"\n" in buffer:
                    raw, _, remainder = buffer.partition(b"\n")
                    buffer = bytearray(remainder)
                    text = raw.rstrip(b"\r").decode("utf-8", errors="replace")
                    if text:
                        STATE.log("[SERIAL] " + text, "serial")
                if len(buffer) > 8192:
                    text = bytes(buffer).decode("utf-8", errors="replace")
                    buffer.clear()
                    if text:
                        STATE.log("[SERIAL] " + text, "serial")
            except Exception as exc:
                if STATE.serial_connection is conn:
                    STATE.log(f"Erreur série : {exc}", "error")
                    serial_disconnect()
                break
        if buffer and STATE.serial_connection is not conn:
            text = bytes(buffer).decode("utf-8", errors="replace").strip()
            if text:
                STATE.log("[SERIAL] " + text, "serial")

    threading.Thread(target=reader, daemon=True, name="serial-reader").start()
    # USB CDC boards often reset when the port is opened. Give Marlin time to
    # finish booting, then discard boot noise from the input buffer.
    time.sleep(1.2)
    try:
        conn.reset_input_buffer()
    except Exception:
        pass


def serial_send(command: str) -> None:
    if STATE.serial_connection is None:
        raise RuntimeError("Aucun port série connecté.")
    command = str(command or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not command or len(command) > 10000:
        raise ValueError("Commande série invalide ou trop longue.")
    conn = STATE.serial_connection
    if conn is None:
        raise RuntimeError("Aucun port série connecté.")
    try:
        # Send exactly one command terminated by CRLF, accepted by Marlin's
        # serial command parser and by most Arduino/STM32 USB CDC firmwares.
        payload = (command + "\r\n").encode("utf-8", errors="replace")
        conn.write(payload)
        conn.flush()
    except Exception as exc:
        raise RuntimeError(f"Échec d'envoi série : {exc}") from exc
    STATE.log("[TX] " + command.replace("\n", " | "), "serial")


def serial_send_text(text: str, line_delay_ms: int = 15) -> dict:
    if STATE.serial_connection is None:
        raise RuntimeError("Aucun port série connecté.")
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    if not text.strip():
        raise ValueError("Données série vides.")
    if len(text.encode("utf-8")) > 2 * 1024 * 1024:
        raise ValueError("Bloc série trop volumineux (2 MiB maximum).")
    delay = max(0, min(int(line_delay_ms), 1000)) / 1000.0
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    sent = 0
    for line in lines:
        if line.startswith(";"):
            continue
        serial_send(line)
        sent += 1
        if delay:
            time.sleep(delay)
    return {"lines_sent": sent, "bytes": len(text.encode("utf-8"))}


def stop_process() -> bool:
    with STATE.lock:
        process = STATE.process
        if process is None:
            return False
        try:
            if os.name == "nt":
                process.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                process.terminate()
            STATE.log("Demande d'arrêt envoyée.", "warning")
            return True
        except Exception as exc:
            STATE.log(f"Impossible d'arrêter le processus : {exc}", "error")
            return False


def create_api():
    if Flask is None:
        return None
    app = Flask("marlin-flow-local-agent")

    @app.after_request
    def cors(response):
        origin = request.headers.get("Origin", "")
        allowed = origin in ALLOWED_PROJECT_ORIGINS or any(origin.startswith(prefix) for prefix in LOCAL_ORIGIN_PREFIXES)
        if allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Marlin-Agent-Token"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return response

    @app.before_request
    def authenticate():
        if request.method == "OPTIONS" or request.path == "/api/ping":
            return None
        token = request.headers.get("X-Marlin-Agent-Token", "")
        if not secrets.compare_digest(token, AGENT_TOKEN):
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        return None

    @app.get("/api/ping")
    def ping():
        return jsonify({"success": True, "agent": APP_NAME, "version": AGENT_VERSION})

    @app.get("/api/info")
    def info():
        return jsonify({
            "success": True,
            "agent": APP_NAME,
            "version": AGENT_VERSION,
            "api": f"http://{HOST}:{PORT}",
            "project_dir": str(STATE.project_dir),
            "token_required": True,
        })

    @app.get("/api/status")
    def status():
        return jsonify({
            "success": True,
            "agent": APP_NAME,
            "version": AGENT_VERSION,
            "host": HOST,
            "port": PORT,
            "platformio_installed": pio_installed(),
            "platformio_executable": str(pio_bin()),
            "project_dir": str(STATE.project_dir),
            "platformio_ini": (STATE.project_dir / "platformio.ini").exists(),
            "busy": STATE.process is not None,
            "operation": STATE.operation,
            "operation_started": STATE.operation_started,
            "serial_connected": STATE.serial_connection is not None,
            "serial_port": STATE.serial_port,
            "serial_baud": STATE.serial_baud,
        })

    @app.get("/api/project")
    def project():
        return jsonify({
            "success": True,
            "project": {
                "path": str(STATE.project_dir),
                "platformio_ini": read_ini(),
                "configuration": {f: {"exists": config_path(f).exists(), "sha256": sha256(config_path(f))} for f in CONFIG_FILES},
                "marlin": detect_marlin_info(),
                "git": git_status(),
            },
        })

    @app.post("/api/project/select")
    def project_select():
        payload = request.get_json(silent=True) or {}
        raw = str(payload.get("path", "")).strip()
        try:
            path = Path(raw).expanduser().resolve()
            if not path.is_dir():
                raise ValueError("Le dossier n'existe pas.")
            if not (path / "platformio.ini").exists():
                raise ValueError("Le dossier ne contient pas platformio.ini.")
            STATE.project_dir = path
            save_persisted_project()
            STATE.log(f"Projet local sélectionné : {path}", "success")
            return jsonify({"success": True, "project_dir": str(path), "platformio_ini": read_ini(), "marlin": detect_marlin_info()})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.get("/api/platformio")
    def platformio():
        return jsonify({
            "success": True,
            "installed": pio_installed(),
            "executable": str(pio_bin()),
            "virtualenv": str(VENV_DIR),
            "system": shutil.which("platformio") or shutil.which("pio"),
        })

    @app.get("/api/system/tools")
    def system_tools():
        return jsonify({
            "success": True,
            "python": sys.version.split()[0],
            "git": git_installed(),
            "git_executable": shutil.which("git"),
            "platformio": pio_installed(),
            "node": shutil.which("node"),
            "npm": shutil.which("npm"),
        })

    @app.get("/api/marlin/latest")
    def marlin_latest():
        try:
            return jsonify({"success": True, "release": latest_marlin_release()})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 502

    @app.post("/api/project/create")
    def project_create():
        payload = request.get_json(silent=True) or {}
        try:
            result = create_marlin_project(payload.get("destination"), payload.get("name"), payload.get("tag"))
            return jsonify({"success": True, **result})
        except Exception as exc:
            STATE.log(f"Création du projet impossible : {exc}", "error")
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.get("/api/environments")
    def environments():
        return jsonify({"success": True, **read_ini()})

    @app.post("/api/environments/select")
    def environments_select():
        payload = request.get_json(silent=True) or {}
        try:
            return jsonify({"success": True, **set_default_env(payload.get("environment"))})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.get("/api/build/artifacts")
    def artifacts():
        roots = _artifact_roots()
        return jsonify({
            "success": True,
            "artifacts": build_artifacts(),
            "scanned_roots": [str(x) for x in roots],
            "project_dir": str(STATE.project_dir),
        })

    @app.get("/api/storage/removable")
    def storage_removable():
        return jsonify({"success": True, "drives": removable_mounts()})

    @app.post("/api/build/artifact/save")
    def artifact_save():
        payload = request.get_json(silent=True) or {}
        try:
            result = save_artifact_to_removable(
                payload.get("path", ""),
                payload.get("mount", ""),
                payload.get("filename", ""),
                bool(payload.get("overwrite", False)),
            )
            return jsonify({"success": True, "result": result})
        except FileExistsError as exc:
            return jsonify({"success": False, "error": str(exc), "code": "EXISTS"}), 409
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.get("/api/logs")
    def logs():
        try:
            limit = max(1, min(int(request.args.get("limit", 500)), 2000))
        except Exception:
            limit = 500
        try:
            since = max(0, int(request.args.get("since", 0)))
        except Exception:
            since = 0
        rows = STATE.logs_after(since, limit)
        return jsonify({"success": True, "logs": rows, "latest_id": STATE.log_seq})

    @app.post("/api/platformio/install")
    def install():
        if not install_platformio_async():
            return jsonify({"success": False, "error": "Une opération est déjà en cours ou l'environnement ne peut pas être créé."}), 409
        return jsonify({"success": True})

    def pio_endpoint(target: str | None, operation: str):
        payload = request.get_json(silent=True) or {}
        try:
            ok = execute_pio(pio_args(target, payload), operation)
            if not ok:
                return jsonify({"success": False, "error": "Impossible de démarrer l'opération."}), 409
            return jsonify({"success": True, "operation": operation})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.post("/api/build")
    def build():
        return pio_endpoint(None, "build")

    @app.post("/api/clean")
    def clean():
        return pio_endpoint("clean", "clean")

    @app.post("/api/upload")
    def upload():
        return pio_endpoint("upload", "upload")

    @app.post("/api/build-upload")
    def build_upload():
        return pio_endpoint("upload", "build-upload")

    @app.post("/api/process/stop")
    def process_stop():
        return jsonify({"success": stop_process()})

    @app.post("/api/configuration/migrate")
    def configuration_migrate():
        payload = request.get_json(silent=True) or {}
        try:
            result = migrate_configuration(payload.get("files") or {}, bool(payload.get("dry_run", False)))
            return jsonify({"success": True, **result})
        except Exception as exc:
            STATE.log(f"Migration configuration refusée : {exc}", "error")
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.get("/api/configuration")
    def configuration():
        try:
            filename = request.args.get("file", "Configuration.h")
            return jsonify({"success": True, **read_config(filename)})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.post("/api/configuration/write")
    def configuration_write():
        payload = request.get_json(silent=True) or {}
        try:
            filename = str(payload.get("file", ""))
            path = config_path(filename)
            result = write_text_file(path, str(payload.get("content", "")), payload.get("expected_sha256"))
            STATE.log(f"{filename} écrit sur le disque.", "success")
            return jsonify({"success": True, "filename": filename, **result})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 409 if "changé" in str(exc) else 400

    @app.get("/api/files")
    def files():
        return jsonify({"success": True, "files": list_files()})

    @app.get("/api/file")
    def file_read():
        try:
            path = safe_project_path(request.args.get("path", ""))
            if path.name == ".git":
                raise ValueError("Fichier non autorisé.")
            return jsonify({"success": True, "path": path.relative_to(STATE.project_dir).as_posix(), "content": read_text_file(path), "sha256": sha256(path)})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.post("/api/file/write")
    def file_write():
        payload = request.get_json(silent=True) or {}
        try:
            path = safe_project_path(payload.get("path", ""))
            result = write_text_file(path, payload.get("content", ""), payload.get("expected_sha256"), backup=bool(payload.get("backup", True)))
            STATE.log(f"Fichier écrit : {path.relative_to(STATE.project_dir).as_posix()}", "success")
            return jsonify({"success": True, "path": path.relative_to(STATE.project_dir).as_posix(), **result})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 409 if "changé" in str(exc) else 400

    @app.get("/api/marlin/info")
    def marlin_info():
        return jsonify({"success": True, "marlin": detect_marlin_info()})

    @app.get("/api/doctor")
    def doctor():
        try:
            return jsonify(marlin_doctor())
        except Exception as exc:
            STATE.log(f"Marlin Doctor : {exc}", "error")
            return jsonify({
                "success": False,
                "ready": False,
                "errors": 1,
                "warnings": 0,
                "project": str(STATE.project_dir),
                "checks": [{
                    "key": "doctor_runtime",
                    "label": "Moteur Marlin Doctor",
                    "status": "error",
                    "detail": str(exc),
                    "fix": "Vérifier l'Agent local et relancer l'analyse"
                }],
                "error": str(exc),
            }), 500

    @app.get("/api/git/status")
    def git_status_endpoint():
        return jsonify({"success": True, "git": git_status()})

    @app.post("/api/git/pull")
    def git_pull():
        if not git_pull_async():
            return jsonify({"success": False, "error": "Impossible de démarrer Git Pull."}), 409
        return jsonify({"success": True})

    @app.get("/api/serial/ports")
    def serial_ports_endpoint():
        return jsonify({"success": True, **serial_ports()})

    @app.post("/api/serial/authorize")
    def serial_authorize_endpoint():
        payload = request.get_json(silent=True) or {}
        try:
            result = authorize_serial_device(payload.get("port"))
            return jsonify({"success": True, **result})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 403

    @app.post("/api/serial/connect")
    def serial_connect_endpoint():
        payload = request.get_json(silent=True) or {}
        try:
            serial_connect(payload.get("port"), int(payload.get("baudrate", 115200)))
            return jsonify({"success": True, "port": STATE.serial_port, "baudrate": STATE.serial_baud})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.post("/api/serial/disconnect")
    def serial_disconnect_endpoint():
        serial_disconnect()
        return jsonify({"success": True})

    @app.post("/api/serial/send")
    def serial_send_endpoint():
        try:
            payload = request.get_json(silent=True) or {}
            serial_send(payload.get("command", ""))
            return jsonify({"success": True})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.post("/api/serial/send-text")
    def serial_send_text_endpoint():
        try:
            payload = request.get_json(silent=True) or {}
            result = serial_send_text(payload.get("text", ""), payload.get("line_delay_ms", 15))
            return jsonify({"success": True, **result})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    return app


def main() -> None:
    ensure_dirs()
    STATE.log(f"{APP_NAME} {AGENT_VERSION} démarré.", "success")
    STATE.log(f"Projet : {STATE.project_dir}", "info")
    STATE.log(f"API locale : http://{HOST}:{PORT}", "info")

    if "--headless" in sys.argv:
        if Flask is None:
            raise SystemExit("Flask est requis en mode headless.")
        api = create_api()
        api.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)
        return

    # Compatibility mode: the agent can still run as a console process if started directly.
    if Flask is None:
        raise SystemExit("Flask est requis. Installez requirements-local.txt.")
    api = create_api()
    api.run(host=HOST, port=PORT, debug=False, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
