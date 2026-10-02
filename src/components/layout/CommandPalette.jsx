import React, { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { useProject } from "@/lib/projectStore";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { STUDIO_LIST } from "@/lib/studioOrder";

export default function CommandPalette({ open, onClose, setView }) {
  const { state, currentProject, selectParameter, setCategory, setView: _ } = useProject();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const params = currentProject?.allParameters || [];
  const commands = [
    { id: "v:projects", label: t("command.projects"), action: () => setView("projects") },
    { id: "v:dashboard", label: t("command.dashboard"), action: () => setView("dashboard") },
    { id: "v:config", label: t("command.config"), action: () => setView("config") },
    { id: "v:doctor", label: t("command.doctor"), action: () => setView("doctor") },
    { id: "v:diff", label: t("command.diff"), action: () => setView("diff") },
    { id: "v:history", label: t("command.history"), action: () => setView("history") },
    { id: "v:snapshots", label: t("command.snapshots"), action: () => setView("snapshots") },
    { id: "v:agent-build", label: t("command.agentBuild"), action: () => setView("agent-build") },
    { id: "v:printer", label: t("command.printer"), action: () => setView("printer") },
    { id: "v:code", label: t("command.code"), action: () => setView("code") },
    { id: "v:calculators", label: t("command.calculators"), action: () => setView("calculators") },
    { id: "v:gcode", label: t("command.gcode"), action: () => setView("gcode") },
    { id: "v:docs", label: t("command.docs"), action: () => setView("docs") },
    { id: "v:bootscreen", label: t("command.bootscreen"), action: () => setView("bootscreen") },
    { id: "v:speaker", label: t("command.speaker"), action: () => setView("speaker") },
    { id: "v:vibration", label: t("command.vibration"), action: () => setView("vibration") },
    { id: "v:migration", label: t("command.migration"), action: () => setView("migration") },
    { id: "v:git", label: t("command.git"), action: () => setView("git") },
    { id: "v:browser", label: t("command.browser"), action: () => setView("browser") },
    { id: "v:settings", label: t("command.settings"), action: () => setView("settings") },
  ];

  // Tous les Studios (voir studioOrder.js), numérotés dans l'ordre logique de
  // configuration, remplacent ici les trois entrées ad hoc ci-dessus
  // (bootscreen/speaker/vibration) : avant cet ajout, les 36 autres Studios
  // — Machine, PID, Probe & Endstop, Display, PlatformIO et les 30 assistants
  // de AllStudios.jsx — étaient introuvables via la palette de commandes.
  const studioCommands = STUDIO_LIST.map((s) => ({
    id: `v:${s.id}`,
    label: `#${s.number} ${s.label}`,
    sub: s.phaseTitle,
    action: () => setView(s.id),
  }));
  const commandsWithStudios = [...commands.filter((c) => !["v:bootscreen", "v:speaker", "v:vibration"].includes(c.id)), ...studioCommands];

  const paramResults = q
    ? params
        .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.description || "").toLowerCase().includes(q.toLowerCase()))
        .slice(0, 12)
    : [];

  const all = [...commandsWithStudios.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase())), ...paramResults.map((p) => ({ id: `p:${p.id}`, label: p.name, sub: p.description, param: p }))];

  function handleKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, all.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(all[idx]); }
    else if (e.key === "Escape") onClose();
  }

  function run(item) {
    if (!item) return;
    if (item.param) {
      selectParameter(item.param.id);
      setView("config");
    } else {
      item.action?.();
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl mx-4 bg-popover border border-border rounded-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={handleKey}
            placeholder={t("command.placeholder")}
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {all.map((item, i) => (
            <button
              key={item.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(item)}
              className={cn("w-full flex items-center gap-3 px-3 py-2 text-left text-sm", i === idx ? "bg-accent" : "hover:bg-accent/50")}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{item.label}</div>
                {item.sub && <div className="truncate text-xs text-muted-foreground">{item.sub}</div>}
              </div>
              {item.param && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.param.file}</span>}
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          ))}
          {all.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t("command.empty")}</div>}
        </div>
      </div>
    </div>
  );
}