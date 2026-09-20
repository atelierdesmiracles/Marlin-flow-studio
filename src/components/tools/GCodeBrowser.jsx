import React, { useEffect, useMemo, useRef, useState } from "react";
import { Terminal, Search, Send, Eraser, Home, Crosshair, Thermometer, Plug, Unplug, RefreshCw, Circle } from "lucide-react";
import { agentApi } from "@/lib/localAgent";
import { cn } from "@/lib/utils";

const GCODES = [
  { code: "G28", title: "Homing", desc: "Déplace les axes vers les butées (home). Sans paramètre, home tous les axes.", params: "X, Y, Z", example: "G28 X Y", cat: "G" },
  { code: "G29", title: "Auto Bed Leveling", desc: "Lance la procédure de nivellement automatique du lit.", params: "—", example: "G29", cat: "G" },
  { code: "G0", title: "Move rapide", desc: "Déplacement rapide.", params: "X, Y, Z, E, F", example: "G0 X10 Y20 F3000", cat: "G" },
  { code: "G1", title: "Move", desc: "Déplacement linéaire à vitesse contrôlée.", params: "X, Y, Z, E, F", example: "G1 X100 E5 F600", cat: "G" },
  { code: "M104", title: "Set Hotend Temp", desc: "Règle la température du hotend sans attendre.", params: "S", example: "M104 S200", cat: "M" },
  { code: "M109", title: "Wait Hotend Temp", desc: "Attend que le hotend atteigne la température cible.", params: "S", example: "M109 S200", cat: "M" },
  { code: "M140", title: "Set Bed Temp", desc: "Règle la température du bed sans attendre.", params: "S", example: "M140 S60", cat: "M" },
  { code: "M190", title: "Wait Bed Temp", desc: "Attend que le bed atteigne la température cible.", params: "S", example: "M190 S60", cat: "M" },
  { code: "M105", title: "Report Temperatures", desc: "Demande les températures actuelles.", params: "—", example: "M105", cat: "M" },
  { code: "M114", title: "Current Position", desc: "Retourne la position actuelle des axes.", params: "—", example: "M114", cat: "M" },
  { code: "M115", title: "Firmware Info", desc: "Retourne nom, version et capacités du firmware.", params: "—", example: "M115", cat: "M" },
  { code: "M500", title: "Save EEPROM", desc: "Sauvegarde la configuration courante en EEPROM.", params: "—", example: "M500", cat: "M" },
  { code: "M501", title: "Load EEPROM", desc: "Charge la configuration depuis l'EEPROM.", params: "—", example: "M501", cat: "M" },
  { code: "M503", title: "Report Settings", desc: "Affiche les réglages courants.", params: "—", example: "M503", cat: "M" },
  { code: "M106", title: "Fan On", desc: "Active le ventilateur.", params: "S 0-255", example: "M106 S128", cat: "M" },
  { code: "M107", title: "Fan Off", desc: "Éteint le ventilateur.", params: "—", example: "M107", cat: "M" },
  { code: "M112", title: "Emergency Stop", desc: "Arrêt d'urgence immédiat.", params: "—", example: "M112", cat: "M" },
  { code: "M84", title: "Disable Motors", desc: "Désactive les moteurs.", params: "—", example: "M84", cat: "M" },
];

export default function GCodeBrowser() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(GCODES[0]);
  const [consoleInput, setConsoleInput] = useState("");
  const [status, setStatus] = useState(null);
  const [ports, setPorts] = useState([]);
  const [port, setPort] = useState("");
  const [baud, setBaud] = useState("115200");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState([]);
  const logIdRef = useRef(0);
  const portRef = useRef("");

  const results = useMemo(() => GCODES.filter((g) => `${g.code} ${g.title}`.toLowerCase().includes(q.toLowerCase())), [q]);

  async function refresh() {
    try {
      const [s, p, l] = await Promise.all([agentApi.status(), agentApi.ports(), agentApi.logs(600, logIdRef.current)]);
      setStatus(s);
      setPorts(p.ports || []);
      if (!portRef.current && p.ports?.length) { setPort(p.ports[0].device); portRef.current = p.ports[0].device; }
      if (l.logs?.length) setLog((prev) => [...prev, ...l.logs].slice(-800));
      if (typeof l.latest_id === "number") { logIdRef.current = l.latest_id; }
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1200);
    return () => clearInterval(timer);
  }, []);

  async function connect() {
    setBusy(true); setError("");
    try { await agentApi.serialConnect(port, Number(baud)); await refresh(); }
    catch (e) { setError(e.message || "Connexion série impossible"); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true); setError("");
    try { await agentApi.serialDisconnect(); await refresh(); }
    catch (e) { setError(e.message || "Déconnexion impossible"); }
    finally { setBusy(false); }
  }

  async function send(cmd) {
    const c = String(cmd || "").trim();
    if (!c || !status?.serial_connected) return;
    setConsoleInput("");
    try { await agentApi.serialSend(c); await refresh(); }
    catch (e) { const msg = e.message || "Erreur série"; setError(msg); setLog((l) => [...l, { id: Date.now(), timestamp: new Date().toLocaleTimeString(), level: "error", message: msg }]); }
  }

  async function sendFile(file) {
    if (!file || !status?.serial_connected) return;
    setBusy(true); setError("");
    try {
      const text = await file.text();
      const result = await agentApi.serialSendText(text, 15);
      setError("");
      setLog((l) => [...l, { id: Date.now(), timestamp: new Date().toLocaleTimeString(), level: "serial", message: `[TX FILE] ${file.name} · ${result.lines_sent} lignes` }]);
      await refresh();
    } catch (e) {
      setError(e.message || "Envoi du fichier impossible");
    } finally { setBusy(false); }
  }

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0">
      <div className="lg:w-72 lg:border-r border-b lg:border-b-0 border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher G-code…" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.map((g) => (
            <button key={g.code} onClick={() => setSelected(g)} className={cn("w-full text-left px-3 py-2 border-b border-border/50 hover:bg-accent/50", selected.code === g.code && "bg-accent")}>
              <div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold">{g.code}</span><span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">{g.cat}</span></div>
              <div className="text-xs text-muted-foreground truncate">{g.title}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2"><h2 className="font-mono text-lg font-semibold">{selected.code}</h2><span className="text-sm text-muted-foreground">{selected.title}</span></div>
          <p className="text-sm mt-2">{selected.desc}</p>
          <div className="grid md:grid-cols-3 gap-2 mt-3 text-xs">
            <div><span className="text-muted-foreground">Paramètres : </span><span className="font-mono">{selected.params}</span></div>
            <div className="font-mono p-2 rounded bg-muted md:col-span-2">{selected.example}</div>
          </div>
          <button onClick={() => send(selected.code)} disabled={!status?.serial_connected} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-30"><Send className="w-3.5 h-3.5" /> Envoyer à l'imprimante</button>
        </div>

        <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Circle className={cn("w-2.5 h-2.5 fill-current", status?.serial_connected ? "text-emerald-500" : "text-muted-foreground")} /> Série</div>
          <span className="text-[10px] text-muted-foreground">Autorisation système automatique si nécessaire</span>
          <select value={port} onChange={(e) => { setPort(e.target.value); portRef.current = e.target.value; }} className="px-2 py-1.5 text-xs rounded border bg-background w-60"><option value="">Choisir un port</option>{ports.map((p) => <option key={p.device} value={p.device}>{p.device}{p.description ? ` — ${p.description}` : ""}</option>)}</select>
          <select value={baud} onChange={(e) => setBaud(e.target.value)} className="px-2 py-1.5 text-xs rounded border bg-background"><option>115200</option><option>230400</option><option>250000</option><option>500000</option><option>1000000</option></select>
          {status?.serial_connected ? <button onClick={disconnect} disabled={busy} className="px-2.5 py-1.5 text-xs rounded border hover:bg-accent"><Unplug className="w-3.5 h-3.5 inline mr-1" />Déconnecter</button> : <button onClick={connect} disabled={busy || !port} className="px-2.5 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-30"><Plug className="w-3.5 h-3.5 inline mr-1" />Connecter</button>}
          <label className="px-2.5 py-1.5 text-xs rounded border hover:bg-accent cursor-pointer">
            Envoyer un fichier G-code
            <input type="file" accept=".gcode,.gco,.g,.txt" className="hidden" disabled={!status?.serial_connected || busy} onChange={(e) => { sendFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button onClick={refresh} className="p-1.5 rounded hover:bg-accent ml-auto" title="Actualiser"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        {error && <div className="mx-3 mt-2 px-3 py-2 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-600">{error}</div>}

        <div className="px-3 py-1.5 border-b border-border flex items-center gap-1"><QuickBtn icon={Home} label="G28" onClick={() => send("G28")} /><QuickBtn icon={Crosshair} label="G29" onClick={() => send("G29")} /><QuickBtn icon={Thermometer} label="M105" onClick={() => send("M105")} /><button onClick={() => setLog([])} className="p-1.5 rounded hover:bg-accent ml-auto" title="Effacer"><Eraser className="w-3.5 h-3.5" /></button></div>

        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-muted/30 min-h-0">
          {log.map((entry, i) => {
            const serial = entry.level === "serial";
            const tx = entry.message?.startsWith("[TX]");
            return <div key={`${entry.id}-${i}`} className={cn(tx && "text-cyan-500", serial && !tx && "text-emerald-500", entry.level === "error" && "text-red-500", entry.level === "warning" && "text-amber-500")}><span className="text-muted-foreground mr-2">{entry.timestamp}</span>{entry.message}</div>;
          })}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(consoleInput); }} className="flex items-center gap-2 p-2 border-t border-border">
          <span className="font-mono text-xs text-muted-foreground">&gt;</span>
          <input value={consoleInput} onChange={(e) => setConsoleInput(e.target.value)} placeholder="Envoyer un G-code…" className="flex-1 px-2 py-1.5 text-sm font-mono rounded border border-input bg-background outline-none" />
          <button disabled={!status?.serial_connected || !consoleInput.trim()} className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-30"><Send className="w-3.5 h-3.5" /></button>
        </form>
      </div>
    </div>
  );
}

function QuickBtn({ icon: Icon, label, onClick }) {
  return <button onClick={onClick} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-accent font-mono"><Icon className="w-3 h-3" />{label}</button>;
}
