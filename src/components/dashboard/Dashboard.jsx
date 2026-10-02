import React,{useEffect,useState}from"react";
import{agentApi}from"@/lib/localAgent";
import { useProject } from "@/lib/projectStore";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { FolderOpen, FilePlus2, Upload, ScanLine, Settings, Play, Upload as UploadIcon, Terminal, GitCompareArrows, Download, Cpu, GitBranch, Save, Clock } from "lucide-react";

export default function Dashboard({ setView, onExport, onBuild, onImport }) {
  const { currentProject, state } = useProject();
  const { t } = useI18n();
  const [agent,setAgent]=useState(null); const [doctor,setDoctor]=useState(null); useEffect(()=>{let a=true;const load=()=>agentApi.status().then(x=>{if(!a)return;setAgent(x);return agentApi.doctor().catch(()=>null)}).then(x=>a&&x&&setDoctor(x)).catch(()=>a&&setAgent(null));load();const t=setInterval(load,8000);return()=>{a=false;clearInterval(t)}},[]);
  if (!currentProject) return <div className="flex items-center justify-center h-full text-muted-foreground">{t("dashboard.noProject")}</div>;

  const params = currentProject.allParameters;
  const modified = params.filter((p) => p.modified).length;
  const enabled = params.filter((p) => p.enabled).length;
  const lastSave = currentProject.updatedDate ? new Date(currentProject.updatedDate).toLocaleString() : "—";
  const lastOp = (state.history[currentProject.id] || [])[0];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{currentProject.name}</h1>
          <p className="text-sm text-muted-foreground">{currentProject.description}</p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Action icon={Settings} label={t("dashboard.configure")} onClick={() => setView("config")} primary />
          <Action icon={Play} label={t("common.build")} onClick={onBuild} />
          <Action icon={UploadIcon} label={t("dashboard.upload")} onClick={() => setView("agent-build")} />
          <Action icon={Terminal} label={t("dashboard.console")} onClick={() => setView("printer")} />
          <Action icon={GitCompareArrows} label={t("dashboard.compare")} onClick={() => setView("diff")} />
          <Action icon={Download} label={t("common.export")} onClick={onExport} />
          <Action icon={Upload} label={t("dashboard.importConfig")} onClick={onImport} />
          <Action icon={ScanLine} label={t("dashboard.doctor")} onClick={() => setView("doctor")} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t("dashboard.modified")} value={modified} tone="blue" />
          <StatCard label={t("dashboard.enabled")} value={enabled} tone="emerald" />
          <StatCard label={t("dashboard.warnings")} value={doctor?.warnings ?? "—"} tone="amber" />
          <StatCard label={t("dashboard.errors")} value={doctor?.errors ?? "—"} tone="red" />
        </div>

        {/* Project info */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card title={t("dashboard.project")}>
            <Row icon={Cpu} label={t("dashboard.board")} value={currentProject.board} />
            <Row icon={GitBranch} label={t("dashboard.version")} value={currentProject.marlinVersion} />
            <Row icon={Settings} label={t("dashboard.configVersion")} value={currentProject.configVersion} />
            <Row icon={Save} label={t("dashboard.lastSave")} value={lastSave} />
            <Row icon={Clock} label={t("dashboard.lastOperation")} value={lastOp ? `${lastOp.action} · ${new Date(lastOp.timestamp).toLocaleTimeString()}` : "—"} />
            <Row icon={FolderOpen} label={t("dashboard.files")} value={Object.keys(currentProject.parsedFiles).join(", ")} />
          </Card>
          <Card title={t("dashboard.status")}>
            <StatusRow label={t("dashboard.build")} value={agent?.busy?t("dashboard.buildRunning"):agent?.platformio_installed?t("dashboard.buildReady"):t("dashboard.pioMissing")} tone={agent?.busy?"amber":agent?.platformio_installed?"emerald":"muted"} />
            <StatusRow label={t("dashboard.git")} value={t("dashboard.local")} tone="muted" />
            <StatusRow label={t("dashboard.doctor")} value={doctor ? (doctor.ready ? t("dashboard.buildReady") : t("dashboard.fix")) : t("dashboard.notAnalyzed")} tone={doctor ? (doctor.ready ? "emerald" : "red") : "muted"} />
            <StatusRow label={t("dashboard.agent")} value={agent?t("common.connected"):t("dashboard.agent") + " · " + t("common.disconnected")} tone={agent?"emerald":"muted"} />
            <StatusRow label={t("dashboard.serial")} value={agent?.serial_connected?agent.serial_port:t("common.disconnected")} tone={agent?.serial_connected?"emerald":"muted"} />
          </Card>
        </div>

        {/* Recent operations */}
        <Card title={t("dashboard.recent")}>
          {(state.history[currentProject.id] || []).slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-sm border-b border-border/40 last:border-0">
              <span className="text-xs text-muted-foreground w-16">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="font-mono text-xs px-1.5 rounded bg-muted">{e.file}</span>
              <span>{e.action}</span>
            </div>
          ))}
          {(state.history[currentProject.id] || []).length === 0 && <div className="text-sm text-muted-foreground py-2">{t("dashboard.noneRecent")}</div>}
        </Card>
      </div>
    </div>
  );
}

function Action({ icon: Icon, label, onClick, primary = false }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border", primary ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90" : "border-border hover:bg-muted")}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function StatCard({ label, value, tone }) {
  const tones = { blue: "text-blue-500", emerald: "text-emerald-500", amber: "text-amber-500", red: "text-red-500" };
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className={cn("text-2xl font-semibold", tones[tone])}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-2.5 border-b border-border text-sm font-semibold">{title}</div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm border-b border-border/40 last:border-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

function StatusRow({ label, value, tone }) {
  const tones = { emerald: "text-emerald-500", red: "text-red-500", muted: "text-muted-foreground", amber: "text-amber-500" };
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs font-semibold", tones[tone])}>{value}</span>
    </div>
  );
}