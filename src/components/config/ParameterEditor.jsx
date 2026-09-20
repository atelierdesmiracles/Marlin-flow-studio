import React from "react";
import { useProject } from "@/lib/projectStore";
import { DEPENDENCIES, PARAM_KNOWLEDGE, getCategoryMeta } from "@/lib/marlinKnowledge";
import { cn } from "@/lib/utils";
import { RotateCcw, ExternalLink, AlertTriangle, Link2, BookOpen } from "lucide-react";

export default function ParameterEditor() {
  const { currentProject, state, toggleParam, updateValue, resetParam } = useProject();
  const param = currentProject?.allParameters.find((p) => p.id === state.selectedParameterId);

  if (!param) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
        <BookOpen className="w-8 h-8 mb-2 opacity-40" />
        Sélectionnez un paramètre pour l'éditer.
      </div>
    );
  }

  const meta = PARAM_KNOWLEDGE[param.name];
  const enabled = (name) => currentProject.allParameters.some((p) => p.name === name && p.enabled);
  const deps = DEPENDENCIES[param.name] || [];
  const missingDeps = deps.filter((d) => !enabled(d));
  const categoryMeta = getCategoryMeta(param.category);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", param.enabled ? "bg-emerald-500" : "bg-muted-foreground/40")} />
          <h2 className="font-mono text-base font-semibold">{param.name}</h2>
          {param.modified && <span className="text-[10px] text-blue-500 font-medium px-1.5 py-0.5 rounded bg-blue-500/10">MODIFIÉ</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {param.file} · ligne {param.line + 1} · {param.category}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="text-sm">{param.description || <span className="text-muted-foreground italic">Paramètre non documenté. Éditable comme macro générique.</span>}</div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Rôle</div><div className="mt-0.5 font-medium">{meta?.purpose || categoryMeta.purpose}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Risque</div><div className="mt-0.5 font-medium">{meta?.risk || "À évaluer selon le matériel"}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Unité</div><div className="mt-0.5 font-mono">{meta?.units || "—"}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Test</div><div className="mt-0.5">{meta?.test || categoryMeta.test}</div></div>
        </div>

        {(meta?.warning || meta?.risk === "Critique") && (
          <div className="flex items-start gap-2 p-2.5 rounded border border-amber-500/20 bg-amber-500/5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{meta.warning || "Cette option peut empêcher le démarrage correct du firmware si elle ne correspond pas au matériel."}</span>
          </div>
        )}

        {/* Value control */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Valeur</label>
          {renderControl(param, (v) => updateValue(currentProject.id, param.file, param, v))}
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center justify-between py-2 border-y border-border">
          <div>
            <div className="text-sm font-medium">État</div>
            <div className="text-xs text-muted-foreground">{param.enabled ? "ACTIVÉ" : "DÉSACTIVÉ"}</div>
          </div>
          <button
            onClick={() => toggleParam(currentProject.id, param.file, param)}
            className={cn("relative w-11 h-6 rounded-full transition-colors", param.enabled ? "bg-primary" : "bg-muted")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-background transition-all", param.enabled ? "left-5" : "left-0.5")} />
          </button>
        </div>

        {/* Dependencies */}
        {deps.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Link2 className="w-3.5 h-3.5" /> Dépendances</div>
            {deps.map((d) => {
              const dep = currentProject.allParameters.find((p) => p.name === d);
              const ok = enabled(d);
              return (
                <div key={d} className="flex items-center gap-2 text-sm">
                  <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
                  <span className="font-mono">{d}</span>
                  <span className="text-xs text-muted-foreground">{ok ? "satisfait" : "manquant"}</span>
                </div>
              );
            })}
          </div>
        )}

        {missingDeps.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Cette option nécessite : {missingDeps.join(", ")}.</span>
          </div>
        )}

        {/* Raw text preview */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Code source</div>
          <pre className="text-xs font-mono p-2 rounded bg-muted overflow-x-auto">{param.rawText}</pre>
          {param.modified && (
            <div className="text-xs">
              <span className="text-muted-foreground">Original : </span>
              <span className="font-mono line-through text-red-500/70">{param.originalRawText.trim()}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {param.modified && (
            <button
              onClick={() => resetParam(currentProject.id, param.file, param)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
            </button>
          )}
          {meta?.doc && (
            <a href={meta.doc} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted">
              <ExternalLink className="w-3.5 h-3.5" /> Documentation
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function renderControl(param, onChange) {
  const meta = PARAM_KNOWLEDGE[param.name];
  const options = meta?.options;

  if (param.type === "flag") {
    return <div className="text-sm text-muted-foreground italic">Directive booléenne (activer/désactiver via l'état).</div>;
  }
  if (options && options.length) {
    return (
      <select
        value={String(param.value)}
        onChange={(e) => onChange(param.type === "number" ? Number(e.target.value) : e.target.value)}
        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono"
      >
        {options.map((o) => (
          <option key={o} value={String(o)}>{o}</option>
        ))}
      </select>
    );
  }
  if (param.type === "string") {
    return <input value={param.value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono" />;
  }
  if (param.type === "array") {
    return <ArrayEditor value={param.value} onChange={onChange} />;
  }
  if (param.type === "number" || param.type === "float") {
    return (
      <input
        type="number"
        step={param.type === "float" ? "0.001" : "1"}
        value={param.value}
        onChange={(e) => onChange(param.type === "float" ? parseFloat(e.target.value) : Number(e.target.value))}
        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono"
      />
    );
  }
  return (
    <input
      value={param.rawValue}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono"
    />
  );
}

function ArrayEditor({ value, onChange }) {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-1">
      {arr.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4">{i}</span>
          <input
            value={v}
            onChange={(e) => { const n = [...arr]; n[i] = e.target.value; onChange(n); }}
            className="flex-1 px-2 py-1 text-sm rounded border border-input bg-background font-mono"
          />
        </div>
      ))}
      <div className="text-xs text-muted-foreground font-mono">{`{ ${arr.join(", ")} }`}</div>
    </div>
  );
}