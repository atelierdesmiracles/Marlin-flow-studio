import React, { useEffect, useMemo, useState } from "react";
import {
  GitBranch, RefreshCw, DownloadCloud, AlertCircle, ExternalLink, Copy, Check,
  FolderGit2, PackageSearch, ChevronRight, Folder, FileCode2, Eye, UploadCloud,
  ShieldCheck, Globe2, GitPullRequest, Tag, Search, ArrowLeft, Download
} from "lucide-react";
import { agentApi } from "@/lib/localAgent";
import { useProject } from "@/lib/projectStore";

const UPSTREAM = "https://github.com/MarlinFirmware/Marlin";
const CONFIG_REPO = "https://github.com/MarlinFirmware/Configurations";
const DEFAULT_BRANCH = "bugfix-2.1.x";
const DEFAULT_CONFIG_REF = "import-2.1.x";

export default function GitPanel(){
  const { currentProject, takeSnapshot } = useProject();
  const [tab,setTab]=useState("repos");
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState("");

  async function refresh(){
    try {
      setError("");
      const result=await agentApi.gitStatus();
      setData(result.git||result);
    } catch(e) { setError(e.message||"Git indisponible"); }
  }
  useEffect(()=>{ refresh(); },[]);

  async function pull(){
    setBusy(true); setError("");
    try {
      await agentApi.gitPull();
      await refresh();
      window.dispatchEvent(new Event("marlin-project-changed"));
    } catch(e) { setError(e.message||"git pull --ff-only impossible"); }
    finally { setBusy(false); }
  }

  async function copy(text){
    try { await navigator.clipboard?.writeText(text); } catch {}
    setCopied(text); window.setTimeout(()=>setCopied(""),1500);
  }

  const changes = data?.status || [];
  const branch = data?.branch || "—";
  const repository = Boolean(data?.repository);
  const remote = data?.remote_url || UPSTREAM;

  return <div className="h-full overflow-y-auto p-6">
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><GitBranch className="w-5 h-5"/>Git</h1>
          <p className="text-sm text-muted-foreground mt-1">Dépôts officiels Marlin, synchronisation Git et exemples de configuration.</p>
        </div>
        <button onClick={refresh} disabled={busy} className="p-2 rounded border hover:bg-accent disabled:opacity-40" title="Actualiser Git">
          <RefreshCw className={busy?"w-4 h-4 animate-spin":"w-4 h-4"}/>
        </button>
      </div>

      {error && <div className="flex gap-2 p-3 rounded border border-red-500/30 bg-red-500/5 text-sm text-red-600"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}

      <div className="inline-flex rounded-lg border border-border p-1 bg-muted/20">
        <TabButton active={tab==="repos"} onClick={()=>setTab("repos")} icon={GitBranch}>Dépôts & synchronisation</TabButton>
        <TabButton active={tab==="examples"} onClick={()=>setTab("examples")} icon={PackageSearch}>Exemples de configuration</TabButton>
      </div>

      {tab==="repos" ? <RepositoryTab data={data} remote={remote} repository={repository} branch={branch} changes={changes} busy={busy} pull={pull} copy={copy} copied={copied}/> : <ConfigurationsTab currentProject={currentProject} takeSnapshot={takeSnapshot}/>} 
    </div>
  </div>;
}

function TabButton({active,onClick,icon:Icon,children}){
  return <button onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${active?"bg-background shadow-sm font-medium":"text-muted-foreground hover:text-foreground"}`}><Icon className="w-4 h-4"/>{children}</button>
}

function RepositoryTab({data,remote,repository,branch,changes,busy,pull,copy,copied}){
  return <div className="space-y-5">
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <FolderGit2 className="w-5 h-5"/>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">MarlinFirmware / Marlin</div>
          <div className="text-xs text-muted-foreground font-mono truncate">{remote}</div>
        </div>
        <button onClick={()=>window.open(UPSTREAM,"_blank","noopener,noreferrer")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs"><ExternalLink className="w-3.5 h-3.5"/>GitHub</button>
        <button onClick={()=>copy(remote)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs">{copied===remote?<Check className="w-3.5 h-3.5"/>:<Copy className="w-3.5 h-3.5"/>}{copied===remote?"Copié":"Copier"}</button>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <Info label="Dépôt local" value={repository?"Détecté":"Non détecté"}/>
        <Info label="Branche" value={branch}/>
        <Info label="Commit" value={data?.commit||"—"}/>
        <Info label="État" value={repository?(data?.clean?"Propre":`${changes.length} modification(s)`):"—"}/>
      </div>
    </section>

    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold flex items-center gap-2"><GitPullRequest className="w-4 h-4"/>Synchronisation avec Marlin</div>
          <p className="text-xs text-muted-foreground mt-1">Le dépôt officiel utilise actuellement <code>{DEFAULT_BRANCH}</code> comme branche par défaut. Le Pull utilise <code>--ff-only</code> et ne réécrit pas le travail local.</p>
        </div>
        <button onClick={pull} disabled={busy || !repository || !data?.installed} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-40">
          <DownloadCloud className="w-4 h-4"/>{busy?"Mise à jour…":"Git Pull --ff-only"}
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <LinkCard title="Marlin Firmware" url={UPSTREAM}/>
        <LinkCard title="Marlin Configurations" url={CONFIG_REPO}/>
      </div>
    </section>

    <section className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between"><div className="font-semibold">Modifications locales</div><span className="text-xs text-muted-foreground">{changes.length}</span></div>
      {changes.length ? <div className="divide-y divide-border">{changes.map((line,i)=><div key={`${line}-${i}`} className="px-4 py-2 font-mono text-xs whitespace-pre-wrap">{line}</div>)}</div> : <div className="p-6 text-center text-sm text-muted-foreground">Aucune modification locale détectée.</div>}
    </section>
  </div>
}

function ConfigurationsTab({currentProject,takeSnapshot}){
  const [branches,setBranches]=useState([]);
  const [ref,setRef]=useState(DEFAULT_CONFIG_REF);
  const [path,setPath]=useState("config/examples");
  const [items,setItems]=useState(null);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const [preview,setPreview]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [importing,setImporting]=useState(false);
  const [message,setMessage]=useState("");
  const [suggestion,setSuggestion]=useState(null);

  const version=currentProject?.marlinVersion || "";
  const currentAuthoritative=currentProject?.parsedFiles?.["Config.h"] ? "Config.h" : currentProject?.parsedFiles?.["Configuration.h"] ? "Configuration.h" : "";

  async function loadBranches(){
    setLoading(true); setError("");
    try {
      const result=await agentApi.configurationsBranches();
      setBranches(result.branches||[]);
      try {
        const sug=await agentApi.configurationsSuggest(version);
        setSuggestion(sug);
        if (sug?.suggested_ref) setRef(sug.suggested_ref);
      } catch {}
    } catch(e) { setError(e.message||"Impossible de lire les branches de Configurations."); }
    finally { setLoading(false); }
  }
  async function load(pathOverride=path){
    const nextPath=pathOverride || "config/examples";
    setLoading(true); setError(""); setPreview(null); setSelected(null);
    try { setItems(await agentApi.configurationsExamples(ref,nextPath)); setPath(nextPath); }
    catch(e) { setError(e.message||"Impossible de charger les exemples."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ loadBranches(); },[]);
  useEffect(()=>{ if(ref) load(path); },[ref]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return (items?.directories||[]).filter(x=>!q || String(x.name).toLowerCase().includes(q));
  },[items,search]);

  async function openExample(dir){
    setLoading(true); setError("");
    try {
      const result=await agentApi.configurationsExample(ref,dir.path);
      setSelected({ ...dir, directories:result.directories||[], files:result.files||[] });
      setPath(dir.path);
      setPreview(null);
    } catch(e) { setError(e.message||"Impossible de lire cet exemple."); }
    finally { setLoading(false); }
  }

  async function openFile(file){
    setLoading(true); setError("");
    try { setPreview(await agentApi.configurationsFile(ref,file.path)); }
    catch(e) { setError(e.message||"Impossible de lire ce fichier."); }
    finally { setLoading(false); }
  }

  function goUp(){
    if(path==="config/examples") return;
    const parts=path.split("/"); parts.pop(); load(parts.join("/") || "config/examples"); setSelected(null);
  }

  async function importExample(){
    if(!selected || !currentProject) return;
    setImporting(true); setError(""); setMessage("");
    try {
      const files={};
      for(const file of selected.files||[]) {
        if(["Config.h","Configuration.h","Configuration_adv.h"].includes(file.name)) {
          const content=await agentApi.configurationsFile(ref,file.path);
          files[file.name]=content.content;
        }
      }
      const target=currentAuthoritative;
      if(!target) throw new Error("Aucun fichier de configuration Marlin actif dans le projet local.");
      if(target==="Config.h" && !files["Config.h"]) {
        throw new Error("Le projet utilise Config.h, mais cet exemple ne fournit pas Config.h. Import bloqué pour éviter une configuration qui serait ignorée par Marlin.");
      }
      if(target==="Configuration.h" && files["Config.h"] && !files["Configuration.h"]) {
        throw new Error("Cet exemple utilise Config.h alors que le projet local utilise Configuration.h. Import bloqué pour éviter un fichier non utilisé.");
      }
      const toWrite={};
      if(target==="Config.h") toWrite["Config.h"]=files["Config.h"];
      else {
        if(files["Configuration.h"]) toWrite["Configuration.h"]=files["Configuration.h"];
        if(currentProject.parsedFiles?.["Configuration_adv.h"] && files["Configuration_adv.h"]) toWrite["Configuration_adv.h"]=files["Configuration_adv.h"];
      }
      if(!Object.keys(toWrite).length) throw new Error("Aucun fichier compatible trouvé dans cet exemple.");
      takeSnapshot(currentProject.id,`Avant import exemple — ${selected.name}`);
      const expected=Object.fromEntries(Object.keys(toWrite).filter(k=>currentProject.localHashes?.[k]).map(k=>[k,currentProject.localHashes[k]]));
      await agentApi.applyConfiguration(toWrite,expected);
      window.dispatchEvent(new Event("marlin-project-changed"));
      setMessage("Exemple importé. Marlin Doctor sera la prochaine vérification recommandée avant Build.");
    } catch(e) { setError(e.message||"Import impossible."); }
    finally { setImporting(false); }
  }

  const breadcrumb=path.replace(/^config\/examples\/?/,'').split('/').filter(Boolean);

  return <div className="space-y-5">
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><PackageSearch className="w-5 h-5"/>Marlin Configurations</h2>
          <p className="text-xs text-muted-foreground mt-1">Exemples officiels issus de <code>MarlinFirmware/Configurations</code>, sélectionnés selon la branche de configuration.</p>
        </div>
        <button onClick={()=>window.open(CONFIG_REPO,"_blank","noopener,noreferrer")} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs"><ExternalLink className="w-3.5 h-3.5"/>Ouvrir le dépôt</button>
      </div>
      <div className="grid lg:grid-cols-[1.3fr_1fr_auto] gap-3 items-end">
        <div><label className="block text-xs font-medium mb-1">Branche / référence Configurations</label><select value={ref} onChange={e=>setRef(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm"><option value="">Choisir…</option>{branches.map(b=><option key={b.name} value={b.name}>{labelKind(b.kind)} · {b.name}</option>)}</select></div>
        <div><label className="block text-xs font-medium mb-1">Recherche d'imprimante / fabricant</label><div className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm" placeholder="Creality, Ender, AnyCubic…"/></div></div>
        <button onClick={()=>load(path)} disabled={loading || !ref} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-40"><RefreshCw className={loading?"w-4 h-4 animate-spin":"w-4 h-4"}/>Charger</button>
      </div>
      {suggestion?.suggested_ref && <div className="text-xs flex items-center gap-2 text-muted-foreground"><Tag className="w-3.5 h-3.5"/>Version Marlin détectée : <strong>{version || "inconnue"}</strong> · référence suggérée : <code>{suggestion.suggested_ref}</code></div>}
      {currentAuthoritative && <div className="text-xs flex items-center gap-2 text-muted-foreground"><ShieldCheck className="w-3.5 h-3.5"/>Configuration locale active : <code>{currentAuthoritative}</code>. L'import est bloqué lorsqu'un exemple cible un autre modèle de configuration.</div>}
    </section>

    {error && <div className="flex gap-2 p-3 rounded border border-red-500/30 bg-red-500/5 text-sm text-red-600"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}
    {message && <div className="flex gap-2 p-3 rounded border border-emerald-500/30 bg-emerald-500/5 text-sm text-emerald-600"><Check className="w-4 h-4 shrink-0"/>{message}</div>}

    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <button onClick={goUp} disabled={path==="config/examples" || loading} className="inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs disabled:opacity-30"><ArrowLeft className="w-3.5 h-3.5"/>Retour</button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-hidden"><span>config/examples</span>{breadcrumb.map(part=><React.Fragment key={part}><ChevronRight className="w-3 h-3 shrink-0"/><span className="font-medium text-foreground truncate">{part}</span></React.Fragment>)}</div>
      </div>
      {!items ? <div className="p-10 text-center text-sm text-muted-foreground">{loading?"Chargement des exemples…":"Sélectionne une branche pour commencer."}</div> : <div className="grid xl:grid-cols-[1.1fr_1fr] min-h-[420px]">
        <div className="border-r border-border">
          <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">{filtered.length} fabricant(s) / dossier(s)</div>
          <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
            {filtered.map(item=><button key={item.path} onClick={()=>openExample(item)} className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-accent ${selected?.path===item.path?"bg-accent":""}`}><Folder className="w-4 h-4 shrink-0 text-muted-foreground"/><span className="text-sm flex-1 truncate">{item.name}</span><ChevronRight className="w-4 h-4 text-muted-foreground"/></button>)}
            {!filtered.length && <div className="p-8 text-center text-sm text-muted-foreground">Aucun dossier correspondant.</div>}
          </div>
        </div>
        <div className="p-4">
          {!selected && <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground"><Globe2 className="w-8 h-8 mb-2"/><div>Sélectionne un fabricant ou un groupe d'exemples.</div><div className="text-xs mt-1">Les fichiers seront lus directement depuis le dépôt officiel.</div></div>}
          {selected && <div className="space-y-4">
            <div className="flex items-start gap-3"><Folder className="w-5 h-5 mt-0.5"/><div className="flex-1 min-w-0"><div className="font-semibold truncate">{selected.name}</div><div className="text-xs text-muted-foreground font-mono truncate">{selected.path}</div></div></div>
            <div className="space-y-2">
              {(selected.directories||[]).map(dir=><button key={dir.path} onClick={()=>openExample(dir)} className="w-full flex items-center gap-2 p-2.5 rounded border border-border hover:bg-accent text-left"><Folder className="w-4 h-4 text-muted-foreground"/><div className="flex-1 min-w-0"><div className="text-sm truncate">{dir.name}</div><div className="text-[11px] text-muted-foreground">Sous-dossier</div></div><ChevronRight className="w-4 h-4 text-muted-foreground"/></button>)}
              {(selected.files||[]).map(file=><div key={file.path} className="flex items-center gap-2 p-2.5 rounded border border-border"><FileCode2 className="w-4 h-4 text-muted-foreground"/><div className="flex-1 min-w-0"><div className="text-sm truncate">{file.name}</div><div className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</div></div><button onClick={()=>openFile(file)} className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs"><Eye className="w-3 h-3"/>Aperçu</button><button onClick={()=>window.open(file.html_url,"_blank","noopener,noreferrer")} className="p-1.5 rounded border" title="GitHub"><ExternalLink className="w-3 h-3"/></button></div>)}
              {!selected.directories?.length && !selected.files?.length && <div className="text-sm text-muted-foreground">Aucun fichier ou sous-dossier de configuration directement visible dans ce dossier.</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={importExample} disabled={importing || !currentProject || !selected.files?.some(f=>["Config.h","Configuration.h","Configuration_adv.h"].includes(f.name))} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-40"><UploadCloud className="w-4 h-4"/>{importing?"Import…":"Importer dans le projet"}</button>
              <button onClick={()=>window.open(`https://github.com/MarlinFirmware/Configurations/tree/${encodeURIComponent(ref)}/${selected.path.replaceAll(" ","%20")}`,"_blank","noopener,noreferrer")} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm"><ExternalLink className="w-4 h-4"/>Voir sur GitHub</button>
            </div>
            <div className="text-xs text-muted-foreground">Un snapshot local est créé avant chaque import. Après import, utilise <strong>Marlin Doctor</strong> avant Build.</div>
          </div>}
        </div>
      </div>}
    </section>

    {preview && <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2"><FileCode2 className="w-4 h-4"/><div className="font-semibold text-sm flex-1">{preview.name}</div><button onClick={()=>downloadText(preview.name,preview.content)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs"><Download className="w-3.5 h-3.5"/>Télécharger</button></div>
      <pre className="p-4 max-h-[520px] overflow-auto text-[11px] leading-5 font-mono whitespace-pre">{preview.content}</pre>
    </section>}
  </div>
}

function labelKind(kind){ return ({release:"Release",lts:"LTS",development:"Development",import:"Import"}[kind]||kind); }
function formatBytes(v){ const n=Number(v||0); if(n<1024) return `${n} o`; if(n<1024*1024) return `${(n/1024).toFixed(1)} Ko`; return `${(n/1024/1024).toFixed(1)} Mo`; }
function downloadText(name,content){ const blob=new Blob([content],{type:"text/plain;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name||"configuration.txt"; a.click(); URL.revokeObjectURL(url); }
function Info({label,value}){return <div className="rounded border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-mono text-sm mt-1 truncate">{value}</div></div>}
function LinkCard({title,url}){return <div className="rounded border p-3 flex items-center gap-2"><Globe2 className="w-4 h-4 text-muted-foreground"/><div className="flex-1 min-w-0"><div className="font-medium">{title}</div><div className="font-mono text-[11px] text-muted-foreground truncate">{url}</div></div><button onClick={()=>window.open(url,"_blank","noopener,noreferrer")} className="p-1.5 rounded border"><ExternalLink className="w-3 h-3"/></button></div>}
