#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Marlin Flow Studio desktop shell — local-first project launcher."""
from __future__ import annotations

import json
import os
import platform
import shutil
import shlex
import subprocess
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

from PySide6.QtCore import QThread, QUrl, Qt, Signal
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (
    QApplication, QCheckBox, QDialog, QFileDialog, QFormLayout, QGroupBox,
    QHBoxLayout, QLabel, QLineEdit, QMainWindow, QMessageBox, QPushButton,
    QTabWidget, QToolBar, QVBoxLayout, QWidget, QProgressBar,
)
from PySide6.QtWebEngineCore import QWebEngineProfile
from PySide6.QtWebEngineWidgets import QWebEngineView

APP_DIR = Path(__file__).resolve().parent.parent if not getattr(sys, "frozen", False) else Path(sys.executable).resolve().parent
DIST = APP_DIR / "dist"
AGENT = "http://127.0.0.1:38765"
BROWSER_PROFILE = APP_DIR / ".marlin-agent" / "browser-profile"
DOWNLOADS = APP_DIR / "Downloads"
SETTINGS_FILE = APP_DIR / ".marlin-agent" / "desktop-settings.json"
WINDOW_TITLE = "Marlin Flow Studio — Local 1.5.1"


class StaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, *_args):
        pass


class BrowserView(QWebEngineView):
    def __init__(self, profile: QWebEngineProfile, parent=None):
        super().__init__(profile, parent)


class BrowserTab(QWidget):
    def __init__(self, profile: QWebEngineProfile, start_url: str, parent=None):
        super().__init__(parent)
        self.start_url = start_url
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        nav = QHBoxLayout()
        nav.setContentsMargins(6, 6, 6, 6)
        self.back = QPushButton("◀")
        self.forward = QPushButton("▶")
        self.reload = QPushButton("↻")
        self.home = QPushButton("⌂")
        self.address = QLineEdit(start_url)
        self.address.setClearButtonEnabled(True)
        self.go = QPushButton("Aller")
        self.external = QPushButton("↗")
        for w in (self.back, self.forward, self.reload, self.home, self.address, self.go, self.external):
            nav.addWidget(w)
        layout.addLayout(nav)
        quick = QHBoxLayout()
        quick.setContentsMargins(6, 0, 6, 6)
        for name, url in (
            ("Marlin", "https://marlinfw.org/"),
            ("GitHub", "https://github.com/MarlinFirmware/Marlin"),
            ("PlatformIO", "https://docs.platformio.org/"),
        ):
            b = QPushButton(name)
            b.clicked.connect(lambda _checked=False, u=url: self.load(u))
            quick.addWidget(b)
        quick.addStretch(1)
        self.security = QLabel("● HTTPS")
        quick.addWidget(self.security)
        layout.addLayout(quick)
        self.web = BrowserView(profile, self)
        self.web.urlChanged.connect(self._on_url_changed)
        self.web.loadStarted.connect(lambda: self.security.setText("● Chargement…"))
        self.web.loadFinished.connect(lambda ok: self.security.setText("● HTTPS" if self.web.url().scheme() == "https" and ok else ("● HTTP" if ok else "● Échec")))
        self.back.clicked.connect(self.web.back)
        self.forward.clicked.connect(self.web.forward)
        self.reload.clicked.connect(self.web.reload)
        self.home.clicked.connect(lambda: self.load(self.start_url))
        self.go.clicked.connect(lambda: self.load(self.address.text()))
        self.address.returnPressed.connect(lambda: self.load(self.address.text()))
        self.external.clicked.connect(lambda: webbrowser.open(self.address.text().strip()))
        layout.addWidget(self.web, 1)
        self.load(start_url)

    def _on_url_changed(self, url: QUrl):
        self.address.setText(url.toString())

    def load(self, raw_url: str):
        value = str(raw_url or "").strip()
        if not value:
            return
        if not value.startswith(("http://", "https://")):
            value = "https://" + value
        self.address.setText(value)
        self.web.load(QUrl(value))


class StudioTab(QWidget):
    def __init__(self, profile: QWebEngineProfile, url: str, token: str, parent=None):
        super().__init__(parent)
        self.token = token
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.web = BrowserView(profile, self)
        self.web.loadFinished.connect(lambda _ok: self.inject_local_context())
        self.web.urlChanged.connect(lambda _url: self.inject_local_context())
        layout.addWidget(self.web)
        self.web.load(QUrl(url))

    def inject_local_context(self):
        token = self.token
        if not token:
            return
        script = (
            "localStorage.setItem('marlin_agent_token', " + json.dumps(token) + ");"
            "localStorage.setItem('marlin_agent_url', " + json.dumps(AGENT) + ");"
            "window.dispatchEvent(new Event('marlin-agent-ready'));"
        )
        self.web.page().runJavaScript(script)


class AgentTab(QWidget):
    def __init__(self, desktop: "MainWindow", parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        title = QLabel("MARLIN FLOW — AGENT LOCAL")
        title.setStyleSheet("font-size:22px;font-weight:700;")
        layout.addWidget(title)
        self.status = QLabel("Vérification…")
        layout.addWidget(self.status)
        self.project = QLabel("Projet : —")
        self.project.setWordWrap(True)
        layout.addWidget(self.project)
        row = QHBoxLayout()
        for label, callback in (("Choisir / changer de projet…", desktop.choose_project), ("Ouvrir dossier", desktop.open_project), ("Assistant démarrage", desktop.show_startup_wizard)):
            button = QPushButton(label)
            button.clicked.connect(callback)
            row.addWidget(button)
        row.addStretch(1)
        layout.addLayout(row)
        layout.addStretch(1)
        self.refresh_timer = QTimerCompat(self)
        self.refresh_timer.timeout.connect(self.refresh)
        self.refresh_timer.start(2000)
        self.refresh()

    def refresh(self):
        try:
            with urlopen(AGENT + "/api/status", timeout=1.5) as response:
                data = json.loads(response.read().decode("utf-8"))
            self.status.setText(f"● CONNECTÉ — PlatformIO: {'OK' if data.get('platformio_installed') else 'à installer'}")
            self.status.setStyleSheet("color:#128a45;font-weight:700;")
            self.project.setText(f"Projet : {data.get('project_dir') or 'aucun'}")
        except Exception as exc:
            self.status.setText(f"● DÉCONNECTÉ — {exc}")
            self.status.setStyleSheet("color:#b42318;font-weight:700;")


# Tiny compatibility wrapper so the file remains explicit about Qt timers.
from PySide6.QtCore import QTimer
class QTimerCompat(QTimer):
    pass


class ApiWorker(QThread):
    succeeded = Signal(object)
    failed = Signal(str)

    def __init__(self, fn, parent=None):
        super().__init__(parent)
        self.fn = fn

    def run(self):
        try:
            self.succeeded.emit(self.fn())
        except Exception as exc:
            self.failed.emit(str(exc))


def read_settings() -> dict:
    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8")) if SETTINGS_FILE.exists() else {}
    except Exception:
        return {}


def write_settings(data: dict) -> None:
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = SETTINGS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(SETTINGS_FILE)


def agent_token() -> str:
    try:
        return (APP_DIR / ".marlin-agent" / "token").read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def agent_json(path: str, method="GET", body=None, timeout=10):
    headers = {"Accept": "application/json", "X-Marlin-Agent-Token": agent_token()}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(AGENT + path, method=method, headers=headers, data=data)
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def is_git_installed() -> bool:
    return shutil.which("git") is not None


def git_install_plan() -> tuple[str | None, list[str] | None]:
    system = platform.system().lower()
    if system == "windows":
        return "winget", ["winget", "install", "--id", "Git.Git", "-e", "--source", "winget", "--accept-package-agreements", "--accept-source-agreements"]
    if system == "darwin":
        if shutil.which("brew"):
            return "brew", ["brew", "install", "git"]
        return None, None
    # Prefer the user's distro package manager. CachyOS / Arch comes first.
    if shutil.which("pacman"):
        return "pacman", ["sudo", "pacman", "-S", "--needed", "git"]
    if shutil.which("apt-get"):
        return "apt", ["sudo", "apt-get", "install", "-y", "git"]
    if shutil.which("dnf"):
        return "dnf", ["sudo", "dnf", "install", "-y", "git"]
    if shutil.which("zypper"):
        return "zypper", ["sudo", "zypper", "--non-interactive", "install", "git"]
    return None, None


def launch_terminal_command(argv: list[str]) -> None:
    if os.name == "nt":
        command = subprocess.list2cmdline(argv)
        subprocess.Popen(["cmd", "/c", "start", "cmd", "/k", command], creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
        return
    if sys.platform == "darwin":
        if shutil.which("osascript"):
            cmd = shlex.join(argv).replace('"', '\\"')
            subprocess.Popen(["osascript", "-e", f'tell application "Terminal" to do script "{cmd}"'])
            return
        raise RuntimeError("Impossible d'ouvrir Terminal automatiquement.")
    command = shlex.join(argv)
    terminals = [
        ("x-terminal-emulator", ["x-terminal-emulator", "-e", "bash", "-lc", command + "; echo; read -p 'Entrée pour fermer…'"]),
        ("konsole", ["konsole", "-e", "bash", "-lc", command + "; echo; read -p 'Entrée pour fermer…'"]),
        ("xfce4-terminal", ["xfce4-terminal", "--hold", "-e", "bash -lc '" + command + "; echo; read -p \"Entrée pour fermer…\"'"]),
        ("gnome-terminal", ["gnome-terminal", "--", "bash", "-lc", command + "; echo; read -p 'Entrée pour fermer…'"]),
    ]
    for exe, args in terminals:
        if shutil.which(exe):
            subprocess.Popen(args)
            return
    raise RuntimeError(f"Aucun terminal graphique trouvé. Exécutez : {command}")


class StartupWizard(QDialog):
    def __init__(self, desktop: "MainWindow", parent=None):
        super().__init__(parent)
        self.desktop = desktop
        self.setWindowTitle("Marlin Flow Studio — Démarrage")
        self.setModal(True)
        self.resize(760, 620)
        self.worker = None
        self.poll = QTimerCompat(self)
        self.poll.timeout.connect(self.refresh_status)
        self.poll.start(2500)

        root = QVBoxLayout(self)
        title = QLabel("Bienvenue dans Marlin Flow Studio")
        title.setStyleSheet("font-size:25px;font-weight:700;")
        root.addWidget(title)
        subtitle = QLabel("Tout fonctionne localement. Préparez les outils, créez un projet Marlin ou ouvrez un projet existant.")
        subtitle.setStyleSheet("color:#667085;")
        root.addWidget(subtitle)

        tools = QGroupBox("1. Outils locaux")
        tools_layout = QVBoxLayout(tools)
        self.pio_label, self.pio_button = self.tool_row(tools_layout, "PlatformIO Core")
        self.git_label, self.git_button = self.tool_row(tools_layout, "Git")
        root.addWidget(tools)

        current = QGroupBox("2. Projet actuel")
        current_layout = QVBoxLayout(current)
        self.current_label = QLabel("Aucun projet local sélectionné.")
        self.current_label.setWordWrap(True)
        current_layout.addWidget(self.current_label)
        root.addWidget(current)

        actions = QGroupBox("3. Démarrer")
        grid = QVBoxLayout(actions)
        self.new_btn = QPushButton("🆕  Créer un nouveau projet Marlin")
        self.new_btn.setMinimumHeight(44)
        self.open_btn = QPushButton("📂  Ouvrir un projet déjà créé")
        self.open_btn.setMinimumHeight(44)
        self.resume_btn = QPushButton("▶  Reprendre le projet actuel")
        self.resume_btn.setMinimumHeight(38)
        self.continue_btn = QPushButton("Continuer sans projet")
        self.new_btn.clicked.connect(self.new_project_form)
        self.open_btn.clicked.connect(self.open_project)
        self.resume_btn.clicked.connect(self.resume_project)
        self.continue_btn.clicked.connect(self.accept)
        for b in (self.new_btn, self.open_btn, self.resume_btn, self.continue_btn):
            grid.addWidget(b)
        root.addWidget(actions)

        bottom = QHBoxLayout()
        self.auto = QCheckBox("Afficher cet assistant au prochain démarrage")
        self.auto.setChecked(bool(read_settings().get("show_startup_wizard", True)))
        bottom.addWidget(self.auto)
        bottom.addStretch(1)
        root.addLayout(bottom)
        self.refresh_status()

    def tool_row(self, layout, name):
        row = QHBoxLayout()
        label = QLabel(f"{name} : vérification…")
        label.setMinimumWidth(280)
        button = QPushButton("Installer")
        button.clicked.connect(lambda _=False, n=name: self.install_tool(n))
        row.addWidget(label, 1)
        row.addWidget(button)
        layout.addLayout(row)
        return label, button

    def refresh_status(self):
        try:
            status = agent_json("/api/status", timeout=2)
            installed = bool(status.get("platformio_installed"))
            self.pio_label.setText("PlatformIO Core : ✅ installé" if installed else "PlatformIO Core : ❌ non installé")
            self.pio_button.setText("Réinstaller / réparer" if installed else "Installer")
            self.pio_button.setEnabled(not bool(status.get("busy")))
            project = status.get("project_dir") or ""
            has_project = bool(project and (Path(project) / "platformio.ini").exists())
            self.current_label.setText(project if has_project else "Aucun projet PlatformIO sélectionné.")
        except Exception as exc:
            self.pio_label.setText(f"PlatformIO Core : ⚠ agent indisponible ({exc})")
            self.pio_button.setEnabled(False)
        git_ok = is_git_installed()
        self.git_label.setText("Git : ✅ installé" if git_ok else "Git : ❌ non installé")
        self.git_button.setText("Réinstaller / réparer" if git_ok else "Installer")

    def install_tool(self, name):
        if name == "PlatformIO Core":
            try:
                agent_json("/api/platformio/install", method="POST", body={}, timeout=5)
                self.pio_button.setEnabled(False)
                self.pio_label.setText("PlatformIO Core : installation en cours…")
            except Exception as exc:
                QMessageBox.warning(self, "PlatformIO", str(exc))
            return
        if name == "Git":
            _, argv = git_install_plan()
            if not argv:
                QMessageBox.warning(self, "Git", "Aucun installateur automatique trouvé. Installez Git avec le gestionnaire de paquets de votre système.")
                return
            try:
                launch_terminal_command(argv)
                self.git_label.setText("Git : installation lancée dans le terminal…")
            except Exception as exc:
                QMessageBox.warning(self, "Git", str(exc))

    def new_project_form(self):
        dialog = QDialog(self)
        dialog.setWindowTitle("Nouveau projet Marlin")
        dialog.resize(620, 300)
        root = QVBoxLayout(dialog)
        form = QFormLayout()
        name = QLineEdit("Marlin-Project")
        destination = QLineEdit(str(Path.home() / "MarlinProjects"))
        browse = QPushButton("Parcourir…")
        row = QHBoxLayout(); row.addWidget(destination); row.addWidget(browse)
        latest = QLabel("Recherche de la dernière version stable…")
        latest.setStyleSheet("font-weight:600;")
        form.addRow("Nom du projet", name)
        form.addRow("Dossier de destination", row)
        form.addRow("Version Marlin", latest)
        root.addLayout(form)
        note = QLabel("Le programme télécharge la dernière release stable officielle de Marlin. Git est utilisé pour cloner la release lorsqu'il est installé ; sinon l'archive officielle GitHub est utilisée.")
        note.setWordWrap(True)
        note.setStyleSheet("color:#667085;font-size:11px;")
        root.addWidget(note)
        progress = QProgressBar(); progress.setRange(0, 0); progress.hide(); root.addWidget(progress)
        status = QLabel(""); status.setWordWrap(True); root.addWidget(status)
        buttons = QHBoxLayout(); cancel = QPushButton("Annuler"); create = QPushButton("Créer le projet"); buttons.addStretch(1); buttons.addWidget(cancel); buttons.addWidget(create); root.addLayout(buttons)
        browse.clicked.connect(lambda: self.pick_folder(destination))
        cancel.clicked.connect(dialog.reject)

        def load_latest():
            try:
                data = agent_json("/api/marlin/latest", timeout=15)
                release = data.get("release", {})
                latest.setText(f"{release.get('name') or release.get('tag')}  —  tag {release.get('tag')}")
                latest.setProperty("tag", release.get("tag"))
            except Exception as exc:
                latest.setText(f"Impossible de récupérer la version : {exc}")
        load_latest()

        def create_project():
            proj_name = name.text().strip()
            dest = destination.text().strip()
            tag = latest.property("tag")
            if not proj_name or not dest:
                status.setText("Nom et dossier de destination obligatoires.")
                return
            progress.show(); create.setEnabled(False); cancel.setEnabled(False); status.setText("Téléchargement de Marlin en cours…")
            def fn():
                return agent_json("/api/project/create", method="POST", body={"destination": dest, "name": proj_name, "tag": tag}, timeout=660)
            self.worker = ApiWorker(fn, dialog)
            self.worker.succeeded.connect(lambda result: on_created(result))
            self.worker.failed.connect(lambda message: on_failed(message))
            self.worker.start()

        def on_created(result):
            path = result.get("path") or result.get("project_dir")
            dialog.accept()
            self.desktop.activate_project(path)
            self.refresh_status()
            self.accept()

        def on_failed(message):
            progress.hide(); create.setEnabled(True); cancel.setEnabled(True); status.setText(f"Erreur : {message}")

        create.clicked.connect(create_project)
        dialog.exec()

    def pick_folder(self, line_edit):
        folder = QFileDialog.getExistingDirectory(self, "Choisir le dossier de destination", line_edit.text())
        if folder:
            line_edit.setText(folder)

    def open_project(self):
        folder = QFileDialog.getExistingDirectory(self, "Ouvrir un projet Marlin / PlatformIO")
        if not folder:
            return
        try:
            self.desktop.activate_project(folder)
            self.accept()
        except Exception as exc:
            QMessageBox.warning(self, "Projet", str(exc))

    def resume_project(self):
        try:
            data = agent_json("/api/project", timeout=5)
            path = data.get("project", {}).get("path")
            if not path or not (Path(path) / "platformio.ini").exists():
                raise RuntimeError("Aucun projet local valide à reprendre.")
            self.desktop.activate_project(path)
            self.accept()
        except Exception as exc:
            QMessageBox.warning(self, "Projet actuel", str(exc))

    def closeEvent(self, event):
        write_settings({**read_settings(), "show_startup_wizard": self.auto.isChecked()})
        super().closeEvent(event)

    def accept(self):
        write_settings({**read_settings(), "show_startup_wizard": self.auto.isChecked()})
        super().accept()

    def reject(self):
        write_settings({**read_settings(), "show_startup_wizard": self.auto.isChecked()})
        super().reject()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(WINDOW_TITLE)
        self.resize(1600, 1000)
        self.setMinimumSize(1100, 700)
        self.server = None
        self.local_url = None
        self.agent_module = None
        self.profile = None
        self.start_agent()
        self.start_static_server()
        self.create_profile()
        self.build_ui()
        self.refresh_studio_context()
        QTimerCompat.singleShot(250, self.show_startup_if_needed)

    def create_profile(self):
        BROWSER_PROFILE.mkdir(parents=True, exist_ok=True)
        DOWNLOADS.mkdir(parents=True, exist_ok=True)
        self.profile = QWebEngineProfile("MarlinFlowBrowser", self)
        self.profile.setPersistentStoragePath(str(BROWSER_PROFILE))
        self.profile.setCachePath(str(BROWSER_PROFILE / "cache"))
        self.profile.setDownloadPath(str(DOWNLOADS))
        self.profile.downloadRequested.connect(self.handle_download)

    def handle_download(self, item):
        try:
            item.setDownloadDirectory(str(DOWNLOADS)); item.accept()
            self.statusBar().showMessage(f"Téléchargement : {item.downloadFileName()}")
        except Exception as exc:
            self.statusBar().showMessage(f"Téléchargement impossible : {exc}")

    def start_agent(self):
        try:
            os.environ["MARLIN_AGENT_ROOT"] = str(APP_DIR)
            sys.path.insert(0, str(APP_DIR))
            import MarlinLocalAgent as agent
            self.agent_module = agent
            if not agent.Flask:
                raise RuntimeError("Flask n'est pas installé")
            api = agent.create_api()
            threading.Thread(target=lambda: api.run(host=agent.HOST, port=agent.PORT, debug=False, use_reloader=False, threaded=True), daemon=True, name="marlin-agent-api").start()
        except Exception as exc:
            self.statusBar().showMessage(f"Agent local indisponible : {exc}")

    def start_static_server(self):
        if not (DIST / "index.html").exists():
            self.statusBar().showMessage("dist/index.html absent : exécutez npm install puis npm run build.")
            return
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), StaticHandler)
        threading.Thread(target=self.server.serve_forever, daemon=True, name="marlin-static-server").start()
        self.local_url = f"http://127.0.0.1:{self.server.server_port}/index.html"

    def build_ui(self):
        root = QWidget(); outer = QVBoxLayout(root); outer.setContentsMargins(0, 0, 0, 0); outer.setSpacing(0)
        toolbar = QToolBar("Marlin Flow"); toolbar.setMovable(False); toolbar.setFloatable(False); self.addToolBar(toolbar)
        studio_action = QAction("⚙ Studio", self); browser_action = QAction("🌐 Navigateur", self); agent_action = QAction("● Agent", self); new_browser_action = QAction("＋ Navigateur", self); startup_action = QAction("🚀 Démarrage", self); project_action = QAction("📁 Projet…", self); folder_action = QAction("Ouvrir dossier", self)
        for action in (studio_action, browser_action, agent_action, new_browser_action, startup_action): toolbar.addAction(action)
        toolbar.addSeparator(); toolbar.addAction(project_action); toolbar.addAction(folder_action)
        self.tabs = QTabWidget(); self.tabs.setTabsClosable(True); self.tabs.tabCloseRequested.connect(self.close_tab)
        studio_url = self.local_url or "http://127.0.0.1:5173/"
        self.studio = StudioTab(self.profile, studio_url, agent_token())
        self.browser = BrowserTab(self.profile, "https://marlinfw.org/")
        self.agent_view = AgentTab(self)
        self.tabs.addTab(self.studio, "Studio local"); self.tabs.addTab(self.browser, "Navigateur"); self.tabs.addTab(self.agent_view, "Agent local")
        outer.addWidget(self.tabs)
        studio_action.triggered.connect(lambda: self.tabs.setCurrentIndex(0)); browser_action.triggered.connect(lambda: self.tabs.setCurrentIndex(1)); agent_action.triggered.connect(lambda: self.tabs.setCurrentIndex(2)); new_browser_action.triggered.connect(self.add_browser_tab); startup_action.triggered.connect(self.show_startup_wizard); project_action.triggered.connect(self.choose_project); folder_action.triggered.connect(self.open_project)
        self.setCentralWidget(root); self.statusBar().showMessage("Marlin Flow Studio prêt")

    def refresh_studio_context(self):
        if not hasattr(self, "studio"):
            return
        try:
            data = agent_json("/api/project", timeout=3)
            path = data.get("project", {}).get("path") or ""
        except Exception:
            path = ""
        token = agent_token(); self.studio.token = token
        script = (
            "localStorage.setItem('marlin_agent_token', " + json.dumps(token) + ");"
            "localStorage.setItem('marlin_agent_url', " + json.dumps(AGENT) + ");"
            "localStorage.setItem('marlin_local_project_path', " + json.dumps(path) + ");"
            "window.dispatchEvent(new Event('marlin-project-changed'));"
        )
        self.studio.web.page().runJavaScript(script)

    def add_browser_tab(self):
        tab = BrowserTab(self.profile, "https://marlinfw.org/"); index = self.tabs.addTab(tab, "Nouvel onglet"); self.tabs.setCurrentIndex(index); tab.web.titleChanged.connect(lambda title, t=tab: self.rename_tab(t, title))

    def rename_tab(self, widget, title):
        index = self.tabs.indexOf(widget)
        if index >= 0: self.tabs.setTabText(index, (title or "Navigateur")[:30])

    def close_tab(self, index: int):
        if index < 3: return
        widget = self.tabs.widget(index); self.tabs.removeTab(index); widget.deleteLater()

    def activate_project(self, folder: str):
        path = Path(folder).expanduser().resolve()
        if not path.is_dir(): raise RuntimeError("Le dossier n'existe pas.")
        if not (path / "platformio.ini").exists(): raise RuntimeError("Le dossier sélectionné ne contient pas platformio.ini.")
        result = agent_json("/api/project/select", method="POST", body={"path": str(path)}, timeout=5)
        if not result.get("success"): raise RuntimeError(result.get("error", "Projet invalide"))
        self.setWindowTitle(f"Marlin Flow Studio — {path.name}")
        self.statusBar().showMessage(f"Projet actif : {path}")
        self.refresh_studio_context()
        self.studio.web.reload()
        self.agent_view.refresh()

    def choose_project(self):
        folder = QFileDialog.getExistingDirectory(self, "Choisir un projet PlatformIO")
        if folder: self.activate_project(folder)

    def open_project(self):
        try:
            data = agent_json("/api/project", timeout=3); project = Path(data.get("project", {}).get("path") or APP_DIR)
            if os.name == "nt": os.startfile(str(project))
            elif sys.platform == "darwin": subprocess.Popen(["open", str(project)])
            else: subprocess.Popen(["xdg-open", str(project)])
        except Exception as exc: self.show_message(str(exc))

    def show_startup_wizard(self):
        StartupWizard(self, self).exec()
        self.refresh_studio_context(); self.studio.web.reload(); self.agent_view.refresh()

    def show_startup_if_needed(self):
        settings = read_settings()
        if settings.get("show_startup_wizard", True): self.show_startup_wizard()

    def show_message(self, message: str): QMessageBox.warning(self, "Marlin Flow Studio", message)

    def closeEvent(self, event):
        try:
            self.agent_module.serial_disconnect() if self.agent_module else None
        except Exception: pass
        if self.server: self.server.shutdown()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Marlin Flow Studio")
    window = MainWindow(); window.show()
    sys.exit(app.exec())


if __name__ == "__main__": main()
