import React from "react";
import { useProject } from "@/lib/projectStore";
import { History, RotateCcw } from "lucide-react";

export default function HistoryPanel() {
  const { state, currentProject } = useProject();
  const entries = (state.history[currentProject?.id] || []);

  if (!currentProject) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Aucun projet</div>;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <History className="w-4 h-4" />
        <h2 className="text-sm font-semibold">Historique</h2>
        <span className="ml-auto text-xs text-muted-foreground">{entries.length} opération(s)</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {entries.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Aucune modification enregistrée</div>}
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-sm py-1.5 border-b border-border/40">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{e.action}</div>
              <div className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()} · {e.file}:{e.line + 1}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}