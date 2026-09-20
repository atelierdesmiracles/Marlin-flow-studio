import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import CommandPalette from "@/components/layout/CommandPalette";
import ConfigurationTree from "@/components/config/ConfigurationTree";
import ParameterList from "@/components/config/ParameterList";
import ParameterEditor from "@/components/config/ParameterEditor";
import CategoryInfo from "@/components/config/CategoryInfo";
import DiffViewer from "@/components/config/DiffViewer";
import HistoryPanel from "@/components/config/HistoryPanel";
import SnapshotsPanel from "@/components/config/SnapshotsPanel";
import Dashboard from "@/components/dashboard/Dashboard";
import CodeEditor from "@/components/tools/CodeEditor";
import Calculators from "@/components/tools/Calculators";
import GCodeBrowser from "@/components/tools/GCodeBrowser";
import FirmwareArtifactDialog from "@/components/local/FirmwareArtifactDialog";
import DocumentationPanel from "@/components/tools/DocumentationPanel";
import LocalBrowser from "@/components/tools/LocalBrowser";
import BootscreenStudio from "@/components/tools/BootscreenStudio";
import SpeakerStudio from "@/components/tools/SpeakerStudio";
import VibrationStudio from "@/components/tools/VibrationStudio";
import MarlinDoctor from "@/components/local/MarlinDoctor";
import ProjectHub from "@/components/projects/ProjectHub";
import MigrationPanel from "@/components/projects/MigrationPanel";
import PrinterConsole from "@/components/local/PrinterConsole";
import AgentBuildCenter from "@/components/local/AgentBuildCenter";
import SettingsPanel from "@/components/tools/SettingsPanel";
import GitPanel from "@/components/tools/GitPanel";
import { useProject, parseProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import { X, Download, FileCode, FileJson, FileArchive } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [view, setView] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const autoRoutedRef = useRef(false);
  const { currentProject, updateProject, exportFile, dispatch } = useProject();

  // On each desktop start / project switch, hydrate the entire UI from the real local project.
  useEffect(() => {
    let disposed = false;
    let syncing = false;
    async function syncLocalProject() {
      if (syncing) return;
      syncing = true;
      try {
        const p = await agentApi.project();
        const meta = p?.project;
        if (!meta?.path || !meta?.platformio_ini?.exists) return;
        const reads = await Promise.all([
          agentApi.readConfiguration("Config.h").catch(() => null),
          agentApi.readConfiguration("Configuration.h").catch(() => null),
          agentApi.readConfiguration("Configuration_adv.h").catch(() => null),
        ]);
        if (disposed) return;
        const minimal = reads[0];
        const h = reads[1];
        const a = reads[2];
        const files = {};
        if (minimal?.content != null) files["Config.h"] = minimal.content;
        if (h?.content != null) files["Configuration.h"] = h.content;
        if (a?.content != null) files["Configuration_adv.h"] = a.content;
        if (!Object.keys(files).length) return;
        const marlin = meta.marlin || {};
        const projectPath = meta.path;
        const folderName = projectPath.split(/[\\/]/).filter(Boolean).pop() || "Projet Marlin local";
        dispatch({
          type: "HYDRATE_LOCAL_PROJECT",
          project: {
            id: `local_${projectPath.replace(/[^A-Za-z0-9]/g, "_").slice(-80)}`,
            name: folderName,
            description: "Projet Marlin chargé depuis le disque local",
            manufacturer: "",
            model: folderName,
            board: marlin.motherboard || "",
            marlinVersion: marlin.version || "inconnue",
            configVersion: "local",
            author: "Marlin Flow Studio",
            tags: ["local"],
            createdDate: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
            files,
            localProjectPath: projectPath,
            localHashes: {
              ...(minimal?.sha256 ? { "Config.h": minimal.sha256 } : {}),
              ...(h?.sha256 ? { "Configuration.h": h.sha256 } : {}),
              ...(a?.sha256 ? { "Configuration_adv.h": a.sha256 } : {}),
            },
          },
        });
      } catch (e) {
        // Local agent may still be starting; the periodic refresh in LocalAgentPanel handles recovery.
      } finally {
        syncing = false;
      }
    }
    syncLocalProject();
    const onAgentReady = () => syncLocalProject();
    window.addEventListener("marlin-agent-ready", onAgentReady);
    window.addEventListener("marlin-project-changed", onAgentReady);
    return () => {
      disposed = true;
      window.removeEventListener("marlin-agent-ready", onAgentReady);
      window.removeEventListener("marlin-project-changed", onAgentReady);
    };
  }, [dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") { e.preventDefault(); setPalette(true); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveToLocalPC(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function saveToLocalPC({ throwOnError = false } = {}) {
    if (!currentProject) return;
    setLocalBusy(true);
    setLocalMessage("");
    try {
      const status = await agentApi.status();
      const nextHashes = { ...(currentProject.localHashes || {}) };
      const parsedNames = Object.keys(currentProject.parsedFiles || {});
      // Marlin >= 2.1.3 uses Config.h as the authoritative configuration and
      // ignores Configuration.h / Configuration_adv.h when Config.h is present.
      // Never write both models at once: doing so makes the UI appear to work
      // while the build silently ignores the edited legacy headers.
      const filesToWrite = parsedNames.includes("Config.h")
        ? ["Config.h"]
        : parsedNames.includes("Configuration.h")
          ? parsedNames.filter((file) => ["Configuration.h", "Configuration_adv.h"].includes(file))
          : [];
      if (!filesToWrite.length) throw new Error("Aucun fichier de configuration Marlin modifiable n'est chargé.");
      const files = Object.fromEntries(filesToWrite.map((file) => [file, exportFile(currentProject.id, file)]));
      const expectedHashes = Object.fromEntries(filesToWrite.filter((file) => nextHashes[file]).map((file) => [file, nextHashes[file]]));
      const result = await agentApi.applyConfiguration(files, expectedHashes);
      for (const item of result.written || []) nextHashes[item.filename] = item.sha256;
      updateProject({ ...currentProject, localProjectPath: status.project_dir, localHashes: nextHashes, updatedDate: new Date().toISOString() });
      setLocalMessage("Configuration enregistrée sur le PC.");
    } catch (e) {
      setLocalMessage(e.message || "Impossible d'enregistrer sur le PC.");
      if (throwOnError) throw e;
    } finally {
      setLocalBusy(false);
      window.setTimeout(() => setLocalMessage(""), 3500);
    }
  }

  async function reloadFromLocalPC() {
    setLocalBusy(true);
    setLocalMessage("");
    try {
      const p = await agentApi.project();
      const [minimal, h, a] = await Promise.all([agentApi.readConfiguration("Config.h").catch(() => null), agentApi.readConfiguration("Configuration.h").catch(() => null), agentApi.readConfiguration("Configuration_adv.h").catch(() => null)]);
      const nextFiles = { ...(currentProject.files || {}) };
      if (minimal?.content != null) nextFiles["Config.h"] = minimal.content;
      if (h?.content != null) nextFiles["Configuration.h"] = h.content;
      if (a?.content != null) nextFiles["Configuration_adv.h"] = a.content;
      const next = parseProject({
        ...currentProject,
        files: nextFiles,
        localProjectPath: p.project?.path || currentProject.localProjectPath || "",
        localHashes: { ...(minimal?.sha256 ? { "Config.h": minimal.sha256 } : {}), ...(h?.sha256 ? { "Configuration.h": h.sha256 } : {}), ...(a?.sha256 ? { "Configuration_adv.h": a.sha256 } : {}) },
        updatedDate: new Date().toISOString(),
      });
      updateProject(next);
      setLocalMessage("Configuration rechargée depuis le PC.");
    } catch (e) {
      setLocalMessage(e.message || "Impossible de relire la configuration locale.");
    } finally {
      setLocalBusy(false);
      window.setTimeout(() => setLocalMessage(""), 3500);
    }
  }

  const modified = currentProject?.allParameters.filter((p) => p.modified).length || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar view={view} setView={setView} collapsed={collapsed} setCollapsed={setCollapsed} modifiedCount={modified} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onCommand={() => setPalette(true)} onExport={() => setExportOpen(true)} onBuild={() => setView("agent-build")} onDoctor={() => setView("doctor")} onSaveLocal={saveToLocalPC} onReloadLocal={reloadFromLocalPC} localBusy={localBusy} />
        <main className="flex-1 min-h-0 overflow-hidden">
          {view === "projects" && <ProjectHub onOpenProject={() => setView("dashboard")} />}
          {view === "dashboard" && <Dashboard setView={setView} onExport={() => setExportOpen(true)} onBuild={() => setView("agent-build")} onImport={() => setView("projects")} />}
          {view === "config" && <ConfigView onApply={saveToLocalPC} localBusy={localBusy} localMessage={localMessage} />}
          {view === "doctor" && <MarlinDoctor />}
          {view === "diff" && <DiffViewer />}
          {view === "history" && <HistoryPanel />}
          {view === "snapshots" && <SnapshotsPanel />}
          {view === "agent-build" && <AgentBuildCenter ensureSaved={saveToLocalPC} />}
          {view === "printer" && <PrinterConsole />}
          {view === "gcode" && <GCodeBrowser />}
          {view === "code" && <CodeEditor />}
          {view === "calculators" && <Calculators />}
          {view === "docs" && <DocumentationPanel />}
          {view === "bootscreen" && <BootscreenStudio />}
          {view === "speaker" && <SpeakerStudio />}
          {view === "vibration" && <VibrationStudio />}
          {view === "migration" && <MigrationPanel />}
          {view === "git" && <GitPanel />}
                    {view === "browser" && <LocalBrowser />}
          {view === "settings" && <SettingsPanel />}
        </main>
      </div>

      {localMessage && (
        <div className={cn("fixed bottom-4 right-4 z-[60] px-4 py-2 rounded-lg shadow-lg border text-sm bg-card", localMessage.toLowerCase().includes("impossible") ? "border-red-500/30 text-red-600" : "border-emerald-500/30 text-emerald-600")}>{localMessage}</div>
      )}

      <CommandPalette open={palette} onClose={() => setPalette(false)} setView={setView} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      
    </div>
  );
}

function ConfigView({ onApply, localBusy, localMessage }) {
  const { state, setSearch, currentProject } = useProject();
  const modified = currentProject?.allParameters?.filter((p) => p.modified).length || 0;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0">
        <div className="text-sm font-semibold">Configurateur Marlin</div>
        <div className="text-xs text-muted-foreground">{currentProject?.parsedFiles?.["Configuration.h"] ? "Configuration.h / Configuration_adv.h" : (currentProject?.parsedFiles?.["Config.h"] ? "Config.h actif" : "Aucune configuration détectée")}</div>
        <div className="text-xs text-muted-foreground">{modified} modification(s) en attente</div>
        <div className="flex-1" />
        {localMessage && <span className="text-xs text-muted-foreground truncate max-w-[360px]">{localMessage}</span>}
        <button onClick={onApply} disabled={localBusy || !currentProject} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">
          {localBusy ? "Écriture…" : "Appliquer au projet"}
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-56 border-r border-border flex flex-col shrink-0 hidden md:flex">
          <div className="p-2 border-b border-border">
            <input
              value={state.searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer les paramètres…"
              className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background outline-none"
            />
          </div>
          <div className="flex-1 overflow-hidden"><ConfigurationTree /></div>
        </div>
        <div className="w-80 border-r border-border shrink-0 hidden lg:flex lg:flex-col">
          <CategoryInfo />
          <div className="flex-1 min-h-0"><ParameterList /></div>
        </div>
        <div className="flex-1 min-w-0"><ParameterEditor /></div>
      </div>
    </div>
  );
}

function ExportModal({ open, onClose }) {
  const { currentProject, exportFile } = useProject();
  if (!open || !currentProject) return null;
  const files = Object.keys(currentProject.parsedFiles);

  function download(name, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportProject() {
    const data = {
      metadata: { name: currentProject.name, model: currentProject.model, board: currentProject.board, marlinVersion: currentProject.marlinVersion, configVersion: currentProject.configVersion, exportedAt: new Date().toISOString() },
      files: Object.fromEntries(files.map((f) => [f, exportFile(currentProject.id, f)])),
    };
    download(`${currentProject.name.replace(/\s+/g, "_")}.mcfproject`, JSON.stringify(data, null, 2), "application/json");
  }

  async function exportReport() {
    let doctor = null;
    try { doctor = await agentApi.doctor(); } catch {}
    const modified = currentProject.allParameters.filter((p) => p.modified);
    const doctorSummary = doctor
      ? `Marlin Doctor: ${doctor.ready ? "READY" : "ACTION REQUIRED"}\nWarnings: ${doctor.warnings ?? "—"}\nErrors: ${doctor.errors ?? "—"}`
      : "Marlin Doctor: Unavailable";
    const doctorChecks = (doctor?.checks || [])
      .map((c) => `[${String(c.status || "").toUpperCase()}] ${c.label}: ${c.detail}${c.fix ? ` | Action: ${c.fix}` : ""}`)
      .join("\n") || "Diagnostic indisponible. Lancez Marlin Doctor depuis l'application.";
    const report = `MARLIN CONFIGURATION REPORT\n==========================\n\nMachine: ${currentProject.model}\nFirmware: Marlin ${currentProject.marlinVersion}\nBoard: ${currentProject.board}\n\nModified: ${modified.length}\n${doctorSummary}\n\n--- Modified parameters ---\n${modified.map((p) => `${p.name} = ${p.type === "flag" ? (p.enabled ? "ON" : "OFF") : p.value} (${p.file})`).join("\n") || "none"}\n\n--- Marlin Doctor ---\n${doctorChecks}\n`;
    download("config_report.txt", report);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md mx-4 bg-popover border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><Download className="w-4 h-4" /> Exporter</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          {files.map((f) => (
            <button key={f} onClick={() => download(f, exportFile(currentProject.id, f))} className="w-full flex items-center gap-3 px-3 py-2.5 rounded border border-border hover:bg-accent text-left">
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">{f}</div>
                <div className="text-xs text-muted-foreground">Fichier C++ Marlin</div>
              </div>
              <Download className="w-3.5 h-3.5" />
            </button>
          ))}
          <button onClick={exportProject} className="w-full flex items-center gap-3 px-3 py-2.5 rounded border border-border hover:bg-accent text-left">
            <FileArchive className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1"><div className="text-sm font-medium">Projet complet (.mcfproject)</div><div className="text-xs text-muted-foreground">JSON avec metadata + fichiers</div></div>
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={exportReport} className="w-full flex items-center gap-3 px-3 py-2.5 rounded border border-border hover:bg-accent text-left">
            <FileJson className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1"><div className="text-sm font-medium">Rapport de configuration</div><div className="text-xs text-muted-foreground">TXT lisible</div></div>
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
