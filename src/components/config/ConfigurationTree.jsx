import React from "react";
import { useProject } from "@/lib/projectStore";
import { CATEGORIES, SYSTEM_FILES } from "@/lib/marlinKnowledge";
import { cn } from "@/lib/utils";
import { Settings, Box, Cpu, Move, Flame, CircleDot, Square, Crosshair, Layers, Zap, Monitor, Save, Wifi, ShieldCheck, Wrench, Hash, FileCode } from "lucide-react";

const ICONS = { Settings, Box, Cpu, Move, Flame, CircleDot, Square, Crosshair, Layers, Zap, Monitor, Save, Wifi, ShieldCheck, Wrench };

export default function ConfigurationTree() {
  const { currentProject, state, setCategory, toggleFileActive } = useProject();
  const allParams = currentProject?.allParameters || [];
  const activeFiles = currentProject?.activeFiles || {};
  const selected = state.selectedCategory;

  const params = allParams.filter((p) => activeFiles[p.file] !== false);
  const projectFiles = Object.keys(currentProject?.parsedFiles || {});

  const counts = {};
  for (const p of params) if (p.modified) counts[p.category] = (counts[p.category] || 0) + 1;
  const total = {};
  for (const p of params) total[p.category] = (total[p.category] || 0) + 1;

  return (
    <div className="flex flex-col h-full">
      {/* Fichiers système */}
      <div className="px-3 py-2 border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Fichiers système</div>
        <div className="space-y-0.5">
          {projectFiles.map((f) => {
            const meta = SYSTEM_FILES.find((s) => s.name === f);
            const active = activeFiles[f] !== false;
            return (
              <button
                key={f}
                onClick={() => toggleFileActive(currentProject.id, f, !active)}
                className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent/50", !active && "opacity-50")}
                title={meta?.description || "Fichier de configuration"}
              >
                <span className={cn("w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0", active ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                  {active && <span className="text-[9px] leading-none">✓</span>}
                </span>
                <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs truncate flex-1 text-left">{f}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
        Catégories
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <button
          onClick={() => setCategory(null)}
          className={cn("w-full flex items-center justify-between px-3 py-1.5 text-sm", !selected ? "bg-accent font-medium" : "hover:bg-accent/50")}
        >
          <span>Tous les paramètres</span>
          <span className="text-xs text-muted-foreground">{params.length}</span>
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = ICONS[cat.icon] || Hash;
          const active = selected === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn("w-full flex items-center justify-between px-3 py-1.5 text-sm group", active ? "bg-accent font-medium" : "hover:bg-accent/50")}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{cat.name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                {counts[cat.id] > 0 && <span className="text-[10px] text-blue-500">{counts[cat.id]}</span>}
                <span className="text-xs text-muted-foreground">{total[cat.id] || 0}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}