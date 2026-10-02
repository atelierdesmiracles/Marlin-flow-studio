import React, { useEffect, useState } from "react";
import { Search, Play, Download, GitBranch, Stethoscope, HardDrive, RefreshCw, Circle, Languages } from "lucide-react";
import { useProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export default function TopBar({ onCommand, onExport, onBuild, onDoctor, onSaveLocal, onReloadLocal, localBusy }) {
  const { currentProject } = useProject();
  const { t, language, languages, setLanguage } = useI18n();
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
  return (
    <header className="h-12 flex items-center gap-2 px-3 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2 min-w-0 mr-1">
        <span className="text-sm font-medium truncate">{currentProject?.name || t("common.noneProject")}</span>
        {currentProject && <span className="text-xs text-muted-foreground hidden md:inline truncate">{currentProject.model || t("top.modelNone")}</span>}
        {currentProject && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden md:inline">{currentProject.marlinVersion}</span>}
      </div>

      <button onClick={onCommand} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted min-w-[170px] md:min-w-[240px]">
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">{t("common.search")}</span>
        <kbd className="text-[10px] px-1 py-0.5 rounded border border-border bg-background">⌘K</kbd>
      </button>

      <div className="flex-1" />

      <div className={cn("hidden xl:flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border", agentConnected ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/5" : "border-red-500/20 text-red-600 bg-red-500/5")} title={agentStatus?.project_dir || t("top.agentOffline")}>
        <Circle className={cn("w-2.5 h-2.5 fill-current", agentConnected ? "text-emerald-500" : "text-red-500")} />
        {agentConnected ? (agentStatus?.busy ? t("top.agentBusy") : t("top.agentConnected")) : t("top.agentOffline")}
      </div>

      <div className="hidden lg:flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground"><GitBranch className="w-3.5 h-3.5" /> {currentProject?.marlinVersion || t("top.modelNone")}</span>
        <span className={cn("flex items-center gap-1", modified > 0 ? "text-blue-500" : "text-muted-foreground")}>● {modified}</span>
      </div>

      <div className="flex items-center gap-1">
        <label className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-background text-xs" title={t("common.language")}>
          <Languages className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-transparent outline-none text-xs max-w-20">
            {languages.map(item => <option key={item.code} value={item.code}>{item.native}</option>)}
          </select>
        </label>
        <button onClick={onReloadLocal} disabled={localBusy || !agentConnected || !currentProject} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" title={t("common.reload")}><RefreshCw className="w-3.5 h-3.5" /></button>
        <button onClick={onSaveLocal} disabled={localBusy || !agentConnected || !currentProject} className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-30" title={t("common.savePc")}><HardDrive className="w-3.5 h-3.5" /> <span className="hidden lg:inline">PC</span></button>
        <button onClick={onDoctor} disabled={!currentProject} className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-30" title={t("common.doctor")}><Stethoscope className="w-3.5 h-3.5" /> <span className="hidden xl:inline">{t("common.doctor")}</span></button>
        <button onClick={onExport} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted" title={t("common.export")}><Download className="w-3.5 h-3.5" /><span className="hidden md:inline">{t("common.export")}</span></button>
        <button onClick={onBuild} disabled={!currentProject} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30" title={t("common.build")}><Play className="w-3.5 h-3.5" /><span className="hidden md:inline">{t("common.build")}</span></button>
      </div>
    </header>
  );
}
