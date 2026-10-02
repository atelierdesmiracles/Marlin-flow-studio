import React, { useEffect, useMemo, useState } from "react";
import { Hammer, RefreshCw, Square, UploadCloud, HardDrive, CheckCircle2, AlertCircle, Play, Trash2 } from "lucide-react";
import { agentApi } from "@/lib/localAgent";
import FirmwareArtifactDialog from "./FirmwareArtifactDialog";
import { useProject } from "@/lib/projectStore";
import { useI18n } from "@/lib/i18n";

export default function BuildCenter({ ensureSaved }) {
  const { currentProject, takeSnapshot } = useProject();
  const { t } = useI18n();
  const [envs, setEnvs] = useState([]);
  const [details, setDetails] = useState([]);
  const [environment, setEnvironment] = useState("");
  const [port, setPort] = useState("");
  const [ports, setPorts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [status, setStatus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("build");
  const [autoSave, setAutoSave] = useState(true);
  const modified = currentProject?.allParameters?.filter(p => p.modified).length || 0;

  async function refresh() {
    try {
      const [e, s, l, a, p] = await Promise.all([
        agentApi.environments(), agentApi.status(), agentApi.logs(500), agentApi.buildArtifacts(), agentApi.ports(),
      ]);
      setEnvs(e.environments || []); setDetails(e.environment_details || []); setStatus(s); setLogs(l.logs || []); setArtifacts(a.artifacts || []); setPorts(p.ports || []);
      if (!environment) setEnvironment(e.selected_environment || e.default_envs?.[0] || e.environments?.[0] || "");
      if (!port) setPort(p.ports?.[0]?.device || "");
    } catch (e) { setError(e.message || "Agent local indisponible"); }
  }

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem("marlin-flow-settings-v1") || "{}");
      if (prefs.buildEnvironment) setEnvironment(prefs.buildEnvironment);
    } catch {}
    refresh();
    const t = setInterval(refresh, 1200);
    return () => clearInterval(t);
  }, []);

  async function prepare(operation) {
    setError("");
    if (!currentProject) throw new Error("Aucun projet actif.");
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem("marlin-flow-settings-v1") || "{}"); } catch {}
    const shouldSave = prefs.autoSaveBeforeBuild !== false && autoSave;
    const shouldSnapshot = prefs.autoSnapshot !== false && autoSave;
    if (modified && shouldSave) {
      if (shouldSnapshot) takeSnapshot(currentProject.id, `Auto - avant ${operation}`);
      await ensureSaved?.({ throwOnError: true });
    }
    await agentApi.selectEnvironment(environment || undefined).catch(() => {});
  }

  async function runDoctorBeforeHardwareAction(action) {
    if (!["build", "upload", "build-upload"].includes(action)) return null;
    const report = await agentApi.doctor();
    if (!report?.ready) {
      const firstErrors = (report?.checks || [])
        .filter((check) => check.status === "error")
        .slice(0, 3)
        .map((check) => check.label)
        .join(", ");
      const suffix = firstErrors ? ` Contrôles bloquants : ${firstErrors}.` : " Consulte Marlin Doctor pour le détail.";
      throw new Error(`Marlin Doctor bloque l'opération : ${report?.errors ?? 0} erreur(s), ${report?.warnings ?? 0} avertissement(s).${suffix}`);
    }
    return report;
  }

  async function run(action) {
    setBusy(true); setError("");
    try {
      await prepare(action);
      await runDoctorBeforeHardwareAction(action);
      const args = [environment || undefined, port || undefined];
      if (action === "build") await agentApi.build(...args);
      if (action === "clean") await agentApi.clean(environment || undefined);
      if (action === "upload") await agentApi.upload(...args);
      if (action === "build-upload") await agentApi.buildUpload(...args);
      await refresh();
    } catch (e) { setError(e.message || `${action} impossible`); } finally { setBusy(false); }
  }

  async function stop() { try { await agentApi.stop(); } catch (e) { setError(e.message || "Arrêt impossible"); } await refresh(); }

  const selectedDetails = useMemo(() => details.find(d => String(d.name).toLowerCase() === String(environment).toLowerCase()), [details, environment]);
  const tail = logs.slice(-200);

  return <div className="h-full overflow-y-auto p-5 bg-muted/10"><div className="max-w-7xl mx-auto space-y-4">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-xl font-semibold flex items-center gap-2"><Hammer className="w-5 h-5" /> {t("buildCenter.title")}</h1><p className="text-sm text-muted-foreground mt-1">{t("buildCenter.subtitle")}</p></div><button onClick={refresh} className="p-2 rounded border hover:bg-accent"><RefreshCw className="w-4 h-4" /></button></div>
    {error && <div className="flex gap-2 items-start rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
    <div className="grid md:grid-cols-3 gap-3">
      <Info label={t("buildCenter.project")} value={currentProject?.name || t("top.modelNone")} />
      <Info label={t("buildCenter.platformio")} value={status?.platformio_installed ? t("common.installed") : t("common.absent")} />
      <Info label={t("buildCenter.state")} value={status?.busy ? `${status.operation || t("common.loading")}…` : t("common.ready")} />
    </div>
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="grid lg:grid-cols-4 gap-2">
        <select value={environment} onChange={async e => { const v=e.target.value; setEnvironment(v); try{await agentApi.selectEnvironment(v);}catch(err){setError(err.message);} }} className="px-3 py-2 rounded border bg-background text-sm"><option value="">{t("buildCenter.environment")}</option>{envs.map(e => <option key={e} value={e}>{e}</option>)}</select>
        <select value={port} onChange={e=>setPort(e.target.value)} className="px-3 py-2 rounded border bg-background text-sm"><option value="">{t("buildCenter.uploadPort")}</option>{ports.map(p=><option key={p.device} value={p.device}>{p.device}{p.description?` — ${p.description}`:""}</option>)}</select>
        <label className="flex items-center gap-2 px-3 py-2 rounded border text-sm"><input type="checkbox" checked={autoSave} onChange={e=>setAutoSave(e.target.checked)} />{t("buildCenter.autoSave")}</label>
        <div className="text-xs text-muted-foreground flex items-center px-2">{selectedDetails?.board ? `Board: ${selectedDetails.board}` : t("buildCenter.unknownBoard")}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Action onClick={()=>run("build")} disabled={busy || !environment} icon={Play}>Build</Action>
        <Action onClick={()=>run("clean")} disabled={busy || !environment} icon={Trash2}>Clean</Action>
        <Action onClick={()=>run("upload")} disabled={busy || !environment} icon={UploadCloud}>Upload</Action>
        <Action onClick={()=>run("build-upload")} disabled={busy || !environment} icon={Hammer}>Build + Upload</Action>
        <Action onClick={stop} disabled={!status?.busy} icon={Square}>{t("buildCenter.stop")}</Action>
      </div>
    </div>

    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex border-b border-border">{[["build",t("buildCenter.logs")],["firmware",t("buildCenter.firmware")],["sd",t("buildCenter.sd")]].map(([id,label]) => <button key={id} onClick={()=>setActiveTab(id)} className={`px-4 py-2 text-sm ${activeTab===id?"bg-accent font-medium":"hover:bg-accent/50"}`}>{label}</button>)}</div>
      {activeTab === "build" && <div className="h-[430px] overflow-auto p-3 bg-slate-950 text-slate-200 font-mono text-[11px]">{tail.length ? tail.map((l,i)=><div key={`${l.id||l.timestamp}-${i}`} className={l.level==="error"?"text-red-400":l.level==="warning"?"text-amber-300":l.level==="success"?"text-emerald-300":l.level==="command"?"text-cyan-300":""}><span className="text-slate-500 mr-2">{l.timestamp}</span>{l.message}</div>) : <div className="text-slate-500">{t("buildCenter.noLogs")}</div>}</div>}
      {activeTab === "firmware" && <div className="p-4 space-y-2">{artifacts.length?artifacts.map(a=><button key={a.path} onClick={()=>setSelected(a)} className="w-full flex items-center gap-3 px-3 py-2 rounded border hover:bg-accent text-left"><HardDrive className="w-4 h-4"/><span className="font-mono text-xs flex-1 truncate">{a.path}</span><span className="text-xs text-muted-foreground">{((a.size||0)/1024).toFixed(1)} Ko</span></button>):<div className="text-sm text-muted-foreground py-8 text-center">{t("buildCenter.noFirmware")}</div>}</div>}
      {activeTab === "sd" && <div className="p-4 text-sm text-muted-foreground">Clique sur un firmware dans l'onglet <b>{t("buildCenter.firmware")}</b> pour ouvrir l'outil de copie vers une carte mémoire amovible.</div>}
    </div>
    {selected && <FirmwareArtifactDialog open={true} artifact={selected} onClose={()=>setSelected(null)} />}
  </div></div>;
}

function Action({onClick,disabled,icon:Icon,children}){return <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 px-3 py-2 rounded border text-sm hover:bg-accent disabled:opacity-40"><Icon className="w-3.5 h-3.5"/>{children}</button>}
function Info({label,value}){return <div className="rounded-lg border border-border bg-card p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium truncate">{value}</div></div>}
