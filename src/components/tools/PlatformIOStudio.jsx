import React, { useEffect, useMemo, useState } from "react";
import { Cpu, Save, RefreshCw, AlertTriangle, CheckCircle2, Terminal } from "lucide-react";
import { agentApi } from "@/lib/localAgent";

const KNOWN_PLATFORMS = ["atmelavr", "atmelsam", "espressif32", "espressif8266", "teensy", "stm32", "ststm32", "ststm32@latest", "renesas-ra", "raspberrypi", "native", "custom"];
const KNOWN_FRAMEWORKS = ["arduino", "stm32cube", "mbed", "espidf", "zephyr", "native", "custom"];
const KNOWN_PROTOCOLS = ["arduino", "avrispmkii", "blackmagic", "cmsis-dap", "dfu", "jlink", "mbed", "picoware", "stlink", "teensy-cli", "usbasp", "custom"];
const COMMON_BOARDS = [
  "megaatmega2560", "megaatmega1280", "rambo", "rumba", "mks_robin_nano35", "mks_robin_nano", "mks_robin_pro", "mks_robin_e3", "mks_robin_e3p", "STM32F103RC_btt", "STM32F401VE_BTT", "STM32F411VE_BTT", "STM32G0B1RE_btt", "STM32G0B1RE_btt_USB", "esp32dev", "esp32-s3-devkitc-1", "teensy41", "custom"
];

function parseIni(text) {
  const lines = String(text || "").split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (m) {
      current = { name: m[1], values: {} };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const kv = line.match(/^\s*([A-Za-z0-9_.:-]+)\s*=\s*(.*?)\s*$/);
    if (kv) current.values[kv[1]] = kv[2];
  }
  return sections;
}

function getSection(sections, name) {
  return sections.find(s => s.name === name) || { name, values: {} };
}

function setIniValue(text, sectionName, key, value) {
  const lines = String(text || "").split(/\r?\n/);
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\[([^\]]+)\]\s*$/);
    if (m) {
      if (m[1] === sectionName) start = i;
      else if (start >= 0) { end = i; break; }
    }
  }
  if (start < 0) {
    const prefix = lines.length && lines[lines.length - 1] === "" ? [] : [""];
    return [...lines, ...prefix, `[${sectionName}]`, `${key} = ${value}`].join("\n");
  }
  const re = new RegExp(`^(\\s*)${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*=`);
  for (let i = start + 1; i < end; i++) {
    if (re.test(lines[i])) {
      lines[i] = `${lines[i].match(/^\s*/)?.[0] || ""}${key} = ${value}`;
      return lines.join("\n");
    }
  }
  let insert = end;
  while (insert > start + 1 && lines[insert - 1].trim() === "") insert--;
  lines.splice(insert, 0, `${key} = ${value}`);
  return lines.join("\n");
}

function removeIniValue(text, sectionName, key) {
  const lines = String(text || "").split(/\r?\n/);
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\[([^\]]+)\]\s*$/);
    if (m) {
      if (m[1] === sectionName) start = i;
      else if (start >= 0) { end = i; break; }
    }
  }
  if (start < 0) return text;
  const re = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*=`);
  for (let i = start + 1; i < end; i++) if (re.test(lines[i])) { lines.splice(i, 1); break; }
  return lines.join("\n");
}

export default function PlatformIOStudio() {
  const [content, setContent] = useState("");
  const [sha, setSha] = useState("");
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState({ platform: "", framework: "", board: "", upload_protocol: "" });
  const [operation, setOperation] = useState("");
  const [operationOutput, setOperationOutput] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try {
      const r = await agentApi.readFile("platformio.ini");
      setContent(r.content || ""); setSha(r.sha256 || "");
      const parsed = parseIni(r.content || "");
      setSections(parsed);
      const envs = parsed.filter(s => s.name.startsWith("env:")).map(s => s.name);
      const currentDefault = parsed.find(s => s.name === "platformio")?.values?.default_envs?.split(/[;,\s]+/)[0];
      setSelected(currentDefault ? `env:${currentDefault}` : envs[0] || parsed[0]?.name || "platformio");
      setMsg("platformio.ini chargé");
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);
  const section = useMemo(() => getSection(sections, selected), [sections, selected]);
  const v = (key, fallback = "") => section.values?.[key] ?? fallback;
  const envNames = sections.filter(s => s.name.startsWith("env:")).map(s => s.name);

  const update = (key, value) => {
    const next = setIniValue(content, selected, key, value);
    setContent(next);
    setSections(parseIni(next));
  };
  const updateChoice = (key, value, choices, customKey = key) => {
    if (value === "custom") setCustom(c => ({ ...c, [customKey]: v(key) }));
    else update(key, value);
  };


  const selectedEnvironment = selected.startsWith("env:") ? selected.slice(4) : "";

  const runPlatformIO = async (kind) => {
    if (!selectedEnvironment) { setError("Sélectionne d'abord un environnement [env:*]."); return; }
    setOperation(kind); setError(""); setOperationOutput("");
    try {
      let result;
      if (kind === "build") result = await agentApi.build(selectedEnvironment);
      else if (kind === "clean") result = await agentApi.clean(selectedEnvironment);
      else if (kind === "upload") result = await agentApi.upload(selectedEnvironment, v("upload_port") || undefined);
      else result = await agentApi.buildUpload(selectedEnvironment, v("upload_port") || undefined);
      setOperationOutput(result?.output || result?.message || JSON.stringify(result, null, 2));
      setMsg(`✓ PlatformIO ${kind} terminé`);
    } catch (e) { setError(`PlatformIO ${kind} : ${e.message || e}`); setOperationOutput(e?.data?.output || ""); }
    finally { setOperation(""); }
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      if (!currentProject?.localProjectPath) throw new Error("Aucun projet local sélectionné.");
      await agentApi.selectProject(currentProject.localProjectPath);
      const r = await agentApi.writeFile("platformio.ini", content, sha, true);
      setSha(r.sha256 || "");
      setMsg("✓ platformio.ini enregistré — sauvegarde .bak créée");
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  };

  const defaultEnv = getSection(sections, "platformio").values?.default_envs || "";
  if (!content && error) return <div className="p-6"><div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5"><AlertTriangle className="w-5 h-5 inline mr-2"/>{error}<button onClick={load} className="ml-4 px-3 py-1.5 rounded border">Réessayer</button></div></div>;

  return <div className="h-full overflow-auto p-5"><div className="max-w-6xl mx-auto space-y-5">
    <header className="flex items-start justify-between gap-4"><div><h1 className="text-xl font-semibold flex items-center gap-2"><Cpu className="w-5 h-5 text-primary"/>PlatformIO Studio</h1><p className="text-sm text-muted-foreground mt-1">Configure et enregistre réellement le fichier <code>platformio.ini</code> de ton projet Marlin.</p></div><button onClick={load} disabled={busy} className="px-3 py-2 rounded border flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Actualiser</button></header>

    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
    {msg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{msg}</div>}

    <section className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Environnement PlatformIO</h2><span className="text-xs text-muted-foreground">{envNames.length} environnement(s) détecté(s)</span></div>
      <label className="block text-sm"><span className="font-medium">Section à configurer</span><select value={selected} onChange={e=>setSelected(e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background font-mono">{sections.map(s=><option key={s.name} value={s.name}>{s.name}{s.name.startsWith("env:") ? " — environnement" : ""}</option>)}</select></label>
      {selected.startsWith("env:") && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        <label className="text-sm">Platform<select value={KNOWN_PLATFORMS.includes(v("platform")) ? v("platform") : (v("platform") ? "custom" : "")} onChange={e=>updateChoice("platform",e.target.value,KNOWN_PLATFORMS,"platform")} className="w-full mt-1 px-3 py-2 rounded border bg-background">{KNOWN_PLATFORMS.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="text-sm">Framework<select value={KNOWN_FRAMEWORKS.includes(v("framework")) ? v("framework") : (v("framework") ? "custom" : "")} onChange={e=>updateChoice("framework",e.target.value,KNOWN_FRAMEWORKS,"framework")} className="w-full mt-1 px-3 py-2 rounded border bg-background">{KNOWN_FRAMEWORKS.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="text-sm">Board<select value={COMMON_BOARDS.includes(v("board")) ? v("board") : (v("board") ? "custom" : "")} onChange={e=>updateChoice("board",e.target.value,COMMON_BOARDS,"board")} className="w-full mt-1 px-3 py-2 rounded border bg-background font-mono">{COMMON_BOARDS.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="text-sm">Upload protocol<select value={KNOWN_PROTOCOLS.includes(v("upload_protocol")) ? v("upload_protocol") : (v("upload_protocol") ? "custom" : "")} onChange={e=>updateChoice("upload_protocol",e.target.value,KNOWN_PROTOCOLS,"upload_protocol")} className="w-full mt-1 px-3 py-2 rounded border bg-background">{KNOWN_PROTOCOLS.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="text-sm">Upload speed<input type="number" value={v("upload_speed")} onChange={e=>update("upload_speed",e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background" placeholder="115200"/></label>
        <label className="text-sm">Monitor speed<input type="number" value={v("monitor_speed")} onChange={e=>update("monitor_speed",e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background" placeholder="115200"/></label>
        <label className="text-sm">Port d'upload<input value={v("upload_port")} onChange={e=>update("upload_port",e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background font-mono" placeholder="/dev/ttyUSB0 ou COM3"/></label>
        <label className="text-sm">Build type<select value={v("build_type")} onChange={e=>update("build_type",e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background"><option value="">Par défaut</option><option value="debug">debug</option><option value="release">release</option></select></label>
      </div>}
      {selected.startsWith("env:") && (v("platform") === "custom" || custom.platform) && <input value={custom.platform || v("platform")} onChange={e=>{setCustom(c=>({...c,platform:e.target.value}));update("platform",e.target.value)}} className="w-full px-3 py-2 rounded border font-mono" placeholder="Plateforme PlatformIO personnalisée"/>}
      {selected.startsWith("env:") && (v("framework") === "custom" || custom.framework) && <input value={custom.framework || v("framework")} onChange={e=>{setCustom(c=>({...c,framework:e.target.value}));update("framework",e.target.value)}} className="w-full px-3 py-2 rounded border font-mono" placeholder="Framework personnalisé"/>}
      {selected.startsWith("env:") && (v("board") === "custom" || custom.board) && <input value={custom.board || v("board")} onChange={e=>{setCustom(c=>({...c,board:e.target.value}));update("board",e.target.value)}} className="w-full px-3 py-2 rounded border font-mono" placeholder="Identifiant board PlatformIO"/>}
      {selected.startsWith("env:") && (v("upload_protocol") === "custom" || custom.upload_protocol) && <input value={custom.upload_protocol || v("upload_protocol")} onChange={e=>{setCustom(c=>({...c,upload_protocol:e.target.value}));update("upload_protocol",e.target.value)}} className="w-full px-3 py-2 rounded border font-mono" placeholder="Protocole personnalisé"/>}
    </section>

    <section className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-semibold">Configuration globale</h2><label className="text-sm">default_envs<select value={defaultEnv.split(/[;,\s]+/).filter(Boolean)[0] || ""} onChange={e=>update("default_envs",e.target.value)} className="w-full mt-1 px-3 py-2 rounded border bg-background font-mono"><option value="">Aucun</option>{envNames.map(e=><option key={e} value={e.replace(/^env:/," ").trim()}>{e.replace(/^env:/," ")}</option>)}</select></label></section>

    {selected.startsWith("env:") && <section className="grid md:grid-cols-2 gap-4"><label className="rounded-xl border bg-card p-4 text-sm">build_flags<textarea value={v("build_flags")} onChange={e=>update("build_flags",e.target.value)} rows={7} className="w-full mt-2 px-3 py-2 rounded border bg-background font-mono text-xs" placeholder="-D OPTION=VALUE"/></label><label className="rounded-xl border bg-card p-4 text-sm">lib_deps<textarea value={v("lib_deps")} onChange={e=>update("lib_deps",e.target.value)} rows={7} className="w-full mt-2 px-3 py-2 rounded border bg-background font-mono text-xs" placeholder="library/id@version"/></label></section>}

    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold mb-2">Résumé de la section</h2><pre className="bg-black/80 text-green-300 rounded p-3 text-xs whitespace-pre-wrap overflow-auto">{Object.entries(section.values || {}).map(([k,val])=>`${k} = ${val}`).join("\n") || "Aucun paramètre détecté."}</pre></section>
    <section className="rounded-xl border bg-card p-4 space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Build / Upload PlatformIO</h2><span className="text-xs text-muted-foreground">env: {selectedEnvironment || "—"}</span></div><div className="flex flex-wrap gap-2"><button onClick={() => runPlatformIO("clean")} disabled={!!operation || !selectedEnvironment} className="px-3 py-2 rounded border disabled:opacity-40">Clean</button><button onClick={() => runPlatformIO("build")} disabled={!!operation || !selectedEnvironment} className="px-3 py-2 rounded bg-primary text-primary-foreground disabled:opacity-40">Build</button><button onClick={() => runPlatformIO("upload")} disabled={!!operation || !selectedEnvironment} className="px-3 py-2 rounded border disabled:opacity-40">Upload</button><button onClick={() => runPlatformIO("build-upload")} disabled={!!operation || !selectedEnvironment} className="px-3 py-2 rounded border border-primary/40 disabled:opacity-40">Build + Upload</button></div>{operation && <div className="text-xs text-muted-foreground">Opération en cours : {operation}…</div>}{operationOutput && <pre className="max-h-72 overflow-auto bg-black/90 text-green-300 rounded p-3 text-xs whitespace-pre-wrap">{operationOutput}</pre>}</section>
    <div className="sticky bottom-3 flex items-center justify-between rounded-xl border bg-card/95 backdrop-blur p-3 shadow-lg"><div className="text-xs text-muted-foreground flex items-center gap-2"><Terminal className="w-4 h-4"/>Écriture réelle avec contrôle SHA-256 et sauvegarde <code>.bak</code>.</div><button onClick={save} disabled={busy || !content} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4"/>{busy ? "Enregistrement…" : "Enregistrer platformio.ini"}</button></div>
  </div></div>;
}
