import React, { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, HardDriveDownload, RefreshCw, Square, TerminalSquare, UploadCloud, Wrench, XCircle, Plug, Unplug, GitBranch, Send, FolderOpen, Cpu, Save, FileCode2, ShieldCheck } from "lucide-react";
import { agentApi, getAgentToken, getAgentUrl, setAgentToken, setAgentUrl } from "@/lib/localAgent";
import { cn } from "@/lib/utils";
import { parseProject, useProject } from "@/lib/projectStore";
import FirmwareArtifactDialog from "./FirmwareArtifactDialog";

export default function LocalAgentPanel() {
  const { currentProject, updateProject, addProject, selectProject } = useProject();
  const [url, setUrl] = useState(getAgentUrl());
  const [token, setToken] = useState(getAgentToken());
  const [status, setStatus] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [projectPath, setProjectPath] = useState("");
  const [envs, setEnvs] = useState([]);
  const [envDetails, setEnvDetails] = useState([]);
  const [envSource, setEnvSource] = useState("");
  const [environment, setEnvironment] = useState("");
  const [logs, setLogs] = useState([]);
  const [logId, setLogId] = useState(0);
  const [ports, setPorts] = useState([]);
  const [port, setPort] = useState("");
  const [baud, setBaud] = useState("115200");
  const [command, setCommand] = useState("M115");
  const [git, setGit] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [error, setError] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [migrationFiles, setMigrationFiles] = useState([]);
  const [migrationReport, setMigrationReport] = useState(null);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const connected = !!status?.success;

  async function refresh(silent = false) {
    try {
      if (!silent) setError("");
      setAgentUrl(url);
      // Never erase a valid token injected by the desktop shell.
      if (token.trim()) setAgentToken(token.trim());
      const [a, e, l, pr, g, project, artifactsData] = await Promise.all([
        agentApi.status(), agentApi.environments(), agentApi.logs(300, logId), agentApi.ports(), agentApi.gitStatus(), agentApi.project(), agentApi.buildArtifacts(),
      ]);
      setStatus(a);
      setEnvs(e.environments || []);
      setEnvDetails(e.environment_details || []);
      setEnvSource(e.development_environment_source_relative || "");
      setProjectInfo(project.project || null);
      setProjectPath(project.project?.path || a.project_dir || "");
      setGit(g.git || g);
      setArtifacts((artifactsData?.artifacts || []));
      setPorts(pr.ports || []);
      if (!environment && e.default_envs?.length) setEnvironment(e.default_envs[0]);
      else if (!environment && e.environments?.length) setEnvironment(e.environments[0]);
      if (!port && pr.ports?.length) setPort(pr.ports[0].device);
      if (l.logs?.length) setLogs((prev) => [...prev, ...l.logs].slice(-1000));
      if (typeof l.latest_id === "number") setLogId(l.latest_id);
    } catch (e) {
      setStatus(null);
      if (!silent) setError(e.message || "Agent local inaccessible");
    }
  }

  useEffect(() => {
    const syncAgentCredentials = () => {
      const savedToken = getAgentToken();
      const savedUrl = getAgentUrl();
      if (savedToken && savedToken !== token) setToken(savedToken);
      if (savedUrl && savedUrl !== url) setUrl(savedUrl);
    };

    // The desktop shell injects the local agent token after the WebEngine page loads.
    // Listen for that signal so the first refresh does not erase the injected token.
    window.addEventListener("marlin-agent-ready", syncAgentCredentials);
    syncAgentCredentials();
    refresh(true);
    const timer = setInterval(() => refresh(true), 2000);
    return () => {
      window.removeEventListener("marlin-agent-ready", syncAgentCredentials);
      clearInterval(timer);
    };
  }, [url, token]);

  async function action(fn) {
    setBusy(true); setError("");
    try { await fn(environment || undefined); await refresh(true); }
    catch (e) { setError(e.message || "Opération impossible"); }
    finally { setBusy(false); }
  }

  async function install() {
    setBusy(true); setError("");
    try { await agentApi.installPlatformIO(); }
    catch (e) { setError(e.message || "Installation PlatformIO impossible"); }
    finally { setBusy(false); }
  }

  async function selectLocalProject() {
    if (!projectPath.trim()) return;
    setBusy(true); setError("");
    try { await agentApi.selectProject(projectPath.trim()); await refresh(true); }
    catch (e) { setError(e.message || "Projet local invalide"); }
    finally { setBusy(false); }
  }

  async function loadLocalProject() {
    setBusy(true); setError("");
    try {
      const p = await agentApi.project();
      const [minimal, h, a] = await Promise.all([agentApi.readConfiguration("Config.h").catch(() => null), agentApi.readConfiguration("Configuration.h").catch(() => null), agentApi.readConfiguration("Configuration_adv.h").catch(() => null)]);
      const base = currentProject || {};
      const id = base.id || `local_${Date.now()}`;
      const proj = parseProject({
        id,
        name: base.name || p.project?.path?.split(/[\\/]/).pop() || "Projet local",
        description: base.description || "Projet PlatformIO chargé depuis l'ordinateur",
        manufacturer: base.manufacturer || "", model: base.model || "", board: base.board || p.project?.marlin?.motherboard || "",
        marlinVersion: base.marlinVersion !== "2.1.x" ? base.marlinVersion : (p.project?.marlin?.version || "2.1.x"),
        configVersion: base.configVersion || "local", author: base.author || "Local Agent", tags: [...(base.tags || []), "local-agent"],
        createdDate: base.createdDate || new Date().toISOString(), updatedDate: new Date().toISOString(),
        files: { ...(minimal?.content ? { "Config.h": minimal.content } : {}), ...(h?.content ? { "Configuration.h": h.content } : {}), ...(a?.content ? { "Configuration_adv.h": a.content } : {}) },
        localProjectPath: p.project?.path || status?.project_dir || "",
        localHashes: { "Configuration.h": h.sha256, "Configuration_adv.h": a.sha256 },
      });
      if (base.id) updateProject(proj); else { addProject(proj); selectProject(id); }
      await refresh(true);
    } catch (e) { setError(e.message || "Impossible de charger la configuration locale"); }
    finally { setBusy(false); }
  }

  async function runMigration(dryRun = false) {
    if (!migrationFiles.length) { setError("Sélectionnez au moins un fichier de configuration."); return; }
    setMigrationBusy(true); setError("");
    try {
      const files = {};
      for (const file of migrationFiles) files[file.name] = await file.text();
      const result = await agentApi.migrateConfiguration(files, dryRun);
      setMigrationReport(result);
      if (!dryRun) {
        await refresh(true);
        setMigrationFiles([]);
      }
    } catch (e) { setError(e.message || "Migration impossible"); }
    finally { setMigrationBusy(false); }
  }

  async function serialConnect() {
    setBusy(true); setError("");
    try { await agentApi.serialConnect(port, Number(baud)); await refresh(true); }
    catch (e) { setError(e.message || "Connexion série impossible"); }
    finally { setBusy(false); }
  }

  async function serialDisconnect() {
    try { await agentApi.serialDisconnect(); await refresh(true); }
    catch (e) { setError(e.message || "Déconnexion impossible"); }
  }

  async function sendCommand(e) {
    e?.preventDefault();
    if (!command.trim()) return;
    setError("");
    try { await agentApi.serialSend(command); setCommand(""); await refresh(true); }
    catch (e) { setError(e.message || "Envoi G-code impossible"); }
  }

  const latest = useMemo(() => logs.slice(-220), [logs]);
  const marlin = projectInfo?.marlin || {};

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-xl font-semibold flex items-center gap-2"><Activity className="w-5 h-5" /> Agent local</h1><p className="text-sm text-muted-foreground">Pont local sécurisé : fichiers Marlin, PlatformIO, Git et imprimante série.</p></div>
          <div className={cn("px-2.5 py-1 rounded-full text-xs font-medium", connected ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{connected ? "● CONNECTÉ" : "● DÉCONNECTÉ"}</div>
        </div>

        <div className="grid xl:grid-cols-4 gap-3">
          <Card title="Connexion">
            <Field label="URL Agent"><input value={url} onChange={e => setUrl(e.target.value)} className="field" /></Field>
            <Field label="Token local"><input type="password" value={token} onChange={e => setToken(e.target.value)} className="field font-mono" /></Field>
            <button onClick={() => refresh()} className="primary mt-3 w-full"><RefreshCw className="inline w-3.5 h-3.5 mr-1" /> Tester / enregistrer</button>
          </Card>
          <Card title="Projet local">
            <Field label="Chemin du projet"><input value={projectPath} onChange={e => setProjectPath(e.target.value)} className="field font-mono" placeholder="/home/moi/Marlin" /></Field>
            <button onClick={selectLocalProject} disabled={busy || !connected || !projectPath.trim()} className="secondary w-full mb-2"><FolderOpen className="inline w-3.5 h-3.5 mr-1" /> Utiliser ce projet</button>
            <button onClick={loadLocalProject} disabled={busy || !connected || !status?.platformio_ini} className="primary w-full mb-3"><Save className="inline w-3.5 h-3.5 mr-1" /> Charger dans le configurateur</button>
            <Info label="Marlin" value={marlin.version || "non détecté"} />
            <Info label="MOTHERBOARD" value={marlin.motherboard || "non détectée"} mono />
          </Card>
          <Card title="Migration de configuration">
            <div className="text-[11px] text-muted-foreground mb-2">Importe une ancienne configuration dans le projet actuel sans remplacer brutalement ses fichiers. Marlin ≥ 2.1 utilise le mécanisme officiel <span className="font-mono">config.ini</span>.</div>
            <input type="file" multiple accept=".h,.ini,.json,.yml,.yaml" onChange={e => { setMigrationFiles(Array.from(e.target.files || [])); setMigrationReport(null); }} className="block w-full text-xs" />
            <div className="mt-2 text-[11px] text-muted-foreground">{migrationFiles.length ? migrationFiles.map(f => f.name).join(", ") : "Aucun fichier sélectionné"}</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => runMigration(true)} disabled={!connected || migrationBusy || !migrationFiles.length} className="secondary"><FileCode2 className="inline w-3.5 h-3.5 mr-1" /> Analyser</button>
              <button onClick={() => runMigration(false)} disabled={!connected || migrationBusy || !migrationFiles.length} className="primary"><ShieldCheck className="inline w-3.5 h-3.5 mr-1" /> Migrer</button>
            </div>
            {migrationReport && <div className="mt-3 p-2 rounded border border-border bg-background text-[11px] space-y-1">
              <div><b>Stratégie :</b> {migrationReport.strategy || "analyse"}</div>
              <div><b>Paramètres :</b> {migrationReport.accepted_count || 0} acceptés · {migrationReport.skipped_count || 0} ignorés</div>
              <div><b>MOTHERBOARD :</b> {migrationReport.post_migration_motherboard || migrationReport.accepted?.MOTHERBOARD || "non détectée"}</div>
              {migrationReport.skipped_count > 0 && <div className="text-amber-600">Les options absentes du modèle cible sont conservées dans le rapport et ne sont pas injectées aveuglément.</div>}
            </div>}
          </Card>
          <Card title="PlatformIO">
            <div className="mb-2 text-[11px] text-muted-foreground">Source : <span className="font-mono text-foreground">{envSource || "Marlin/ini introuvable"}</span></div>
            <select value={environment} onChange={async e => { const value = e.target.value; setEnvironment(value); try { await agentApi.selectEnvironment(value); await refresh(true); } catch (err) { setError(err?.message || "Impossible de sélectionner l'environnement"); } }} className="field mb-2">{envs.length ? envs.map(e => { const d = envDetails.find(x => String(x.name).toLowerCase() === String(e).toLowerCase()); return <option key={e} value={e}>{e}{d?.source ? ` — ${d.source}` : ""}</option>; }) : <option>Aucun environnement</option>}</select>
            <div className="grid grid-cols-2 gap-2">
              <Btn icon={HardDriveDownload} label="Installer PIO" onClick={install} disabled={busy} />
              <Btn icon={Wrench} label="BUILD" onClick={() => action(agentApi.build)} disabled={busy || !connected || !status?.platformio_installed} />
              <Btn icon={Square} label="CLEAN" onClick={() => action(agentApi.clean)} disabled={busy || !connected || !status?.platformio_installed} />
              <Btn icon={UploadCloud} label="UPLOAD" onClick={() => action(agentApi.upload)} disabled={busy || !connected || !status?.platformio_installed} />
              <Btn icon={UploadCloud} label="BUILD + UPLOAD" onClick={() => action(agentApi.buildUpload)} disabled={busy || !connected || !status?.platformio_installed} wide />
              <Btn icon={Square} label="STOP" onClick={() => action(() => agentApi.stop())} disabled={!connected} wide />
            </div>
          </Card>
          <Card title="Firmware généré">
            {artifacts.length ? (
              <div className="space-y-2">
                {artifacts.slice(0, 8).map((a) => (
                  <button key={a.path} type="button" onClick={() => setSelectedArtifact(a)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-muted transition-colors">
                    <div className="flex items-start gap-2">
                      <HardDriveDownload className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-xs font-semibold" title={a.path}>{a.name}</div>
                        <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground"><span>{(a.size / 1024).toFixed(1)} Ko</span>{a.environment && <span>· {a.environment}</span>}</div>
                      </div>
                      <span className="text-[10px] font-medium text-blue-600">Enregistrer</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">Aucun firmware détecté. Lancez un BUILD puis cliquez sur « Actualiser ».</div>}
            <button onClick={async () => { try { const r = await agentApi.buildArtifacts(); setArtifacts(r.artifacts || []); } catch (e) { setError(e.message); } }} disabled={!connected} className="secondary mt-3 w-full"><RefreshCw className="inline w-3.5 h-3.5 mr-1" /> Actualiser</button>
          </Card>
          <Card title="Git">
            <Info label="Dépôt" value={git?.repository ? "Oui" : "Non"} /><Info label="Branche" value={git?.branch || "—"} /><Info label="Commit" value={git?.commit || "—"} mono /><Info label="État" value={git?.clean ? "Propre" : `${git?.status?.length || 0} modification(s)`} />
            <button onClick={async () => { try { await agentApi.gitPull(); await refresh(true); } catch (e) { setError(e.message); } }} disabled={!connected || !git?.repository || !!status?.busy} className="secondary mt-3 w-full"><GitBranch className="inline w-3.5 h-3.5 mr-1" /> Git Pull (--ff-only)</button>
          </Card>
        </div>

        <Card title="Port série / G-code">
          <div className="flex flex-wrap gap-2 items-center">
            <select value={port} onChange={e => setPort(e.target.value)} className="field w-64">{ports.length ? ports.map(p => <option key={p.device} value={p.device}>{p.device}{p.description ? ` — ${p.description}` : ""}</option>) : <option value="">Aucun port détecté</option>}</select>
            <select value={baud} onChange={e => setBaud(e.target.value)} className="field w-32"><option>115200</option><option>230400</option><option>250000</option><option>500000</option><option>1000000</option></select>
            {!status?.serial_connected ? <button onClick={serialConnect} disabled={!port || !connected || busy} className="primary"><Plug className="inline w-3.5 h-3.5 mr-1" /> Connecter</button> : <button onClick={serialDisconnect} className="secondary"><Unplug className="inline w-3.5 h-3.5 mr-1" /> Déconnecter</button>}
          </div>
          <form onSubmit={sendCommand} className="flex gap-2 mt-3"><input value={command} onChange={e => setCommand(e.target.value)} placeholder="M115 / M105 / G28…" className="field flex-1 font-mono" /><button disabled={!status?.serial_connected} className="primary"><Send className="inline w-3.5 h-3.5 mr-1" /> Envoyer</button></form>
          <div className="mt-2 text-[11px] text-muted-foreground">Si Linux refuse l'accès au port, Marlin Flow Studio demande automatiquement l'autorisation système (Polkit / mot de passe) puis réessaie la connexion.</div>
        </Card>

        {error && <div className="p-3 rounded bg-red-500/10 text-red-600 text-sm flex gap-2"><XCircle className="w-4 h-4" />{error}</div>}

        <section className="rounded-lg border border-border bg-card overflow-hidden"><div className="px-4 py-2.5 border-b border-border flex items-center gap-2"><TerminalSquare className="w-4 h-4" /><b className="text-sm">Console agent</b><span className="ml-auto text-xs text-muted-foreground">Projet : {status?.project_dir || "—"}</span></div><div className="h-[420px] overflow-auto bg-slate-950 text-slate-200 p-3 font-mono text-[11px]">{latest.map((l, i) => <div key={`${l.id}-${i}`} className={cn(l.level === "error" && "text-red-400", l.level === "warning" && "text-amber-300", l.level === "success" && "text-emerald-300", l.level === "command" && "text-cyan-300", l.level === "serial" && "text-violet-300")}><span className="text-slate-500 mr-2">{l.timestamp}</span>{l.message}</div>)}</div></section>

        <div className="p-4 rounded-lg border border-border bg-card text-sm text-muted-foreground flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> L'agent reste lié à 127.0.0.1 et n'expose aucune commande shell arbitraire.</div>
        <FirmwareArtifactDialog open={!!selectedArtifact} artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
      </div>
    </div>
  );
}

function Card({ title, children }) { return <div className="rounded-lg border border-border bg-card p-4"><div className="font-semibold text-sm mb-3">{title}</div>{children}</div>; }
function Field({ label, children }) { return <label className="block mb-2"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>; }
function Info({ label, value, mono }) { return <div className="flex justify-between gap-2 py-1.5 border-b border-border/40 text-sm"><span className="text-muted-foreground">{label}</span><span className={cn("text-right break-all", mono && "font-mono text-xs")}>{value}</span></div>; }
function Btn({ icon: Icon, label, onClick, disabled, wide }) { return <button onClick={onClick} disabled={disabled} className={cn("flex items-center justify-center gap-1 px-2 py-2 text-xs rounded border disabled:opacity-40 hover:bg-accent", wide && "col-span-2 bg-primary text-primary-foreground border-primary hover:bg-primary/90")}><Icon className="w-3.5 h-3.5" />{label}</button>; }
