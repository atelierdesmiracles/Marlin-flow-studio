import React, { useRef, useState } from "react";
import { ArrowRightLeft, CheckCircle2, AlertCircle, FileCode2, ShieldCheck, RefreshCw } from "lucide-react";
import { agentApi } from "@/lib/localAgent";
import { useProject, parseProject } from "@/lib/projectStore";
import { parseMarlinFile, renderLine, serializeMarlinFile } from "@/lib/marlinParser";

const SUPPORTED = new Set([".h", ".ini", ".json", ".yml", ".yaml"]);

function sourceDefinitions(sourceFiles) {
  const result = {};
  for (const [fileName, content] of Object.entries(sourceFiles)) {
    const lower = fileName.toLowerCase();
    if (!lower.endsWith(".h")) continue;
    const parsed = parseMarlinFile(content, fileName);
    for (const param of parsed.parameters) {
      if (param.directive === "define" && param.enabled && param.active) result[param.name] = param;
    }
  }
  return result;
}

function browserMigration(project, sourceFiles) {
  const source = sourceDefinitions(sourceFiles);
  const accepted = {};
  const skipped = {};
  const changedFiles = {};

  for (const [name, param] of Object.entries(source)) {
    let targetFile = null;
    let targetParam = null;
    for (const [fileName, parsedFile] of Object.entries(project.parsedFiles || {})) {
      const found = (parsedFile.parameters || []).find((p) => p.name === name && p.directive === "define");
      if (found) {
        targetFile = fileName;
        targetParam = found;
        break;
      }
    }
    if (!targetFile || !targetParam) {
      skipped[name] = param.rawValue || "";
      continue;
    }
    const updated = {
      ...targetParam,
      value: param.value,
      rawValue: param.rawValue,
      type: targetParam.type,
      enabled: true,
      commented: false,
      modified: true,
    };
    updated.rawText = renderLine(updated);
    changedFiles[targetFile] = changedFiles[targetFile] || new Set();
    changedFiles[targetFile].add(targetParam.id);
    accepted[name] = { file: targetFile, line: targetParam.line + 1, value: param.rawValue || "" };
  }

  const files = {};
  for (const [fileName, parsedFile] of Object.entries(project.parsedFiles || {})) {
    const parameters = (parsedFile.parameters || []).map((p) => {
      const a = accepted[p.name];
      if (!a || a.file !== fileName) return p;
      const src = source[p.name];
      const updated = {
        ...p,
        value: src.value,
        rawValue: src.rawValue,
        enabled: true,
        commented: false,
        modified: true,
      };
      updated.rawText = renderLine(updated);
      return updated;
    });
    files[fileName] = serializeMarlinFile(parameters, parsedFile.originalLines, fileName);
  }

  return {
    project: parseProject({ ...project, files, updatedDate: new Date().toISOString() }),
    report: {
      success: true,
      strategy: "browser-merge",
      source_define_count: Object.keys(source).length,
      accepted_count: Object.keys(accepted).length,
      skipped_count: Object.keys(skipped).length,
      accepted,
      skipped,
      written: [],
    },
  };
}

export default function MigrationPanel() {
  const { currentProject, updateProject, takeSnapshot } = useProject();
  const ref = useRef(null);
  const [files, setFiles] = useState({});
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function read(list) {
    setError("");
    const next = {};
    for (const f of list) {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (SUPPORTED.has(ext)) next[f.name] = await f.text();
    }
    setFiles(next);
    setReport(null);
    setMessage("");
  }

  async function ensureAgentProject() {
    if (!currentProject) throw new Error("Aucun projet actif.");
    if (!currentProject.localProjectPath) return false;
    const current = await agentApi.project();
    const activePath = current?.project?.path || "";
    if (activePath !== currentProject.localProjectPath) {
      await agentApi.selectProject(currentProject.localProjectPath);
    }
    return true;
  }

  async function migrate(dryRun) {
    if (!Object.keys(files).length) {
      setError("Sélectionne au moins un fichier de configuration.");
      return;
    }
    if (!currentProject) {
      setError("Ouvre d'abord un projet dans Accueil / Projets.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const hasLocalTarget = await ensureAgentProject();
      if (hasLocalTarget) {
        if (!dryRun) takeSnapshot(currentProject.id, "Avant migration de configuration");
        const result = await agentApi.migrateConfiguration(files, dryRun);
        setReport(result);
        if (!dryRun) {
          setMessage(`Migration terminée : ${result.effective_written_count ?? result.accepted_count ?? 0} paramètre(s) fusionné(s).`);
          window.dispatchEvent(new Event("marlin-project-changed"));
        }
      } else if (dryRun) {
        const result = browserMigration(currentProject, files).report;
        setReport(result);
        setMessage("Analyse locale terminée. Aucun fichier sur disque n'a été modifié.");
      } else {
        takeSnapshot(currentProject.id, "Avant migration de configuration");
        const result = browserMigration(currentProject, files);
        updateProject(result.project);
        setReport(result.report);
        setMessage(`Migration locale terminée : ${result.report.accepted_count} paramètre(s) fusionné(s).`);
      }
    } catch (e) {
      setError(e.message || "Migration impossible");
    } finally {
      setBusy(false);
    }
  }

  const fileNames = Object.keys(files);
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" />Import / Migration</h1>
          <p className="text-sm text-muted-foreground mt-1">Fusionne une ancienne configuration avec le projet actif sans remplacer brutalement son firmware.</p>
        </div>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="w-4 h-4" />Projet cible</div>
          <div className="text-xs text-muted-foreground">
            {currentProject?.name || "Aucun projet"}
            {currentProject?.localProjectPath ? <span className="ml-2 font-mono">{currentProject.localProjectPath}</span> : <span className="ml-2">(projet local navigateur)</span>}
          </div>
          <input ref={ref} type="file" multiple accept=".h,.ini,.json,.yml,.yaml" className="hidden" onChange={(e) => read(Array.from(e.target.files || []))} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => ref.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:bg-accent"><FileCode2 className="w-4 h-4" />Choisir les fichiers</button>
            <button onClick={() => migrate(true)} disabled={busy || !fileNames.length || !currentProject} className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm disabled:opacity-40"><RefreshCw className="w-4 h-4" />{busy ? "Analyse…" : "Analyser"}</button>
            <button onClick={() => migrate(false)} disabled={busy || !fileNames.length || !currentProject} className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-40">{busy ? "Migration…" : "Appliquer la migration"}</button>
          </div>
        </section>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {fileNames.map((n) => <div key={n} className="px-4 py-3 flex items-center gap-2"><FileCode2 className="w-4 h-4" /><span className="font-mono text-sm">{n}</span><span className="text-xs text-muted-foreground ml-auto">{(files[n].length / 1024).toFixed(1)} Ko</span></div>)}
          {!fileNames.length && <div className="p-6 text-center text-sm text-muted-foreground">Aucun fichier importé.</div>}
        </div>

        {error && <div className="flex gap-2 p-3 rounded border border-red-500/30 bg-red-500/5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</div>}
        {message && <div className="flex gap-2 p-3 rounded border border-emerald-500/30 bg-emerald-500/5 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" />{message}</div>}

        {report && <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4" />Rapport de migration</div>
          <div className="grid sm:grid-cols-4 gap-2 mt-3 text-xs">
            <Stat label="Source" value={report.source_define_count ?? 0} />
            <Stat label="Acceptés" value={report.accepted_count ?? 0} />
            <Stat label="Ignorés" value={report.skipped_count ?? 0} />
            <Stat label="Stratégie" value={report.strategy || "—"} />
          </div>
          <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Détails</summary><pre className="mt-3 p-3 rounded bg-muted overflow-auto max-h-96 text-xs whitespace-pre-wrap">{JSON.stringify(report, null, 2)}</pre></details>
        </div>}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="rounded border border-border p-2"><div className="text-muted-foreground">{label}</div><div className="font-semibold mt-1 truncate">{value}</div></div>;
}
