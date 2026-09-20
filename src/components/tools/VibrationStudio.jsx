import React, { useEffect, useMemo, useState } from "react";
import { agentApi } from "@/lib/localAgent";
import { useProject } from "@/lib/projectStore";
import { Activity, Download, Save, Play, Square, Wand2, ShieldCheck, AlertTriangle, Gauge, Radio, FileCode2, BarChart3, Upload, FileText, RotateCcw } from "lucide-react";

const AXES = ["X", "Y", "Z"];
const SHAPERS = [
  [0, "NONE"], [1, "ZV"], [2, "ZVD"], [3, "ZVDD"], [4, "ZVDDD"],
  [5, "EI"], [6, "2HEI"], [7, "3HEI"], [8, "MZV"],
];

function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function hasDefine(text, name) { return new RegExp(`^\\s*#\\s*define\\s+${name}\\b`, "m").test(text || ""); }
function setDefine(text, name, value = null) {
  const line = value == null ? `#define ${name}` : `#define ${name} ${value}`;
  const re = new RegExp(`^\\s*#\\s*define\\s+${name}\\b.*$`, "m");
  const commented = new RegExp(`^\\s*//\\s*#\\s*define\\s+${name}\\b.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  if (commented.test(text)) return text.replace(commented, line);
  return `${text.replace(/\s*$/, "")}\\n\\n${line}\\n`;
}

function buildM593Sweep({ axis, from, to, step, zeta, startX = 10, endX = 190, y = 100, feed = 6000 }) {
  const lines = ["; Marlin Flow Studio - M593 Input Shaping Frequency Sweep", `; Axis: ${axis} | ${from}-${to} Hz | step ${step} Hz`, "G90", "M400", "M593 F0", `G1 X${startX} Y${y} F${feed}`];
  let x = startX, dir = 1;
  for (let f = from; f <= to + 1e-6; f += step) {
    lines.push(`M593 ${axis} F${f.toFixed(2)} D${zeta.toFixed(3)}`);
    x += dir * Math.min(10, endX - startX);
    if (x >= endX || x <= startX) dir *= -1;
    lines.push(`G1 X${x.toFixed(2)} Y${(y + (f - from) * 0.8).toFixed(2)} F${feed}`);
  }
  lines.push("M593 F0", "M400", "; Inspect ringing and record the frequency with the least ringing.");
  return lines.join("\n") + "\n";
}

function buildRingingTower({ axis, from, to, height, layer, startSpeed, endSpeed }) {
  const layers = Math.max(1, Math.floor(height / layer));
  const lines = ["; Marlin Flow Studio - Ringing Tower helper", `; Axis ${axis} | ${from}-${to} Hz`, "G90", "M400", "M593 F0"];
  for (let i = 0; i < layers; i++) {
    const z = ((i + 1) * layer).toFixed(3);
    const f = from + (to - from) * (i / Math.max(1, layers - 1));
    const speed = startSpeed + (endSpeed - startSpeed) * (i / Math.max(1, layers - 1));
    lines.push(`G1 Z${z} F600`);
    lines.push(`M593 ${axis} F${f.toFixed(2)}`);
    lines.push(`; layer ${i + 1}/${layers} ~ ${f.toFixed(2)} Hz`);
    lines.push(`G1 X10 Y10 F${Math.round(speed * 60)}`);
    lines.push(`G1 X190 Y10 F${Math.round(speed * 60)}`);
    lines.push(`G1 X190 Y190 F${Math.round(speed * 60)}`);
    lines.push(`G1 X10 Y190 F${Math.round(speed * 60)}`);
  }
  lines.push("M593 F0", "M400");
  return lines.join("\n") + "\n";
}

function parseSensorCsv(text) {
  const raw = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (raw.length < 16) throw new Error("CSV insuffisant : au moins 16 lignes sont nécessaires.");
  const delimiter = raw[0].includes(";") ? ";" : (raw[0].includes("\t") ? "\t" : ",");
  const first = raw[0].split(delimiter).map(v => v.trim().toLowerCase());
  const hasHeader = first.some(v => /time|temps|timestamp|acc|accel|x|y|z/.test(v)) && first.some(v => Number.isNaN(Number(v)));
  const rows = raw.slice(hasHeader ? 1 : 0).map(r => r.split(delimiter).map(Number)).filter(r => r.every(Number.isFinite));
  if (rows.length < 16 || rows.some(r => r.length < 2)) throw new Error("CSV invalide. Format attendu : temps,accélération ou temps,X,Y,Z.");
  const columns = rows[0].length >= 4 ? [1,2,3] : [1];
  const names = columns.map((c,i) => rows[0].length >= 4 ? ["X","Y","Z"][i] : "A");
  return { rows, columns, names, hasHeader };
}

function fftSpectrum(values, sampleRate) {
  let n = 1; while (n * 2 <= values.length && n < 4096) n *= 2;
  const x = values.slice(0, n).map(Number);
  const mean = x.reduce((a,b)=>a+b,0)/n;
  for (let i=0;i<n;i++) x[i]=(x[i]-mean)*(0.5-0.5*Math.cos(2*Math.PI*i/(n-1 || 1)));
  let re=x.slice(), im=new Array(n).fill(0);
  for (let i=1,j=0;i<n;i++) { let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j)[re[i],re[j]]=[re[j],re[i]]; }
  for(let len=2;len<=n;len<<=1){ const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang); for(let i=0;i<n;i+=len){ let ur=1,ui=0; for(let j=0;j<len/2;j++){ const k=i+j+len/2, tr=re[k]*ur-im[k]*ui, ti=re[k]*ur+im[k]*ui; re[k]=re[i+j]-tr; im[k]=im[i+j]-ti; re[i+j]+=tr; im[i+j]+=ti; const nur=ur*wr-ui*wi; ui=ur*wi+ui*wr; ur=nur; } } }
  const out=[]; for(let k=1;k<n/2;k++){ const f=k*sampleRate/n; if(f>200) break; out.push({f, p:(re[k]*re[k]+im[k]*im[k])/n}); }
  const max=out.reduce((m,v)=>Math.max(m,v.p),0) || 1;
  return out.map(v=>({...v, level:v.p/max}));
}

function analyzeSensor(text) {
  const parsed=parseSensorCsv(text);
  const dt=parsed.rows.slice(1).reduce((s,r,i)=>s+(r[0]-parsed.rows[i][0]),0)/(parsed.rows.length-1);
  if(!(dt>0)) throw new Error("Colonne temps invalide ou non croissante.");
  const fs=1/dt;
  const axes=parsed.columns.map((c,i)=>{
    const spectrum=fftSpectrum(parsed.rows.map(r=>r[c]),fs);
    const peaks=spectrum.slice().sort((a,b)=>b.p-a.p).filter((v,idx,arr)=>idx<8 && v.f>=2).slice(0,5);
    const dominant=peaks[0] || {f:0,p:0};
    return {axis:parsed.names[i], frequency:dominant.f, peaks, spectrum};
  });
  return {sampleRate:fs,samples:parsed.rows.length,axes};
}


export default function VibrationStudio() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState("tune");
  const [axis, setAxis] = useState("X");
  const [freq, setFreq] = useState({ X: 40, Y: 40, Z: 20 });
  const [zeta, setZeta] = useState({ X: 0.15, Y: 0.15, Z: 0.05 });
  const [shaper, setShaper] = useState({ X: 1, Y: 1, Z: 0 });
  const [from, setFrom] = useState(15), [to, setTo] = useState(60), [step, setStep] = useState(1);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState(null);
  const [vtol, setVtol] = useState({ X: 0.05, Y: 0.05, Z: 0.05 });
  const [sensorAxis, setSensorAxis] = useState("X");
  const [status, setStatus] = useState("");
  const [configs, setConfigs] = useState({});
  const [playing, setPlaying] = useState(false);

  const projectLabel = currentProject?.name || "Projet Marlin";
  const configTargets = useMemo(() => ["Configuration.h", "Configuration_adv.h"], []);

  async function loadConfig() {
    const next = {};
    const found = [];
    for (const file of configTargets) {
      try {
        const r = await agentApi.readConfiguration(file);
        if (r?.content != null) {
          next[file] = r;
          found.push(file);
        }
      } catch (_) {
        // One of the two legacy files may not exist in Config.h-based projects.
      }
    }
    setConfigs(next);
    const preferred = next["Configuration_adv.h"] || next["Configuration.h"];
    const text = preferred?.content || "";
    const read = (name, fallback) => { const m = text.match(new RegExp(`^\\s*#\\s*define\\s+${name}\\s+([^\\s/]+)`, "m")); return m ? m[1] : fallback; };
    setFreq({ X: num(read("SHAPING_FREQ_X", 40), 40), Y: num(read("SHAPING_FREQ_Y", 40), 40), Z: num(read("SHAPING_FREQ_Z", 20), 20) });
    setZeta({ X: num(read("SHAPING_ZETA_X", 0.15), 0.15), Y: num(read("SHAPING_ZETA_Y", 0.15), 0.15), Z: num(read("SHAPING_ZETA_Z", 0.05), 0.05) });
    setVtol({ X: num(read("FTM_SHAPING_V_TOL_X", 0.05), 0.05), Y: num(read("FTM_SHAPING_V_TOL_Y", 0.05), 0.05), Z: num(read("FTM_SHAPING_V_TOL_Z", 0.05), 0.05) });
    setStatus(found.length ? `Configurations chargées : ${found.join(" + ")}` : "Aucun Configuration.h / Configuration_adv.h trouvé. Vérifie le projet Marlin sélectionné.");
  }

  useEffect(() => { loadConfig(); }, [currentProject?.id]);

  function buildVibrationBlock(includeFTM = false) {
    return [
      "// ===== Marlin Flow Studio - VIBRATION / INPUT SHAPING =====",
      "// Profil synchronisé dans Configuration.h et Configuration_adv.h.",
      "// Les garde-fous évitent une redéfinition si les deux fichiers sont inclus.",
      "#ifndef INPUT_SHAPING_X",
      "#define INPUT_SHAPING_X",
      "#endif",
      "#ifndef INPUT_SHAPING_Y",
      "#define INPUT_SHAPING_Y",
      "#endif",
      `#ifndef SHAPING_FREQ_X\n#define SHAPING_FREQ_X ${num(freq.X,40)}\n#endif`,
      `#ifndef SHAPING_FREQ_Y\n#define SHAPING_FREQ_Y ${num(freq.Y,40)}\n#endif`,
      `#ifndef SHAPING_ZETA_X\n#define SHAPING_ZETA_X ${num(zeta.X,0.15)}f\n#endif`,
      `#ifndef SHAPING_ZETA_Y\n#define SHAPING_ZETA_Y ${num(zeta.Y,0.15)}f\n#endif`,
      ...(includeFTM ? AXES.filter(a => a !== "Z").flatMap(a => [
        "#ifndef FT_MOTION",
        "#define FT_MOTION",
        "#endif",
        `#ifndef FTM_DEFAULT_SHAPER_${a}\n#define FTM_DEFAULT_SHAPER_${a} ftMotionShaper_${SHAPERS.find(s => s[0] === Number(shaper[a]))?.[1] || "ZV"}\n#endif`,
        `#ifndef FTM_SHAPING_DEFAULT_FREQ_${a}\n#define FTM_SHAPING_DEFAULT_FREQ_${a} ${num(freq[a],40)}.0f\n#endif`,
        `#ifndef FTM_SHAPING_ZETA_${a}\n#define FTM_SHAPING_ZETA_${a} ${num(zeta[a],0.15)}f\n#endif`,
        `#ifndef FTM_SHAPING_V_TOL_${a}\n#define FTM_SHAPING_V_TOL_${a} ${num(vtol[a],0.05)}f\n#endif`,
      ]) : []),
      "// ==========================================================",
      ""
    ].join("\n");
  }

  function upsertVibrationBlock(text, includeFTM = false) {
    const marker = "// ===== Marlin Flow Studio - VIBRATION / INPUT SHAPING =====";
    const block = buildVibrationBlock(includeFTM);
    const re = new RegExp(`${marker.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\n[\\s\\S]*?// ==========================================================\\n?`, "m");
    if (re.test(text)) return text.replace(re, block);
    return `${text.replace(/\s*$/, "")}\n\n${block}`;
  }

  async function saveClassic() {
    const available = configTargets.filter(f => configs[f]?.content != null);
    if (!available.length) return setStatus("Charge d'abord Configuration.h et Configuration_adv.h.");
    const results = [];
    try {
      for (const file of available) {
        const current = configs[file];
        const content = upsertVibrationBlock(current.content);
        const r = await agentApi.writeConfiguration(file, content, current.sha256);
        results.push(file);
        setConfigs(prev => ({ ...prev, [file]: { ...current, content, sha256: r.sha256 } }));
      }
      setStatus(`✓ Prise en charge Input Shaping synchronisée dans : ${results.join(" + ")}.`);
    } catch (e) { setStatus(e.message || "Échec de l'intégration dans les fichiers de configuration."); }
  }

  async function saveFTM() {
    const available = configTargets.filter(f => configs[f]?.content != null);
    if (!available.length) return setStatus("Charge d'abord les deux fichiers de configuration.");
    const results = [];
    try {
      for (const file of available) {
        const current = configs[file];
        const content = upsertVibrationBlock(current.content, true);
        const r = await agentApi.writeConfiguration(file, content, current.sha256);
        results.push(file);
        setConfigs(prev => ({ ...prev, [file]: { ...current, content, sha256: r.sha256 } }));
      }
      setStatus(`✓ Input Shaping + Fixed-Time Motion synchronisés dans : ${results.join(" + ")}. Vérifie la capacité CPU/RAM de la carte avant compilation.`);
    } catch (e) { setStatus(e.message || "Échec de l'intégration FTM."); }
  }

  async function sendM593() {
    try {
      await agentApi.serialSend(`M593 ${axis} F${freq[axis]} D${zeta[axis]}`);
      setStatus(`✓ M593 envoyé sur ${axis} à ${freq[axis]} Hz.`);
    } catch (e) { setStatus(e.message || "Envoi série impossible."); }
  }

  async function sendM493() {
    try {
      const code = Number(shaper[axis]);
      await agentApi.serialSend(`M493 S1 ${axis} C${code} A${freq[axis]} I${zeta[axis]}`);
      setStatus(`✓ M493 envoyé : ${axis}, ${SHAPERS.find(s=>s[0]===code)?.[1]}, ${freq[axis]} Hz.`);
    } catch (e) { setStatus(e.message || "Envoi série impossible."); }
  }

  function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }

  async function runSweep() {
    const g = buildM593Sweep({ axis, from: num(from,15), to: num(to,60), step: num(step,1), zeta: zeta[axis] });
    download(`M593-${axis}-sweep.gcode`, g);
    try { setPlaying(true); await agentApi.serialSend("M593 F0"); setStatus("✓ Sweep généré. Le fichier G-code est prêt ; l'envoi automatique n'est pas lancé pour éviter un mouvement non supervisé."); } catch { setStatus("✓ Sweep G-code généré."); } finally { setPlaying(false); }
  }

  function analyzeCsv() { try { const r=analyzeSensor(csv); setResult(r); if(r.axes[0]) setSensorAxis(r.axes[0].axis); setStatus(`✓ Analyse FFT terminée : ${r.axes.map(a=>`${a.axis} ${a.frequency.toFixed(2)} Hz`).join(" · ")}`); } catch(e) { setStatus(e.message); } }
  function importCsvFile(file) { if(!file) return; const reader=new FileReader(); reader.onload=()=>{ setCsv(String(reader.result||"")); setStatus(`✓ ${file.name} chargé.`); }; reader.onerror=()=>setStatus("Impossible de lire le fichier CSV."); reader.readAsText(file); }
  function applySensorResult() { if(!result) return; const next={...freq}; result.axes.forEach(a=>{ if(["X","Y","Z"].includes(a.axis) && a.frequency>0) next[a.axis]=Number(a.frequency.toFixed(2)); }); setFreq(next); setStatus("✓ Fréquences dominantes appliquées aux axes."); }
  function downloadAnalysis() { if(!result) return; download("vibration-analysis.json", JSON.stringify(result,null,2)); }

  const card = "rounded-xl border border-border bg-card p-4";
  return <div className="h-full overflow-y-auto p-5 bg-background">
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Activity className="w-6 h-6"/><h1 className="text-xl font-semibold">Vibration Studio</h1></div><p className="text-sm text-muted-foreground mt-1">Réglage du ringing, Input Shaping et Fixed-Time Motion pour {projectLabel}.</p></div>
        <div className="flex gap-2"><button onClick={loadConfig} className="px-3 py-2 rounded-lg border border-border text-sm flex items-center gap-2"><Radio className="w-4 h-4"/>Relire Marlin</button><button onClick={()=>{setResult(null);setCsv("");setStatus("Analyse capteur réinitialisée.");}} className="px-3 py-2 rounded-lg border border-border text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4"/>Réinitialiser analyse</button></div>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/><span>Le studio prépare et applique des paramètres Marlin, mais ne mesure pas physiquement les vibrations sans capteur externe. Pour le réglage réel, utilise un test de fréquence, une ringing tower ou des données d'accéléromètre.</span></div>
      <div className="flex gap-2 border-b border-border">{[["tune","Réglage"],["config","Configurations"],["sweep","Tests G-code"],["ftm","FT Motion"],["sensor","Accéléromètre CSV"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`px-3 py-2 text-sm ${tab===id?"border-b-2 border-primary font-medium":"text-muted-foreground"}`}>{label}</button>)}</div>

      {tab === "tune" && <div className="grid lg:grid-cols-3 gap-4">
        <div className={card+" lg:col-span-2"}><h2 className="font-medium mb-3">Fréquences de résonance</h2><div className="grid md:grid-cols-3 gap-3">{AXES.map(a=><div key={a} className="rounded-lg border p-3"><div className="font-medium mb-2">Axe {a}</div><label className="text-xs text-muted-foreground">Fréquence (Hz)</label><input type="number" min="1" max="200" step="0.1" value={freq[a]} onChange={e=>setFreq({...freq,[a]:e.target.value})} className="w-full mt-1 px-2 py-1.5 rounded border bg-background"/><label className="text-xs text-muted-foreground block mt-2">Zeta / amortissement</label><input type="number" min="0" max="1" step="0.01" value={zeta[a]} onChange={e=>setZeta({...zeta,[a]:e.target.value})} className="w-full mt-1 px-2 py-1.5 rounded border bg-background"/></div>)}</div><div className="flex flex-wrap gap-2 mt-4"><button onClick={saveClassic} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex gap-2 items-center"><Save className="w-4 h-4"/>Intégrer ZV X/Y</button><button onClick={sendM593} className="px-3 py-2 rounded-lg border text-sm flex gap-2 items-center"><Play className="w-4 h-4"/>Tester M593</button></div></div>
        <div className={card}><h2 className="font-medium mb-3">Axe sélectionné</h2><div className="flex gap-2">{AXES.map(a=><button key={a} onClick={()=>setAxis(a)} className={`flex-1 py-2 rounded border ${axis===a?"bg-primary text-primary-foreground":""}`}>{a}</button>)}</div><div className="mt-5 text-3xl font-semibold">{freq[axis]} <span className="text-base font-normal">Hz</span></div><p className="text-xs text-muted-foreground mt-1">Zeta {zeta[axis]}</p><div className="mt-5"><label className="text-xs text-muted-foreground">Shaper FTM</label><select value={shaper[axis]} onChange={e=>setShaper({...shaper,[axis]:e.target.value})} className="w-full mt-1 px-2 py-2 rounded border bg-background">{SHAPERS.map(([v,n])=><option value={v} key={v}>{n}</option>)}</select></div></div>
      </div>}

      {tab === "config" && <div className="space-y-4">
        <div className={card}>
          <h2 className="font-medium mb-1">Prise en charge des vibrations — deux fichiers</h2>
          <p className="text-sm text-muted-foreground">Le studio lit et peut synchroniser le profil de vibration dans <code>Configuration.h</code> et <code>Configuration_adv.h</code>. Chaque écriture utilise le SHA courant et le mécanisme de sauvegarde de l'Agent.</p>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {configTargets.map(file => {
              const c = configs[file];
              const active = c?.content && (hasDefine(c.content,"INPUT_SHAPING_X") || hasDefine(c.content,"INPUT_SHAPING_Y") || hasDefine(c.content,"FT_MOTION"));
              return <div key={file} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2"><b>{file}</b><span className={`text-xs px-2 py-1 rounded-full ${c ? (active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground") : "bg-amber-500/10 text-amber-600"}`}>{c ? (active ? "Vibration active" : "Disponible") : "Absent"}</span></div>
                <div className="text-xs text-muted-foreground mt-2">{c ? "Fichier lu depuis le projet sélectionné." : "Ce fichier n'a pas été trouvé dans le projet."}</div>
                {c && <div className="grid grid-cols-2 gap-2 mt-3 text-xs"><div className="border rounded p-2">Input Shaping X/Y<br/><b>{hasDefine(c.content,"INPUT_SHAPING_X") || hasDefine(c.content,"INPUT_SHAPING_Y") ? "activé" : "non activé"}</b></div><div className="border rounded p-2">FT Motion<br/><b>{hasDefine(c.content,"FT_MOTION") ? "activé" : "non activé"}</b></div></div>}
              </div>;
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={saveClassic} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-2"><Save className="w-4 h-4"/>Activer Input Shaping dans les 2 fichiers</button>
            <button onClick={saveFTM} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>Activer FTM dans les 2 fichiers</button>
            <button onClick={loadConfig} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2"><Radio className="w-4 h-4"/>Relire les 2 fichiers</button>
          </div>
        </div>
        <div className={card}>
          <h3 className="font-medium">Ce qui est réellement écrit</h3>
          <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li><code>Configuration.h</code> et <code>Configuration_adv.h</code> reçoivent le même profil avec des garde-fous <code>#ifndef</code>.</li>
            <li>Les fréquences X/Y et les valeurs Zeta sont synchronisées avec les valeurs du studio.</li>
            <li>FTM ajoute ses paramètres X/Y lorsque cette fonction est demandée.</li>
            <li>Si un seul fichier existe, seul celui présent est modifié et le studio l'indique clairement.</li>
          </ul>
        </div>
      </div>}

      {tab === "sweep" && <div className={card}><h2 className="font-medium mb-3">Générateur de test de résonance</h2><div className="grid md:grid-cols-5 gap-3">{[["De",from,setFrom],["À",to,setTo],["Pas",step,setStep]].map(([l,v,s])=><label className="text-xs text-muted-foreground" key={l}>{l} Hz<input type="number" value={v} onChange={e=>s(e.target.value)} className="w-full mt-1 px-2 py-2 rounded border bg-background"/></label>)}<label className="text-xs text-muted-foreground">Axe<select value={axis} onChange={e=>setAxis(e.target.value)} className="w-full mt-1 px-2 py-2 rounded border bg-background">{AXES.map(a=><option key={a}>{a}</option>)}</select></label><label className="text-xs text-muted-foreground">Zeta<input type="number" step="0.01" value={zeta[axis]} onChange={e=>setZeta({...zeta,[axis]:e.target.value})} className="w-full mt-1 px-2 py-2 rounded border bg-background"/></label></div><div className="flex gap-2 mt-4"><button onClick={runSweep} disabled={playing} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex gap-2"><Download className="w-4 h-4"/>Générer le sweep M593</button><button onClick={()=>download(`Ringing-Tower-${axis}.gcode`,buildRingingTower({axis,from:num(from,15),to:num(to,60),height:60,layer:0.2,startSpeed:30,endSpeed:120}))} className="px-3 py-2 rounded-lg border text-sm">Ringing Tower G-code</button></div></div>}

      {tab === "ftm" && <div className={card}><h2 className="font-medium mb-2">Fixed-Time Motion / Input Shaping avancé</h2><p className="text-sm text-muted-foreground mb-4">Marlin récent expose M493 et plusieurs shapers : ZV, ZVD, ZVDD, ZVDDD, EI, 2HEI, 3HEI et MZV.</p><div className="grid md:grid-cols-2 gap-3">{AXES.map(a=><div className="border rounded-lg p-3" key={a}><b>Axe {a}</b><select value={shaper[a]} onChange={e=>setShaper({...shaper,[a]:e.target.value})} className="w-full mt-2 px-2 py-2 rounded border bg-background">{SHAPERS.map(([v,n])=><option value={v} key={v}>{n}</option>)}</select><input type="number" value={freq[a]} onChange={e=>setFreq({...freq,[a]:e.target.value})} className="w-full mt-2 px-2 py-2 rounded border bg-background"/><label className="text-xs text-muted-foreground block mt-2">Vibration tolerance</label><input type="number" min="0" max="1" step="0.01" value={vtol[a]} onChange={e=>setVtol({...vtol,[a]:e.target.value})} className="w-full mt-1 px-2 py-2 rounded border bg-background"/></div>)}</div><div className="flex gap-2 mt-4"><button onClick={saveFTM} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex gap-2"><ShieldCheck className="w-4 h-4"/>Intégrer FTM</button><button onClick={sendM493} className="px-3 py-2 rounded-lg border text-sm flex gap-2"><Play className="w-4 h-4"/>Tester M493</button></div></div>}

      {tab === "sensor" && <div className="space-y-4">
        <div className={card}><div className="flex flex-wrap justify-between gap-3 items-start"><div><h2 className="font-medium mb-1">Accelerometer Studio</h2><p className="text-sm text-muted-foreground">Importe une mesure CSV d'accéléromètre. Formats acceptés : <code>temps,accélération</code> ou <code>temps,X,Y,Z</code>. L'analyse FFT est limitée à 200 Hz pour cibler les résonances mécaniques.</p></div><label className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 cursor-pointer"><Upload className="w-4 h-4"/>Importer CSV<input type="file" accept=".csv,.txt" className="hidden" onChange={e=>importCsvFile(e.target.files?.[0])}/></label></div>
          <textarea value={csv} onChange={e=>setCsv(e.target.value)} placeholder={'temps,X,Y,Z\n0.000,0.12,0.03,0.01\n0.001,0.18,0.05,0.02\n...'} className="w-full h-40 mt-3 rounded-lg border bg-background p-3 font-mono text-xs"/>
          <div className="flex flex-wrap gap-2 mt-3"><button onClick={analyzeCsv} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex gap-2"><BarChart3 className="w-4 h-4"/>Analyser FFT</button>{result&&<><button onClick={applySensorResult} className="px-3 py-2 rounded-lg border text-sm flex gap-2"><Wand2 className="w-4 h-4"/>Appliquer aux axes</button><button onClick={downloadAnalysis} className="px-3 py-2 rounded-lg border text-sm flex gap-2"><Download className="w-4 h-4"/>Exporter analyse</button></>}</div>
        </div>
        {result && <div className="grid lg:grid-cols-3 gap-4"><div className={card}><h3 className="font-medium mb-3">Résonances détectées</h3>{result.axes.map(a=><button key={a.axis} onClick={()=>setSensorAxis(a.axis)} className={`w-full text-left p-3 rounded-lg border mb-2 ${sensorAxis===a.axis?"bg-primary/10 border-primary":""}`}><div className="flex justify-between"><span>Axe {a.axis}</span><b>{a.frequency.toFixed(2)} Hz</b></div><div className="text-xs text-muted-foreground mt-1">{a.peaks.slice(0,3).map(p=>`${p.f.toFixed(1)} Hz`).join(" · ")}</div></button>)}<div className="text-xs text-muted-foreground mt-3">{result.samples} échantillons · fréquence d'échantillonnage {result.sampleRate.toFixed(1)} Hz</div></div>
          <div className={card+" lg:col-span-2"}><div className="flex justify-between items-center mb-3"><h3 className="font-medium">Spectre FFT — axe {sensorAxis}</h3><span className="text-xs text-muted-foreground">0–200 Hz</span></div>{(() => { const a=result.axes.find(x=>x.axis===sensorAxis)||result.axes[0]; const bins=a?.spectrum||[]; return <div className="h-64 flex items-end gap-px border-b border-l p-2 overflow-hidden">{bins.filter((_,i)=>i%Math.max(1,Math.ceil(bins.length/160))===0).map((b,i)=><div key={i} title={`${b.f.toFixed(2)} Hz`} className="flex-1 min-w-[2px] bg-primary/70" style={{height:`${Math.max(2,b.level*100)}%`}}/> )}</div>; })()}<div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">{(result.axes.find(x=>x.axis===sensorAxis)?.peaks||[]).map((p,i)=><div key={i} className="border rounded p-2 text-xs"><div className="text-muted-foreground">Pic {i+1}</div><b>{p.f.toFixed(2)} Hz</b></div>)}</div></div></div>}
      </div>}

      {status && <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{status}</div>}
      <div className="text-xs text-muted-foreground flex items-center gap-2"><Gauge className="w-3.5 h-3.5"/>M593 est utilisé pour le ZV intégré ; M493 correspond au Fixed-Time Motion de Marlin récent.</div>
    </div>
  </div>;
}
