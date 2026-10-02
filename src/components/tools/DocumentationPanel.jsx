import React, { useState, useMemo } from "react";
import { useProject } from "@/lib/projectStore";
import { PARAM_KNOWLEDGE, CATEGORIES } from "@/lib/marlinKnowledge";
import { BookOpen, Search, ExternalLink, HelpCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function DocumentationPanel() {
  const { currentProject } = useProject();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const params = currentProject?.allParameters || [];
  const documented = params.filter((p) => PARAM_KNOWLEDGE[p.name]);
  const filtered = useMemo(() => documented.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.description || "").toLowerCase().includes(q.toLowerCase())), [documented, q]);
  const [sel, setSel] = useState(null);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4" />
          <h2 className="text-sm font-semibold">{t("docsPanel.title")}</h2>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("docsPanel.searchPlaceholder")} className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((p) => {
          const meta = PARAM_KNOWLEDGE[p.name];
          return (
            <button key={p.id} onClick={() => setSel(p)} className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-accent/50">
              <div className="font-mono text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{meta?.description}</div>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">{t("docsPanel.none")}</div>}
      </div>
      {sel && (
        <div className="border-t border-border p-4 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-mono font-semibold text-sm">{sel.name}</h3>
            <button onClick={() => setSel(null)} className="text-xs text-muted-foreground">{t("docsPanel.close")}</button>
          </div>
          <p className="text-sm text-muted-foreground">{PARAM_KNOWLEDGE[sel.name]?.description}</p>
          <div className="text-xs mt-2"><span className="text-muted-foreground">{t("docsPanel.type")} </span><span className="font-mono">{sel.type}</span></div>
          <div className="text-xs mt-1"><span className="text-muted-foreground">{t("docsPanel.category")} </span>{CATEGORIES.find((c) => c.id === sel.category)?.name}</div>
          <a href={`https://marlinfw.org/docs/configuration/configuration.html`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="w-3 h-3" /> {t("docsPanel.official")}
          </a>
        </div>
      )}
      <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
        <HelpCircle className="w-3.5 h-3.5" />
        {t("docsPanel.footer")}
      </div>
    </div>
  );
}