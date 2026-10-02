import React, { useMemo, useState } from "react";
import { Check, RotateCcw, Search, ToggleLeft } from "lucide-react";
import { useProject } from "@/lib/projectStore";
import { PARAM_KNOWLEDGE } from "@/lib/marlinKnowledge";
import { isWritableConfigParam, writableConfigFiles } from "@/lib/configFileModel";

const CATEGORY_LABELS = {
  general: "Général", machine: "Machine", board: "Carte", motion: "Mouvement",
  thermal: "Température", extruder: "Extrudeur", bed: "Plateau", probe: "Sonde / endstop",
  leveling: "Nivellement", drivers: "Moteurs / drivers", display: "Écran", eeprom: "EEPROM",
  network: "Réseau", safety: "Sécurité", advanced: "Avancé",
};

function displayValue(param) {
  if (param.type === "flag") return param.enabled ? "Activé" : "Désactivé";
  if (Array.isArray(param.value)) return param.value.join(" ");
  if (param.value == null) return "";
  return String(param.value);
}

function MacroEditor({ param, onSave }) {
  const [draft, setDraft] = useState(displayValue(param));
  const [saved, setSaved] = useState(false);
  const sensitive = /(PASSWORD|PASSWD|_PWD|SECRET|TOKEN)/i.test(param.name);

  const save = () => {
    let next = draft;
    if (param.type === "number" || param.type === "float") {
      if (!draft.trim()) return;
      next = Number(draft);
      if (!Number.isFinite(next)) return;
    } else if (param.type === "bool") {
      next = draft === "true";
    } else if (param.type === "array") {
      const parts = draft.trim().split(/[\s,;]+/).filter(Boolean);
      next = parts.map((part) => /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(part) ? Number(part) : part);
    }
    onSave(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  if (param.type === "flag") return null;
  const numeric = param.type === "number" || param.type === "float";
  return <div className="flex min-w-0 gap-1.5">
    {param.type === "bool" ? <select value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 font-mono text-xs">
      <option value="true">true</option><option value="false">false</option>
    </select> : <input
      aria-label={`Valeur de ${param.name}`}
      type={sensitive ? "password" : numeric ? "number" : "text"}
      step={numeric ? "any" : undefined}
      value={draft}
      onChange={(event) => { setDraft(event.target.value); setSaved(false); }}
      onKeyDown={(event) => { if (event.key === "Enter") save(); }}
      className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
    />}
    <button type="button" onClick={save} title={`Appliquer ${param.name}`} className="rounded border border-border px-2 text-muted-foreground hover:bg-muted" aria-label={`Appliquer ${param.name}`}>
      {saved ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Check className="h-3.5 w-3.5" />}
    </button>
  </div>;
}

export default function StudioMacroBrowser({ open }) {
  const { currentProject, updateValue, toggleParam, resetParam } = useProject();
  const [query, setQuery] = useState("");
  const editableFiles = useMemo(() => new Set(writableConfigFiles(currentProject)), [currentProject]);
  const parameters = useMemo(() => (currentProject?.allParameters || [])
    .filter((param) => isWritableConfigParam(currentProject, param))
    .filter((param) => param.name), [currentProject]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return parameters;
    return parameters.filter((param) => {
      const meta = PARAM_KNOWLEDGE[param.name] || {};
      return `${param.name} ${param.file} ${param.section || ""} ${meta.category || param.category || ""} ${meta.description || param.description || ""}`.toLocaleLowerCase().includes(needle);
    });
  }, [parameters, query]);

  if (!open) return null;
  if (!currentProject) return <div className="border-b border-border bg-card px-4 py-3 text-sm text-muted-foreground">Ouvre un projet Marlin pour afficher ses macros.</div>;

  const update = (param, value) => updateValue(currentProject.id, param.file, param, value);
  const toggle = (param) => toggleParam(currentProject.id, param.file, param);
  const reset = (param) => resetParam(currentProject.id, param.file, param);

  return <section className="border-b border-border bg-card px-3 py-3 md:px-5" aria-label="Macros de configuration détectées">
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <div className="text-sm font-semibold">Toutes les macros détectées</div>
      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{parameters.length} dans {Array.from(editableFiles).join(", ") || "aucun fichier"}</span>
      <span className="text-xs text-muted-foreground">Modifie ici les paramètres absents des cartes guidées.</span>
      <div className="relative ml-auto min-w-[190px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une macro…" className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring" />
      </div>
    </div>
    <div className="max-h-[38vh] space-y-1 overflow-y-auto pr-1">
      {filtered.map((param) => {
        const meta = PARAM_KNOWLEDGE[param.name] || {};
        const canEdit = param.directive !== "undef";
        const sensitive = /(PASSWORD|PASSWD|_PWD|SECRET|TOKEN)/i.test(param.name);
        return <article key={param.id} className="grid grid-cols-1 gap-2 rounded-md border border-border/70 bg-background/70 p-2 md:grid-cols-[minmax(190px,1.2fr)_minmax(180px,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <code className="truncate text-xs font-semibold">{param.name}</code>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{CATEGORY_LABELS[meta.category || param.category] || meta.category || param.category || "Avancé"}</span>
              {param.directive === "undef" && <span className="text-[9px] text-amber-700">#undef · lecture seule</span>}
              {param.directive !== "undef" && !param.commented && !param.active && <span className="text-[9px] text-amber-700">bloc conditionnel</span>}
              {param.modified && <span className="text-[9px] text-amber-700">modifié</span>}
            </div>
            <div className="truncate text-[10px] text-muted-foreground" title={meta.description || param.description || param.section || ""}>{meta.description || param.description || param.section || "Macro Marlin détectée"}{sensitive ? " · valeur masquée" : ""}</div>
            <div className="text-[9px] font-mono text-muted-foreground">{param.file}:{(param.line ?? 0) + 1}</div>
          </div>
          {canEdit ? param.type === "flag" ? <button type="button" onClick={() => toggle(param)} className={`flex items-center gap-2 rounded border px-2 py-1.5 text-left text-xs ${param.commented ? "border-border text-muted-foreground" : "border-emerald-500/30 text-emerald-700"}`}><ToggleLeft className="h-3.5 w-3.5" />{param.commented ? "Activer la macro" : "Commenter la macro"}</button> : <div className="flex min-w-0 items-center gap-1.5"><MacroEditor key={`${param.id}:${String(param.value)}`} param={param} onSave={(value) => update(param, value)} /><button type="button" onClick={() => toggle(param)} title={param.commented ? "Décommenter cette macro" : "Commenter cette macro"} className="shrink-0 rounded border border-border px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-muted">{param.commented ? "Activer" : "Désactiver"}</button></div> : <code className="truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">#undef {param.name}</code>}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground md:justify-end">
            <span className="mr-1 max-w-36 truncate" title={sensitive ? "Valeur masquée" : displayValue(param)}>{sensitive ? "••••••" : displayValue(param)}</span>
            {param.modified && <button type="button" onClick={() => reset(param)} title="Restaurer la valeur initiale" aria-label={`Restaurer ${param.name}`} className="rounded border border-border p-1 hover:bg-muted"><RotateCcw className="h-3 w-3" /></button>}
          </div>
        </article>;
      })}
      {!filtered.length && <div className="py-5 text-center text-sm text-muted-foreground">Aucune macro ne correspond à cette recherche.</div>}
    </div>
  </section>;
}
