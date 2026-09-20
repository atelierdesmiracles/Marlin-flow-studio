import React,{useEffect,useState}from"react";
import{agentApi}from"@/lib/localAgent";
import { useProject, validateProject } from "@/lib/projectStore";
import { cn } from "@/lib/utils";
import { FolderOpen, FilePlus2, Upload, ScanLine, Settings, Play, Upload as UploadIcon, Terminal, GitCompareArrows, Download, Cpu, GitBranch, Save, Clock } from "lucide-react";

export default function Dashboard({ setView, onExport, onBuild, onImport }) {
  const { currentProject, state } = useProject();
  const [agent,setAgent]=useState(null); useEffect(()=>{let a=true;const load=()=>agentApi.status().then(x=>a&&setAgent(x)).catch(()=>a&&setAgent(null));load();const t=setInterval(load,2500);return()=>{a=false;clearInterval(t)}},[]);
  if (!currentProject) return <div className="flex items-center justify-center h-full text-muted-foreground">Aucun projet. Créez ou ouvrez un projet.</div>;

  const params = currentProject.allParameters;
  const modified = params.filter((p) => p.modified).length;
  const enabled = params.filter((p) => p.enabled).length;
  const { warnings, errors } = validateProject(currentProject);
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
          <Action icon={Settings} label="Configurer Marlin" onClick={() => setView("config")} primary />
          <Action icon={Play} label="Compiler" onClick={onBuild} />
          <Action icon={UploadIcon} label="Téléverser" onClick={() => setView("gcode")} />
          <Action icon={Terminal} label="Console série" onClick={() => setView("gcode")} />
          <Action icon={GitCompareArrows} label="Comparer" onClick={() => setView("diff")} />
          <Action icon={Download} label="Exporter" onClick={onExport} />
          <Action icon={Upload} label="Importer config" onClick={onImport} />
          <Action icon={ScanLine} label="Scanner projet" onClick={() => setView("validation")} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Paramètres modifiés" value={modified} tone="blue" />
          <StatCard label="Paramètres activés" value={enabled} tone="emerald" />
          <StatCard label="Warnings" value={warnings.length} tone="amber" />
          <StatCard label="Erreurs" value={errors.length} tone="red" />
        </div>

        {/* Project info */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Projet">
            <Row icon={Cpu} label="Carte mère" value={currentProject.board} />
            <Row icon={GitBranch} label="Version Marlin" value={currentProject.marlinVersion} />
            <Row icon={Settings} label="Config version" value={currentProject.configVersion} />
            <Row icon={Save} label="Dernière sauvegarde" value={lastSave} />
            <Row icon={Clock} label="Dernière opération" value={lastOp ? `${lastOp.action} · ${new Date(lastOp.timestamp).toLocaleTimeString()}` : "—"} />
            <Row icon={FolderOpen} label="Fichiers" value={Object.keys(currentProject.parsedFiles).join(", ")} />
          </Card>
          <Card title="Statut">
            <StatusRow label="Build" value={agent?.busy?"EN COURS":agent?.platformio_installed?"PRÊT":"PIO ABSENT"} tone={agent?.busy?"amber":agent?.platformio_installed?"emerald":"muted"} />
            <StatusRow label="Git" value="LOCAL" tone="muted" />
            <StatusRow label="Validation" value={errors.length ? "BLOQUÉ" : "PRÊT"} tone={errors.length ? "red" : "emerald"} />
            <StatusRow label="Agent local" value={agent?"CONNECTÉ":"NON CONNECTÉ"} tone={agent?"emerald":"muted"} />
            <StatusRow label="Série" value={agent?.serial_connected?agent.serial_port:"DÉCONNECTÉ"} tone={agent?.serial_connected?"emerald":"muted"} />
          </Card>
        </div>

        {/* Recent operations */}
        <Card title="Dernières opérations">
          {(state.history[currentProject.id] || []).slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-sm border-b border-border/40 last:border-0">
              <span className="text-xs text-muted-foreground w-16">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="font-mono text-xs px-1.5 rounded bg-muted">{e.file}</span>
              <span>{e.action}</span>
            </div>
          ))}
          {(state.history[currentProject.id] || []).length === 0 && <div className="text-sm text-muted-foreground py-2">Aucune opération récente</div>}
        </Card>
      </div>
    </div>
  );
}

function Action({ icon: Icon, label, onClick, primary }) {
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