import React, { useEffect, useMemo, useState } from "react";
import { Search, Play, Download, GitBranch, AlertTriangle, XCircle, HardDrive, RefreshCw, Circle } from "lucide-react";
import { useProject, validateProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import { cn } from "@/lib/utils";

export default function TopBar({ onCommand, onExport, onBuild, onSaveLocal, onReloadLocal, localBusy }) {
  const { currentProject } = useProject();
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const status = await agentApi.status();
        if (!alive) return;
        setAgentConnected(true);
        setAgentStatus(status);
      } catch {
        if (!alive) return;
        setAgentConnected(false);
        setAgentStatus(null);
      }
    }
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const modified = currentProject?.allParameters.filter((p) => p.modified).length || 0;
  const validation = useMemo(() => (currentProject ? validateProject(currentProject) : { warnings: [], errors: [] }), [currentProject]);
  const warnings = validation.warnings.length;
  const errors = validation.errors.length;

  return (
    <header className="h-12 flex items-center gap-2 px-3 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2 min-w-0 mr-1">
        <span className="text-sm font-medium truncate">{currentProject?.name || "Aucun projet"}</span>
        {currentProject && <span className="text-xs text-muted-foreground hidden md:inline truncate">{currentProject.model || "—"}</span>}
        {currentProject && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden md:inline">{currentProject.marlinVersion}</span>}
      </div>

      <button onClick={onCommand} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted min-w-[170px] md:min-w-[240px]">
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Rechercher, paramètres, G-code…</span>
        <kbd className="text-[10px] px-1 py-0.5 rounded border border-border bg-background">⌘K</kbd>
      </button>

      <div className="flex-1" />

      <div className={cn("hidden xl:flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border", agentConnected ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/5" : "border-red-500/20 text-red-600 bg-red-500/5")} title={agentStatus?.project_dir || "Agent local non connecté"}>
        <Circle className={cn("w-2.5 h-2.5 fill-current", agentConnected ? "text-emerald-500" : "text-red-500")} />
        {agentConnected ? (agentStatus?.busy ? "Agent · occupé" : "Agent · connecté") : "Agent · hors ligne"}
      </div>

      <div className="hidden lg:flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground"><GitBranch className="w-3.5 h-3.5" /> {currentProject?.marlinVersion || "—"}</span>
        <span className={cn("flex items-center gap-1", modified > 0 ? "text-blue-500" : "text-muted-foreground")}>● {modified}</span>
        <span className={cn("flex items-center gap-1", warnings > 0 ? "text-amber-500" : "text-muted-foreground")}><AlertTriangle className="w-3.5 h-3.5" />{warnings}</span>
        <span className={cn("flex items-center gap-1", errors > 0 ? "text-red-500" : "text-muted-foreground")}><XCircle className="w-3.5 h-3.5" />{errors}</span>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={onReloadLocal} disabled={localBusy || !agentConnected || !currentProject} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" title="Recharger depuis le PC"><RefreshCw className="w-3.5 h-3.5" /></button>
        <button onClick={onSaveLocal} disabled={localBusy || !agentConnected || !currentProject} className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-30" title="Enregistrer la configuration sur le PC"><HardDrive className="w-3.5 h-3.5" /> <span className="hidden lg:inline">PC</span></button>
        <button onClick={onExport} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted" title="Exporter"><Download className="w-3.5 h-3.5" /><span className="hidden md:inline">Exporter</span></button>
        <button onClick={onBuild} disabled={!currentProject} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30" title="Compiler"><Play className="w-3.5 h-3.5" /><span className="hidden md:inline">Compiler</span></button>
      </div>
    </header>
  );
}
