import React, { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Home, RefreshCw, ShieldCheck } from "lucide-react";

const DEFAULT_URL = "https://marlinfw.org/";
const QUICK = [
  ["Marlin", "https://marlinfw.org/"],
  ["GitHub", "https://github.com/MarlinFirmware/Marlin"],
  ["PlatformIO", "https://docs.platformio.org/"],
];

export default function LocalBrowser() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [frame, setFrame] = useState(DEFAULT_URL);
  const [history, setHistory] = useState([DEFAULT_URL]);
  const [index, setIndex] = useState(0);

  function normalize(raw) {
    let value = String(raw || "").trim();
    if (!value) return "";
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    return value;
  }

  function navigate(raw) {
    const next = normalize(raw);
    if (!next) return;
    const trimmed = history.slice(0, index + 1);
    setHistory([...trimmed, next]);
    setIndex(trimmed.length);
    setUrl(next);
    setFrame(next);
  }

  function back() {
    if (index === 0) return;
    const next = index - 1;
    setIndex(next);
    setUrl(history[next]);
    setFrame(history[next]);
  }

  function forward() {
    if (index >= history.length - 1) return;
    const next = index + 1;
    setIndex(next);
    setUrl(history[next]);
    setFrame(history[next]);
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-1 p-2 border-b border-border bg-card">
        <button onClick={back} disabled={index === 0} className="p-2 rounded hover:bg-accent disabled:opacity-30" title="Précédent"><ArrowLeft className="w-4 h-4" /></button>
        <button onClick={forward} disabled={index >= history.length - 1} className="p-2 rounded hover:bg-accent disabled:opacity-30" title="Suivant"><ArrowRight className="w-4 h-4" /></button>
        <button onClick={() => setFrame(frame)} className="p-2 rounded hover:bg-accent" title="Actualiser"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => navigate(DEFAULT_URL)} className="p-2 rounded hover:bg-accent" title="Accueil"><Home className="w-4 h-4" /></button>
        <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded border border-input bg-background">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && navigate(url)} className="flex-1 bg-transparent text-sm outline-none font-mono" aria-label="Adresse du site" />
          <button onClick={() => window.open(normalize(url), "_blank", "noopener,noreferrer")} title="Ouvrir dans le navigateur système"><ExternalLink className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="px-2 py-1.5 border-b border-border flex flex-wrap gap-1.5">
        {QUICK.map(([name, target]) => <button key={target} onClick={() => navigate(target)} className="px-2.5 py-1 rounded border text-xs hover:bg-accent">{name}</button>)}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Mode desktop : Chromium complet</span>
      </div>

      <div className="flex-1 min-h-0 bg-background relative">
        <iframe title="Navigateur web" src={frame} className="w-full h-full border-0" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" />
        <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
          <div className="mx-auto max-w-xl px-3 py-2 rounded-lg bg-background/90 backdrop-blur border border-border shadow-sm text-xs text-muted-foreground text-center">
            Certains sites refusent l'intégration en iframe. Dans l'application desktop, l'onglet <b>Navigateur</b> utilise Qt WebEngine/Chromium et permet la navigation complète.
          </div>
        </div>
      </div>
    </div>
  );
}
