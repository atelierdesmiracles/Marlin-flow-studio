import React, { useMemo } from "react";
import { useProject, computeDiff } from "@/lib/projectStore";
import { cn } from "@/lib/utils";
import { GitCompareArrows, Minus, Plus } from "lucide-react";

export default function DiffViewer() {
  const { currentProject } = useProject();
  const diffs = useMemo(() => (currentProject ? computeDiff(currentProject) : []), [currentProject]);

  if (!currentProject) return <Empty />;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <GitCompareArrows className="w-4 h-4" />
        <h2 className="text-sm font-semibold">Comparateur — {diffs.length} changement(s)</h2>
        <span className="ml-auto text-xs text-muted-foreground">{currentProject.name}</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {diffs.length === 0 && <div className="px-4 py-8 text-center text-muted-foreground">Aucun changement. La configuration correspond à l'originale.</div>}
        {diffs.map((d, i) => (
          <div key={i} className="border-b border-border/50">
            <div className="px-4 py-1.5 bg-muted/50 flex items-center gap-2">
              <span className="text-muted-foreground">{d.file}:{d.line + 1}</span>
              <span className="font-semibold">{d.name}</span>
              <span className="text-[10px] px-1 rounded bg-blue-500/10 text-blue-500">{d.type}</span>
            </div>
            <div className="px-4 py-1 flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-500/5">
              <Minus className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap break-all">{d.before}</span>
            </div>
            <div className="px-4 py-1 flex items-start gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
              <Plus className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap break-all">{d.after}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucun projet sélectionné</div>;
}