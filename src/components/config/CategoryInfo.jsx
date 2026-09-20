import React from "react";
import { useProject } from "@/lib/projectStore";
import { CATEGORIES, getCategoryMeta } from "@/lib/marlinKnowledge";
import { cn } from "@/lib/utils";
import { Info, Wrench, FileCode, Cpu, AlertTriangle, FlaskConical, ExternalLink, CheckCircle2 } from "lucide-react";

export default function CategoryInfo({ compact = false }) {
  const { currentProject, state } = useProject();
  const id = state.selectedCategory;
  if (!id) return null;
  const cat = CATEGORIES.find(c => c.id === id);
  const meta = getCategoryMeta(id);
  const activeCount = (currentProject?.allParameters || []).filter(p => p.category === id && p.enabled).length;
  const total = (currentProject?.allParameters || []).filter(p => p.category === id).length;

  return (
    <section className={cn("border-b border-border bg-muted/20", compact ? "px-3 py-2" : "p-4")}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary"><Info className="w-4 h-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-sm">{cat?.name || id}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{activeCount}/{total} activés</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{meta.purpose}</p>
        </div>
      </div>
      {!compact && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 mt-3 text-xs">
          <InfoBlock icon={Wrench} title="Quand l'utiliser" value={meta.when} />
          <InfoBlock icon={FileCode} title="Fichiers concernés" value={meta.files.join(" · ") || "Déterminé par le projet"} />
          <InfoBlock icon={Cpu} title="Matériel" value={meta.hardware} />
          <InfoBlock icon={CheckCircle2} title="Prérequis" value={meta.prerequisites.length ? meta.prerequisites.join(" · ") : "Aucun prérequis général"} />
          <div className="xl:col-span-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
            <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5" /> À surveiller</div>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">{meta.warnings.map((w,i)=><li key={i}>• {w}</li>)}</ul>
          </div>
          <InfoBlock icon={FlaskConical} title="Test conseillé" value={meta.test} />
          {meta.docs && <a href={meta.docs} target="_blank" rel="noreferrer" className="rounded-md border border-border p-2.5 hover:bg-accent flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5" /> Documentation Marlin</a>}
        </div>
      )}
    </section>
  );
}

function InfoBlock({ icon: Icon, title, value }) {
  return <div className="rounded-md border border-border bg-background/70 p-2.5"><div className="flex items-center gap-1.5 font-medium"><Icon className="w-3.5 h-3.5 text-muted-foreground" />{title}</div><div className="mt-1 text-muted-foreground leading-relaxed">{value}</div></div>;
}
