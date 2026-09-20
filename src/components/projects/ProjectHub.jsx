import React, { useEffect, useState } from "react";
import { FolderOpen, DownloadCloud, Plus, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import ImportMarlinModal from "./ImportMarlinModal";
import ImportExampleConfig from "./ImportExampleConfig";
import ImportLocalFile from "./ImportLocalFile";
import { agentApi } from "@/lib/localAgent";
import { useProject } from "@/lib/projectStore";

export default function ProjectHub({ onOpenProject }) {
  const { currentProject, state, selectProject } = useProject();
  const [path, setPath] = useState("");
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("MarlinProject");
  const [tag, setTag] = useState("");
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);

  async function refresh() {
    setError("");
    try {
      const [projectResult, statusResult] = await Promise.all([agentApi.project(), agentApi.status()]);
      const p = projectResult.project || {};
      setPath(p.path || "");
      setStatus(statusResult);
      if (!destination && p.path) setDestination(p.path);
      try { setLatest(await agentApi.latestMarlin()); } catch { setLatest(null); }
    } catch (e) {
      setStatus(null);
      setError(e.message || "Agent local inaccessible");
    }
  }

  useEffect(() => { refresh(); }, []);

  async function openLocal() {
    setBusy(true); setError("");
    try {
      if (!path.trim()) throw new Error("Indique le chemin du dossier Marlin.");
      await agentApi.selectProject(path.trim());
      window.dispatchEvent(new Event("marlin-project-changed"));
      onOpenProject?.();
      await refresh();
    } catch (e) {
      setError(e.message || "Impossible d'ouvrir le projet.");
    } finally { setBusy(false); }
  }

  async function createProject() {
    setBusy(true); setError("");
    try {
      if (!destination.trim()) throw new Error("Indique le dossier parent de destination.");
      if (!name.trim()) throw new Error("Indique un nom de projet.");
      const result = await agentApi.createMarlinProject(destination.trim(), name.trim(), tag.trim() || undefined);
      if (result.project_dir) {
        await agentApi.selectProject(result.project_dir);
        setPath(result.project_dir);
      }
      window.dispatchEvent(new Event("marlin-project-changed"));
      onOpenProject?.();
      await refresh();
    } catch (e) {
      setError(e.message || "Création du projet impossible.");
    } finally { setBusy(false); }
  }

  const projects = state.projects || [];

  return (
    <div className="h-full overflow-y-auto p-6 bg-muted/10">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Accueil / Projets</h1>
            <p className="text-sm text-muted-foreground mt-1">Créer, ouvrir et reprendre un projet Marlin local.</p>
          </div>
          <button onClick={refresh} disabled={busy} className="p-2 rounded border hover:bg-accent" title="Actualiser"><RefreshCw className={busy ? "w-4 h-4 animate-spin" : "w-4 h-4"} /></button>
        </div>

        {error && <div className="flex gap-2 items-start rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}

        <div className="grid xl:grid-cols-2 gap-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 font-semibold"><FolderOpen className="w-4 h-4" /> Ouvrir un projet existant</div>
            <p className="text-xs text-muted-foreground mt-1">Le dossier doit contenir <code>platformio.ini</code>.</p>
            <label className="block text-xs font-medium mt-4">Chemin du projet</label>
            <input value={path} onChange={e => setPath(e.target.value)} onKeyDown={e => e.key === "Enter" && openLocal()} className="w-full mt-1 px-3 py-2 rounded-md border bg-background font-mono text-sm" placeholder="/home/moi/Marlin" />
            <div className="flex gap-2 mt-3">
              <button onClick={openLocal} disabled={busy || !path.trim()} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-40"><FolderOpen className="w-4 h-4" /> Ouvrir</button>
              <button onClick={() => setModal("folder")} className="px-3 py-2 rounded-md border text-sm hover:bg-accent">Importer depuis des fichiers</button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> Nouveau projet Marlin</div>
            <p className="text-xs text-muted-foreground mt-1">Télécharge la release stable officielle via l'Agent local.</p>
            <div className="grid md:grid-cols-2 gap-2 mt-4">
              <div>
                <label className="block text-xs font-medium">Dossier parent</label>
                <input value={destination} onChange={e => setDestination(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border bg-background font-mono text-sm" placeholder="/home/moi/projets" />
              </div>
              <div>
                <label className="block text-xs font-medium">Nom</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border bg-background font-mono text-sm" placeholder="MonMarlin" />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-xs font-medium">Tag Marlin (optionnel)</label>
              <input value={tag} onChange={e => setTag(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border bg-background font-mono text-sm" placeholder={latest?.tag || "Dernière release stable"} />
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground"><DownloadCloud className="w-3.5 h-3.5" /> {latest?.tag ? `Release détectée : ${latest.tag}` : "Release en attente de l'Agent"}</div>
            <button onClick={createProject} disabled={busy || !destination.trim() || !name.trim()} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-40"><DownloadCloud className="w-4 h-4" /> {busy ? "Création…" : "Créer le projet"}</button>
          </section>
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3"><div className="font-semibold">Projet actif</div>{currentProject && <button onClick={onOpenProject} className="text-xs px-2 py-1 rounded border hover:bg-accent">Ouvrir le configurateur</button>}</div>
          {currentProject ? <div className="grid md:grid-cols-4 gap-3 mt-3 text-sm">
            <Info label="Nom" value={currentProject.name} />
            <Info label="Marlin" value={currentProject.marlinVersion || "—"} />
            <Info label="Carte" value={currentProject.board || "—"} />
            <Info label="Chemin" value={currentProject.localProjectPath || "—"} mono />
          </div> : <div className="text-sm text-muted-foreground mt-2">Aucun projet actif.</div>}
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between"><div className="font-semibold">Projets mémorisés</div><span className="text-xs text-muted-foreground">{projects.length}</span></div>
          <div className="divide-y divide-border">
            {projects.map(p => <button key={p.id} onClick={() => { selectProject(p.id); onOpenProject?.(); }} className="w-full text-left px-4 py-3 hover:bg-accent/40">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="font-medium">{p.name}</span><span className="text-xs text-muted-foreground">{p.marlinVersion || "Marlin"}</span></div>
              <div className="text-xs text-muted-foreground mt-1 font-mono truncate">{p.localProjectPath || "Projet importé"}</div>
            </button>)}
            {!projects.length && <div className="p-6 text-center text-sm text-muted-foreground">Aucun projet mémorisé.</div>}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal("marlin")} className="px-3 py-2 rounded-md border text-sm hover:bg-accent">Importer un projet Marlin</button>
          <button onClick={() => setModal("example")} className="px-3 py-2 rounded-md border text-sm hover:bg-accent">Importer une configuration</button>
          <button onClick={() => setModal("file")} className="px-3 py-2 rounded-md border text-sm hover:bg-accent">Importer des fichiers</button>
          <button onClick={() => window.open("https://github.com/MarlinFirmware/Marlin/releases", "_blank", "noopener,noreferrer")} className="px-3 py-2 rounded-md border text-sm hover:bg-accent inline-flex items-center gap-1">Releases Marlin <ExternalLink className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <ImportMarlinModal open={modal === "marlin"} onClose={() => setModal(null)} />
      <ImportExampleConfig open={modal === "example"} onClose={() => setModal(null)} />
      <ImportLocalFile open={modal === "file" || modal === "folder"} onClose={() => setModal(null)} />
    </div>
  );
}

function Info({ label, value, mono }) {
  return <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={mono ? "mt-1 text-xs font-mono truncate" : "mt-1 text-sm font-medium truncate"}>{value}</div></div>;
}
