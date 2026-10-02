import React, { useState } from "react";
import { useProject } from "@/lib/projectStore";
import { getCategoryMeta } from "@/lib/marlinKnowledge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  Info,
  Wrench,
  FileCode,
  Cpu,
  AlertTriangle,
  FlaskConical,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

export default function CategoryInfo({ compact = false }) {
  const { currentProject, state } = useProject();
  const { t, categoryMeta } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const id = state.selectedCategory;
  if (!id) return null;

  const meta = categoryMeta(id, getCategoryMeta(id));
  const activeCount = (currentProject?.allParameters || []).filter(p => p.category === id && p.enabled).length;
  const total = (currentProject?.allParameters || []).filter(p => p.category === id).length;
  const warningCount = meta.warnings?.length || 0;

  return (
    <section className="border-b border-border bg-muted/20 shrink-0">
      <div className={cn("px-3 py-2", !compact && "p-3")}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
            <Info className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-semibold text-sm truncate">{meta.name || id}</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                {activeCount}/{total}
              </span>
              {warningCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0"
                  title={`${warningCount} ${t("category.warnings")}`}
                >
                  <AlertTriangle className="w-3 h-3" />{warningCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={meta.purpose}>
              {meta.purpose}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background/70 text-[11px] hover:bg-accent shrink-0"
            title={expanded ? t("category.hideInfo") : t("category.showInfo")}
            aria-expanded={expanded}
          >
            <span className="hidden xl:inline">{expanded ? t("common.hide") : t("common.details")}</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className={cn("px-3 pb-3", !compact && "pb-3")}>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <InfoBlock icon={Wrench} title={t("category.use")} value={meta.when} />
            <InfoBlock icon={FileCode} title={t("category.files")} value={meta.files.join(" · ") || t("project.title")} />
            <InfoBlock icon={Cpu} title={t("category.hardware")} value={meta.hardware} />
            <InfoBlock icon={CheckCircle2} title={t("category.prerequisites")} value={meta.prerequisites.length ? meta.prerequisites.join(" · ") : t("common.noData")} />

            {warningCount > 0 && (
              <div className="col-span-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
                <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" /> À surveiller
                </div>
                <ul className="mt-1 space-y-0.5 text-muted-foreground leading-snug">
                  {meta.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            <InfoBlock icon={FlaskConical} title={t("category.test")} value={meta.test} />
            {meta.docs ? (
              <a
                href={meta.docs}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border bg-background/70 p-2 hover:bg-accent flex items-center gap-2 min-w-0"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{t("category.docs")}</span>
              </a>
            ) : (
              <div className="rounded-md border border-border bg-background/70 p-2 text-muted-foreground">{t("category.noDocs")}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function InfoBlock({ icon: Icon, title, value }) {
  return (
    <div className="rounded-md border border-border bg-background/70 p-2 min-w-0">
      <div className="flex items-center gap-1.5 font-medium truncate">
        <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="truncate">{title}</span>
      </div>
      <div className="mt-0.5 text-muted-foreground leading-snug break-words">{value}</div>
    </div>
  );
}
