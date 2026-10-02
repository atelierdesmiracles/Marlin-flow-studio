import React, { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Flame, Gauge, Save, Send, Thermometer, Wand2 } from "lucide-react";
import { useProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import { findWritableParam, writableConfigFiles } from "@/lib/configFileModel";

function findParam(project, name) { return findWritableParam(project, name); }

export default function PIDStudio() {
  const { currentProject, updateValue, updateProject, exportFile } = useProject();
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState("");
  const [connected, setConnected] = useState(false);
  const [target, setTarget] = useState(200);
  const [cycles, setCycles] = useState(8);
  const [bedTarget, setBedTarget] = useState(60);
  const [chamberTarget, setChamberTarget] = useState(40);
  const [running, setRunning] = useState("");
  const [saving, setSaving] = useState(false);
  const DEFAULTS = { hotend: [22.2, 1.08, 114.0], bed: [10.0, 0.023, 305.4], chamber: [10.0, 0.023, 305.4] };

  const pid = useMemo(() => ({
    hotend: ["DEFAULT_Kp", "DEFAULT_Ki", "DEFAULT_Kd"].map(n => findParam(currentProject, n)),
    bed: ["DEFAULT_bedKp", "DEFAULT_bedKi", "DEFAULT_bedKd"].map(n => findParam(currentProject, n)),
    chamber: ["DEFAULT_chamberKp", "DEFAULT_chamberKi", "DEFAULT_chamberKd"].map(n => findParam(currentProject, n)),
  }), [currentProject]);

  const flags = {
    hotend: !!findParam(currentProject, "PIDTEMP"),
    bed: !!findParam(currentProject, "PIDTEMPBED"),
    chamber: !!findParam(currentProject, "PIDTEMPCHAMBER"),
  };

  const change = (name, value) => {
    const p = findParam(currentProject, name);
    if (!p) return;
    updateValue(currentProject.id, p.file, p, Number(value));
    setMessage(`${name} modifié`);
    setTimeout(() => setMessage(""), 1600);
  };

  const send = async (cmd) => {
    try {
      const r = await agentApi.serialSend(cmd);
      setOutput(prev => `${prev}\n> ${cmd}\n${r?.output || r?.response || JSON.stringify(r)}`.trim());
      setConnected(true);
    } catch (e) { setMessage(`Console série : ${e.message || e}`); }
  };

  const autotune = async (heater) => {
    const temp = heater === "hotend" ? target : heater === "bed" ? bedTarget : chamberTarget;
    const e = heater === "hotend" ? 0 : heater === "bed" ? -1 : -2;
    if (!Number.isFinite(temp) || temp <= 0) { setMessage("Température PID invalide"); return; }
    setRunning(heater);
    try {
      await send(`M303 E${e} S${temp} C${cycles} U1`);
      setMessage(`Auto-Tune ${heater === "hotend" ? "Hotend" : heater === "bed" ? "Bed" : "Chambre"} lancé`);
    } finally { setRunning(""); }
  };


  const savePidToDisk = async () => {
    setSaving(true);
    try {
      if (!currentProject?.localProjectPath) throw new Error("Aucun projet local sélectionné.");
      const names = ["DEFAULT_Kp","DEFAULT_Ki","DEFAULT_Kd","DEFAULT_bedKp","DEFAULT_bedKi","DEFAULT_bedKd","DEFAULT_chamberKp","DEFAULT_chamberKi","DEFAULT_chamberKd"];
      const writable = new Set(writableConfigFiles(currentProject));
      const touched = [...new Set((currentProject.allParameters || []).filter(p => p.modified && writable.has(p.file) && names.includes(p.name)).map(p => p.file))];
      if (!touched.length) { setMessage("Aucune modification PID à enregistrer."); return; }
      const files = Object.fromEntries(touched.map(file => [file, exportFile(currentProject.id, file)]));
      const hashes = Object.fromEntries(touched.filter(f => currentProject.localHashes?.[f]).map(f => [f, currentProject.localHashes[f]]));
      await agentApi.selectProject(currentProject.localProjectPath);
      const result = await agentApi.applyConfiguration(files, hashes);
      const nextHashes = { ...(currentProject.localHashes || {}) };
      for (const item of result.written || []) nextHashes[item.filename] = item.sha256;
      updateProject({ ...currentProject, localHashes: nextHashes, updatedDate: new Date().toISOString() });
      setMessage("✓ Paramètres PID enregistrés sur le PC — .bak créé");
    } catch (e) { setMessage(`Erreur d'enregistrement PID : ${e.message || e}`); }
    finally { setSaving(false); }
  };

  const stopAutotune = async () => {
    await send("M303 U0");
    setRunning("");
    setMessage("Auto-Tune arrêté");
  };

  const card = (title, icon, enabled, names, targetValue, setTargetValue, e) => {
    const key = title.toLowerCase().includes("bed") ? "bed" : title.toLowerCase().includes("chambre") ? "chamber" : "hotend";
    const vals = names.map((n, i) => findParam(currentProject, n) || { name: n, value: DEFAULTS[key][i], _default: true });
    const present = vals.some(v => !v._default);
    return <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between"><div className="flex items-center gap-2 font-semibold">{icon}{title}</div><span className={`text-[10px] px-2 py-1 rounded-full border ${enabled ? "border-emerald-500/30 text-emerald-600" : "border-border text-muted-foreground"}`}>{enabled ? "ACTIF" : "NON DÉTECTÉ"}</span></div>
      {!present ? <div className="text-xs text-muted-foreground">Aucun paramètre PID détecté : les champs ci-dessous utilisent des valeurs de départ Marlin. Elles seront utilisées comme référence pour l’Auto-Tune.</div> : null}
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{names.map((n, i) => vals[i] && <label key={n} className="rounded-lg border border-border p-3"><span className="block text-xs font-medium mb-2">{["Kp","Ki","Kd"][i]} <span className="font-mono text-[10px] text-muted-foreground">{n}</span></span><input type="number" step="0.001" value={vals[i].value ?? ""} onChange={e => change(n, e.target.value)} className="w-full px-3 py-2 rounded border border-input bg-background font-mono" /><span className="block mt-1 text-[10px] text-muted-foreground">{vals[i]._default ? "Valeur par défaut" : "Projet"}</span></label>)}</div>
        <div className="flex flex-wrap items-end gap-3"><label className="text-xs">Cible °C<input type="number" value={targetValue} onChange={e => setTargetValue(Number(e.target.value))} className="block mt-1 w-28 px-3 py-2 rounded border border-input bg-background" /></label><button disabled={!enabled || !!running} onClick={() => autotune(title.toLowerCase().includes("bed") ? "bed" : title.toLowerCase().includes("chambre") ? "chamber" : "hotend")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-2"><Wand2 className="w-4 h-4"/> {running ? "Auto-Tune en cours…" : `Auto-Tune ${title}`}</button><button disabled={!running} onClick={stopAutotune} className="px-3 py-2 rounded-lg border border-red-500/40 text-red-600 disabled:opacity-40">Arrêter</button><button disabled={!connected} onClick={() => send(`M303 E${e} S${targetValue} C${cycles} U1`)} className="px-3 py-2 rounded-lg border border-border disabled:opacity-40"><Send className="w-4 h-4"/> Envoyer</button></div>
      </>
    </section>;
  };

  if (!currentProject) return <div className="p-8 text-muted-foreground">Ouvre d'abord un projet Marlin.</div>;
  return <div className="h-full overflow-y-auto p-5 space-y-5">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-xl font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-primary"/> PID Studio</h1><p className="text-sm text-muted-foreground mt-1">Réglage guidé du PID Hotend, Bed et Chambre, avec génération M303 et validation des valeurs.</p></div><div className="text-xs rounded-md border border-border px-3 py-2">Cycles <input className="w-12 bg-transparent text-center" type="number" min="1" max="20" value={cycles} onChange={e => setCycles(Number(e.target.value))}/></div></div>
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="font-semibold flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary"/> Auto-Tune rapide</div>
      <div className="flex flex-wrap gap-2">
        <button disabled={!flags.hotend || !!running} onClick={() => autotune("hotend")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">🔥 Auto-Tune Hotend ({target}°C)</button>
        <button disabled={!flags.bed || !!running} onClick={() => autotune("bed")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">🌡️ Auto-Tune Bed ({bedTarget}°C)</button>
        {flags.chamber && <button disabled={!!running} onClick={() => autotune("chamber")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">🏠 Auto-Tune Chambre ({chamberTarget}°C)</button>}
        {running && <button onClick={stopAutotune} className="px-4 py-2 rounded-lg border border-red-500/40 text-red-600">⏹ Arrêter Auto-Tune</button>}
      </div>
      <div className="text-xs text-muted-foreground">Commandes : <span className="font-mono">M303 E0</span> Hotend · <span className="font-mono">M303 E-1</span> Bed · <span className="font-mono">M303 E-2</span> Chambre.</div>
    </section>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {card("Hotend", <Flame className="w-4 h-4 text-primary"/>, flags.hotend, ["DEFAULT_Kp","DEFAULT_Ki","DEFAULT_Kd"], target, setTarget, 0)}
      {card("Bed", <Thermometer className="w-4 h-4 text-primary"/>, flags.bed, ["DEFAULT_bedKp","DEFAULT_bedKi","DEFAULT_bedKd"], bedTarget, setBedTarget, -1)}
      {flags.chamber && card("Chambre", <Gauge className="w-4 h-4 text-primary"/>, true, ["DEFAULT_chamberKp","DEFAULT_chamberKi","DEFAULT_chamberKd"], chamberTarget, setChamberTarget, -2)}
    </div>
    <section className="rounded-xl border border-border bg-card p-4 space-y-3"><div className="flex items-center gap-2 font-semibold"><Send className="w-4 h-4"/> Console PID</div><div className="flex flex-wrap gap-2"><button onClick={() => send("M503")} className="px-3 py-2 rounded-lg border border-border">Lire M503</button><button onClick={() => send("M500")} className="px-3 py-2 rounded-lg border border-border"><Save className="inline w-4 h-4 mr-1"/> M500</button><button onClick={() => setOutput("")} className="px-3 py-2 rounded-lg border border-border">Effacer</button></div><pre className="min-h-28 max-h-72 overflow-auto rounded-lg bg-black/80 text-green-300 p-3 text-xs font-mono whitespace-pre-wrap">{output || "Aucune réponse série. Connecte l'imprimante depuis Console imprimante pour exécuter M303/M503."}</pre></section>
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-2"><div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Sécurité PID</div><div>Ne lance l'Auto-Tune qu'avec une thermistance fonctionnelle et une imprimante surveillée. Vérifie la température maximale et l'état du chauffage avant M303.</div><div className="font-mono">M303 E0 S200 C8 U1 · M303 E-1 S60 C8 U1 · M500</div></section>
    <section className="sticky bottom-3 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-lg flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground">Les valeurs PID sont d'abord modifiées dans le projet puis écrites explicitement sur le PC.</div><button onClick={savePidToDisk} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Save className="w-4 h-4 inline mr-1" />{saving ? "Enregistrement…" : "Enregistrer le PID"}</button></section>
    {message && <div className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg border border-emerald-500/30 bg-card shadow-lg text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/>{message}</div>}
  </div>;
}
