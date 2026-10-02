import React from "react";
import { Cpu, Gauge, Thermometer, Crosshair, Zap, BrainCircuit, Monitor, ShieldCheck, Wrench, Wifi, ArrowRight, CheckCircle2 } from "lucide-react";
import { STUDIO_PHASES, STUDIO_LIST, STUDIO_COUNT, pad2 } from "@/lib/studioOrder.js";

// Icônes réelles correspondant au nom stocké (en texte) dans studioOrder.js —
// studioOrder.js reste un module de données pur (pas de JSX), donc la
// résolution icône ⇄ composant se fait ici, au plus près de l'affichage.
const ICONS = { Cpu, Gauge, Thermometer, Crosshair, Zap, BrainCircuit, Monitor, ShieldCheck, Wrench, Wifi };

// Les 6 étapes réellement indispensables pour obtenir un premier firmware qui
// démarre et bouge correctement ; le reste (thermique fine, interface,
// build...) vient logiquement après mais n'est pas "bloquant" au sens strict.
const CORE_PATH_IDS = ["machine", "stepper-driver", "motion", "temperature", "probe-endstop", "safety"];

export default function StudioHub({ setView }) {
  const corePath = CORE_PATH_IDS.map((id) => STUDIO_LIST.find((s) => s.id === id)).filter(Boolean);

  return <div className="h-full overflow-auto p-5 md:p-7">
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-2xl font-semibold">Studio Marlin Flow</div>
          <p className="text-sm text-muted-foreground mt-1">Tous les assistants de configuration, numérotés dans l'ordre logique : chaque étape ne dépend que des précédentes.</p>
        </div>
        <div className="text-xs border border-border rounded-lg px-3 py-2 bg-card">{STUDIO_PHASES.length} pôles · {STUDIO_COUNT} assistants · configuration guidée</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {STUDIO_PHASES.map((phase) => {
          const Icon = ICONS[phase.icon] || Cpu;
          return <section key={phase.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Icon className={`w-5 h-5 ${phase.color}`} /><h2 className="font-semibold">{phase.title}</h2></div>
            <p className="text-xs text-muted-foreground mb-3">{phase.desc}</p>
            <div className="space-y-1.5">
              {phase.studios.map(([id, label]) => {
                const entry = STUDIO_LIST.find((s) => s.id === id);
                return <button key={id} onClick={() => setView(id)} className="w-full flex items-center gap-2.5 text-left rounded-lg px-3 py-2 border border-transparent hover:border-border hover:bg-muted/40 text-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-muted/60 text-[11px] font-mono flex items-center justify-center text-muted-foreground">{pad2(entry.number)}</span>
                  <span className="flex-1">{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>;
              })}
            </div>
          </section>;
        })}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Parcours minimal recommandé</h2>
        <p className="text-sm text-muted-foreground mt-1">Pour obtenir une machine qui démarre et bouge correctement avant d'affiner le reste : {corePath.map((s) => s.label.replace(" Studio", "")).join(" → ")}.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {corePath.map((s) => <button key={s.id} onClick={() => setView(s.id)} className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-muted/40">{s.number}. {s.label}</button>)}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Le parcours complet des {STUDIO_COUNT} assistants, dans l'ordre, est numéroté ci-dessus dans chaque pôle.</p>
      </div>
    </div>
  </div>;
}
