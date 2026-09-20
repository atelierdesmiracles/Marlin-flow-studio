import React, { useMemo } from "react";
import { useProject } from "@/lib/projectStore";
import { DEPENDENCIES } from "@/lib/marlinKnowledge";
import { cn } from "@/lib/utils";
import { RotateCcw, AlertTriangle, Link2, FileCode } from "lucide-react";

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "modified", label: "Modifiés" },
  { id: "enabled", label: "Activés" },
  { id: "disabled", label: "Désactivés" },
  { id: "warnings", label: "Avec dépendance manquante" },
];

export default function ParameterList({ onPick }) {
  const { currentProject, state, selectParameter, setFilter, resetParam } = useProject();
  const activeFiles = currentProject?.activeFiles || {};
  const params = (currentProject?.allParameters || []).filter((p) => activeFiles[p.file] !== false);
  const selected = state.selectedParameterId;
  const q = state.searchQuery.toLowerCase();

  const enabled = (name) => params.some((p) => p.name === name && p.enabled);

  const filtered = useMemo(() => {
    let list = params;
    if (state.selectedCategory) list = list.filter((p) => p.category === state.selectedCategory);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q) || String(p.value).toLowerCase().includes(q));
    switch (state.filter) {
      case "modified": list = list.filter((p) => p.modified); break;
      case "enabled": list = list.filter((p) => p.enabled); break;
      case "disabled": list = list.filter((p) => !p.enabled); break;
      case "warnings":
        list = list.filter((p) => p.enabled && DEPENDENCIES[p.name]?.some((d) => !enabled(d)));
        break;
    }
    return list;
  }, [params, state.selectedCategory, q, state.filter]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn("px-2 py-1 text-xs rounded whitespace-nowrap", state.filter === f.id ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground")}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground pr-1">{filtered.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((p) => {
          const isSel = p.id === selected;
          const depWarn = p.enabled && DEPENDENCIES[p.name]?.some((d) => !enabled(d));
          return (
            <button
              key={p.id}
              onClick={() => selectParameter(p.id)}
              className={cn("w-full text-left px-3 py-2 border-b border-border/50 hover:bg-accent/40 flex items-start gap-2", isSel && "bg-accent")}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", p.enabled ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                  <span className="font-mono text-sm truncate">{p.name}</span>
                  {p.modified && <span className="text-[10px] text-blue-500 font-medium">MOD</span>}
                  {depWarn && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{p.description || "Paramètre non documenté"}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">{p.file}</span>
                  <span className="text-xs font-mono truncate">{p.type === "flag" ? (p.enabled ? "ON" : "OFF") : String(p.value)}</span>
                </div>
              </div>
              {p.modified && (
                <button
                  onClick={(e) => { e.stopPropagation(); resetParam(currentProject.id, p.file, p); }}
                  className="text-muted-foreground hover:text-foreground p-1"
                  title="Réinitialiser"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Aucun paramètre</div>
        )}
      </div>
    </div>
  );
}