import React, { useMemo } from "react";
import { useProject, validateProject } from "@/lib/projectStore";
import { cn } from "@/lib/utils";
import { ShieldCheck, AlertTriangle, XCircle, Info, CheckCircle2 } from "lucide-react";

export default function ValidationPanel() {
  const { currentProject } = useProject();
  const result = useMemo(() => (currentProject ? validateProject(currentProject) : { warnings: [], errors: [] }), [currentProject]);

  if (!currentProject) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucun projet</div>;

  const { warnings, errors } = result;
  const fatal = errors.filter((e) => e.level === "FATAL");
  const ready = errors.length === 0 && fatal.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        <h2 className="text-sm font-semibold">Validation</h2>
        <span className={cn("ml-auto text-xs px-2 py-0.5 rounded-full font-medium", ready ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
          {ready ? "PRÊT" : "BLOQUÉ"}
        </span>
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Erreurs" value={errors.length} tone="red" />
        <Stat label="Warnings" value={warnings.length} tone="amber" />
        <Stat label="Info" value={0} tone="blue" />
      </div>

      <div className="px-4 pb-4 space-y-2">
        {[...errors.map((e) => ({ ...e, kind: "error" })), ...warnings.map((w) => ({ ...w, kind: "warning" }))].map((item, i) => (
          <div key={i} className={cn("flex items-start gap-2 p-2 rounded text-sm", item.kind === "error" ? "bg-red-500/10" : "bg-amber-500/10")}>
            {item.kind === "error" ? <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
            <div>
              <div className="font-mono text-xs text-muted-foreground">{item.param}</div>
              <div>{item.message}</div>
            </div>
          </div>
        ))}
        {errors.length === 0 && warnings.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded bg-emerald-500/10 text-emerald-600 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Configuration valide. Aucune erreur ni avertissement.
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Checklist pré-compilation</div>
        <Checklist items={[
          "Syntaxe", "Dépendances", "Carte mère", "Drivers", "Endstops",
          "Thermistances", "Probe", "EEPROM", "Features", "Environnement PlatformIO",
        ]} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = { red: "text-red-500", amber: "text-amber-500", blue: "text-blue-500" };
  return (
    <div className="p-2 rounded border border-border">
      <div className={cn("text-lg font-semibold", tones[tone])}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function Checklist({ items }) {
  return (
    <div className="space-y-1">
      {items.map((it) => (
        <div key={it} className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{it}</span>
        </div>
      ))}
    </div>
  );
}