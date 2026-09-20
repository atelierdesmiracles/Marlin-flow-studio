import React, { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import CommandPalette from "@/components/layout/CommandPalette";
import ConfigurationTree from "@/components/config/ConfigurationTree";
import ParameterList from "@/components/config/ParameterList";
import ParameterEditor from "@/components/config/ParameterEditor";
import CategoryInfo from "@/components/config/CategoryInfo";
import DiffViewer from "@/components/config/DiffViewer";
import ValidationPanel from "@/components/config/ValidationPanel";
import HistoryPanel from "@/components/config/HistoryPanel";
import SnapshotsPanel from "@/components/config/SnapshotsPanel";
import Dashboard from "@/components/dashboard/Dashboard";
import CodeEditor from "@/components/tools/CodeEditor";
import Calculators from "@/components/tools/Calculators";
import GCodeBrowser from "@/components/tools/GCodeBrowser";
import FirmwareArtifactDialog from "@/components/local/FirmwareArtifactDialog";
import DocumentationPanel from "@/components/tools/DocumentationPanel";
import LocalAgentPanel from "@/components/local/LocalAgentPanel";
import LocalBrowser from "@/components/tools/LocalBrowser";
import BootscreenStudio from "@/components/tools/BootscreenStudio";
import SpeakerStudio from "@/components/tools/SpeakerStudio";
import VibrationStudio from "@/components/tools/VibrationStudio";
import MarlinDoctor from "@/components/local/MarlinDoctor";
import { useProject, validateProject, parseProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import { X, Download, FileCode, FileJson, FileArchive, Play, Terminal, Cpu, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [view, setView] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const { currentProject, state, setSearch, updateProject, exportFile, dispatch } = useProject();

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
          agentApi.readConfiguration("Configuration.h").catch(() => null),
          agentApi.readConfiguration("Configuration_adv.h").catch(() => null),
        ]);
        if (disposed) return;
        const h = reads[0];
        const a = reads[1];
        const files = {};
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); /* autosaved */ }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function saveToLocalPC() {
    if (!currentProject) return;
    setLocalBusy(true);
    setLocalMessage("");
    try {
      const status = await agentApi.status();
      const nextHashes = { ...(currentProject.localHashes || {}) };
      for (const file of ["Configuration.h", "Configuration_adv.h"]) {
        if (!currentProject.parsedFiles[file]) continue;
        const result = await agentApi.writeConfiguration(file, exportFile(currentProject.id, file), nextHashes[file]);
        nextHashes[file] = result.sha256;
      }
      updateProject({ ...currentProject, localProjectPath: status.project_dir, localHashes: nextHashes, updatedDate: new Date().toISOString() });
      setLocalMessage("Configuration enregistrée sur le PC.");
    } catch (e) {
      setLocalMessage(e.message || "Impossible d'enregistrer sur le PC.");
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
      const [h, a] = await Promise.all([agentApi.readConfiguration("Configuration.h"), agentApi.readConfiguration("Configuration_adv.h")]);
      const next = parseProject({
        ...currentProject,
        files: { ...(currentProject.files || {}), "Configuration.h": h.content, "Configuration_adv.h": a.content },
        localProjectPath: p.project?.path || currentProject.localProjectPath || "",
        localHashes: { "Configuration.h": h.sha256, "Configuration_adv.h": a.sha256 },
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
  const { warnings, errors } = currentProject ? validateProject(currentProject) : { warnings: [], errors: [] };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar view={view} setView={setView} collapsed={collapsed} setCollapsed={setCollapsed} modifiedCount={modified} warningCount={warnings.length} errorCount={errors.length} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onCommand={() => setPalette(true)} onExport={() => setExportOpen(true)} onBuild={() => setBuildOpen(true)} onSaveLocal={saveToLocalPC} onReloadLocal={reloadFromLocalPC} localBusy={localBusy} />
        <main className="flex-1 min-h-0 overflow-hidden">
          {view === "dashboard" && <Dashboard setView={setView} onExport={() => setExportOpen(true)} onBuild={() => setBuildOpen(true)} onImport={() => setView("agent")} />}
          {view === "config" && <ConfigView />}
          {view === "diff" && <DiffViewer />}
          {view === "validation" && <ValidationPanel />}
          {view === "history" && <HistoryPanel />}
          {view === "snapshots" && <SnapshotsPanel />}
          {view === "code" && <CodeEditor />}
          {view === "calculators" && <Calculators />}
          {view === "gcode" && <GCodeBrowser />}
          {view === "docs" && <DocumentationPanel />}
          {view === "agent" && <LocalAgentPanel />}
          {view === "doctor" && <MarlinDoctor />}
          {view === "browser" && <LocalBrowser />}
          {view === "bootscreen" && <BootscreenStudio />}
          {view === "speaker" && <SpeakerStudio />}
          {view === "vibration" && <VibrationStudio />}
        </main>
      </div>

      {localMessage && (
        <div className={cn("fixed bottom-4 right-4 z-[60] px-4 py-2 rounded-lg shadow-lg border text-sm bg-card", localMessage.toLowerCase().includes("impossible") ? "border-red-500/30 text-red-600" : "border-emerald-500/30 text-emerald-600")}>{localMessage}</div>
      )}

      <CommandPalette open={palette} onClose={() => setPalette(false)} setView={setView} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <BuildModal open={buildOpen} onClose={() => setBuildOpen(false)} />
    </div>
  );
}

function ConfigView() {
  const { state, setSearch } = useProject();
  return (
    <div className="flex h-full">
      {/* Left: tree + search */}
      <div className="w-56 border-r border-border flex flex-col shrink-0 hidden md:flex">
        <div className="p-2 border-b border-border">
          <input
            value={state.searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer les paramètres…"
            className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background outline-none"
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ConfigurationTree />
        </div>
      </div>
      {/* Middle: list + contextual section documentation */}
      <div className="w-80 border-r border-border shrink-0 hidden lg:flex lg:flex-col">
        <CategoryInfo />
        <div className="flex-1 min-h-0"><ParameterList /></div>
      </div>
      {/* Right: editor */}
      <div className="flex-1 min-w-0">
        <ParameterEditor />
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

  function exportReport() {
    const { warnings, errors } = validateProject(currentProject);
    const modified = currentProject.allParameters.filter((p) => p.modified);
    const report = `MARLIN CONFIGURATION REPORT\n==========================\n\nMachine: ${currentProject.model}\nFirmware: Marlin ${currentProject.marlinVersion}\nBoard: ${currentProject.board}\n\nModified: ${modified.length}\nWarnings: ${warnings.length}\nErrors: ${errors.length}\n\n--- Modified parameters ---\n${modified.map((p) => `${p.name} = ${p.type === "flag" ? (p.enabled ? "ON" : "OFF") : p.value} (${p.file})`).join("\n")}\n\n--- Warnings ---\n${warnings.map((w) => `[${w.level}] ${w.param}: ${w.message}`).join("\n") || "none"}\n\n--- Errors ---\n${errors.map((e) => `[${e.level}] ${e.param}: ${e.message}`).join("\n") || "none"}\n`;
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

function BuildModal({ open, onClose }) {
  const { currentProject } = useProject();
  const [envs, setEnvs] = useState([]);
  const [envDetails, setEnvDetails] = useState([]);
  const [environment, setEnvironment] = useState("");
  const [logs, setLogs] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setStarted(false);
      setRunning(false);
      setLogs([]);
      setError("");
      setSelectedArtifact(null);
      return;
    }

    let alive = true;

    const tick = async () => {
      try {
        const [environmentResult, logResult, statusResult, artifactResult] = await Promise.all([
          agentApi.environments(),
          agentApi.logs(250),
          agentApi.status(),
          agentApi.buildArtifacts(),
        ]);

        if (!alive) return;

        const availableEnvironments = environmentResult.environments || [];
        setEnvs(availableEnvironments);
        setEnvDetails(environmentResult.environment_details || []);
        setLogs(logResult.logs || []);
        setArtifacts(artifactResult.artifacts || []);
        setRunning(Boolean(statusResult.busy));
        setEnvironment((previous) => previous || availableEnvironments[0] || "");
      } catch (err) {
        if (alive) setError(err?.message || "Agent local non connecté");
      }
    };

    tick();
    const timer = window.setInterval(tick, 1200);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open]);

  async function startBuild() {
    setStarted(true);
    setRunning(true);
    setError("");
    try {
      await agentApi.build(environment || undefined);
    } catch (err) {
      setRunning(false);
      setError(err?.message || "Impossible de lancer la compilation");
    }
  }

  async function stop() {
    try {
      await agentApi.stop();
    } catch (err) {
      setError(err?.message || "Arrêt impossible");
    }
  }

  if (!open) return null;

  const tail = logs.slice(-100);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="w-full max-w-3xl mx-4 bg-popover border border-border rounded-lg p-5"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Play className="w-4 h-4" /> Compilation PlatformIO
            </h2>
            <button type="button" onClick={onClose} aria-label="Fermer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <select
              value={environment}
              onChange={async (event) => {
                const value = event.target.value;
                setEnvironment(value);
                try { await agentApi.selectEnvironment(value); } catch (err) { setError(err?.message || "Impossible de sélectionner l'environnement"); }
              }}
              className="flex-1 px-3 py-2 rounded border border-input bg-background text-sm"
              disabled={running}
            >
              {envs.length ? (
                envs.map((item) => { const d = envDetails.find(x => String(x.name).toLowerCase() === String(item).toLowerCase()); return <option key={item} value={item}>{item}{d?.source ? ` — ${d.source}` : ""}</option>; })
              ) : (
                <option value="">Agent / environnement indisponible</option>
              )}
            </select>

            {!started ? (
              <button
                type="button"
                onClick={startBuild}
                disabled={!envs.length || running}
                className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lancer
              </button>
            ) : (
              <button type="button" onClick={stop} disabled={!running} className="px-3 py-2 rounded border text-sm disabled:opacity-50">
                Arrêter
              </button>
            )}
          </div>

          {error && (
            <div className="mb-3 p-2.5 rounded bg-red-500/10 text-red-600 text-xs">
              {error}
            </div>
          )}

          <div className="h-[320px] overflow-auto p-3 rounded bg-slate-950 text-slate-200 font-mono text-[11px]">
            {tail.length ? (
              tail.map((line, index) => (
                <div
                  key={`${line.timestamp || "log"}-${index}`}
                  className={cn(
                    line.level === "error" && "text-red-400",
                    line.level === "warning" && "text-amber-300",
                    line.level === "success" && "text-emerald-300",
                    line.level === "command" && "text-cyan-300",
                  )}
                >
                  <span className="text-slate-500 mr-2">{line.timestamp}</span>
                  {line.message}
                </div>
              ))
            ) : (
              <div className="text-slate-500">Aucun log pour le moment.</div>
            )}
          </div>

          {artifacts.length > 0 && (
            <div className="mt-3 rounded border border-border bg-muted/20 p-3">
              <div className="text-xs font-semibold mb-2">Firmware détecté</div>
              {artifacts.slice(0, 10).map((artifact) => (
                <button
                  type="button"
                  key={artifact.path}
                  onClick={() => setSelectedArtifact(artifact)}
                  className="w-full text-left text-[11px] font-mono flex justify-between gap-3 rounded px-2 py-1.5 hover:bg-muted"
                >
                  <span className="truncate">{artifact.path}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {(artifact.size / 1024).toFixed(1)} Ko · Enregistrer
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 text-xs text-muted-foreground flex justify-between">
            <span>{currentProject?.name || "Projet actuel"}</span>
            <span>{running ? "Compilation en cours…" : started ? "Terminé / arrêté" : "Prêt"}</span>
          </div>
        </div>
      </div>

      <FirmwareArtifactDialog
        open={Boolean(selectedArtifact)}
        artifact={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
      />
    </>
  );
}
