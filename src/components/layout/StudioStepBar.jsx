import React, { useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, ListFilter } from "lucide-react";
import { getStudioStep, STUDIO_COUNT, pad2 } from "@/lib/studioOrder.js";
import { useProject } from "@/lib/projectStore";
import { writableConfigFiles } from "@/lib/configFileModel";
import StudioMacroBrowser from "@/components/layout/StudioMacroBrowser";

// Bandeau affiché au-dessus de n'importe lequel des Studios de
// configuration (dédiés ou génériques via AllStudios.jsx). Un seul
// composant, branché une fois dans Home.jsx, suffit à donner à chaque
// Studio une navigation "précédent / suivant" cohérente avec l'ordre
// logique défini dans src/lib/studioOrder.js, sans modifier individuellement
// les composants.
export default function StudioStepBar({ view, setView }) {
  const [macrosOpen, setMacrosOpen] = useState(false);
  const { currentProject } = useProject();
  const writableFiles = new Set(writableConfigFiles(currentProject));
  const macroCount = (currentProject?.allParameters || []).filter((param) => writableFiles.has(param.file)).length;
  const step = getStudioStep(view);
  if (!step) return null;

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-1 border-b border-border bg-muted/20 px-2 py-2 text-sm md:gap-2 md:px-4">
        <button
          onClick={() => step.prev && setView(step.prev.id)}
          disabled={!step.prev}
          title={step.prev ? step.prev.label : "Premier Studio"}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/60 disabled:cursor-default disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /><span className="hidden md:inline">{step.prev ? step.prev.label : ""}</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">Étape {pad2(step.number)}/{STUDIO_COUNT}</span>
          <span className="truncate font-medium">{step.label}</span>
          <span className="hidden truncate text-xs text-muted-foreground lg:inline">· {step.phaseTitle}</span>
        </div>

        <button
          type="button"
          onClick={() => setMacrosOpen((open) => !open)}
          aria-expanded={macrosOpen}
          title="Afficher toutes les macros présentes dans le projet"
          className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted/60 ${macrosOpen ? "text-primary" : "text-muted-foreground"}`}
        >
          <ListFilter className="h-4 w-4" /><span className="hidden sm:inline">Macros ({macroCount})</span>
        </button>

        <button
          onClick={() => setView("studios")}
          title="Tous les Studios"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/60"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>

        <button
          onClick={() => step.next && setView(step.next.id)}
          disabled={!step.next}
          title={step.next ? step.next.label : "Dernier Studio"}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/60 disabled:cursor-default disabled:opacity-30"
        >
          <span className="hidden md:inline">{step.next ? step.next.label : ""}</span><ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <StudioMacroBrowser open={macrosOpen} />
    </div>
  );
}
