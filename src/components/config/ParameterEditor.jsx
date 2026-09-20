import React, { useEffect, useState } from "react";
import { useProject } from "@/lib/projectStore";
import { DEPENDENCIES, PARAM_KNOWLEDGE, getCategoryMeta } from "@/lib/marlinKnowledge";
import { cn } from "@/lib/utils";
import { agentApi } from "@/lib/localAgent";
import { RotateCcw, ExternalLink, AlertTriangle, Link2, BookOpen, Database, RefreshCw } from "lucide-react";

export default function ParameterEditor() {
  const { currentProject, state, toggleParam, updateValue, resetParam } = useProject();
  const param = currentProject?.allParameters.find((p) => p.id === state.selectedParameterId);
  const [smartOptions, setSmartOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      if (!currentProject?.localProjectPath) {
        setSmartOptions(null);
        return;
      }
      setOptionsLoading(true);
      setOptionsError("");
      try {
        const result = await agentApi.configurationOptions();
        if (!cancelled) setSmartOptions(result);
      } catch (error) {
        if (!cancelled) {
          setSmartOptions(null);
          setOptionsError(error?.message || "Options dynamiques indisponibles");
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }
    loadOptions();
    return () => { cancelled = true; };
  }, [currentProject?.localProjectPath]);

  if (!param) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
        <BookOpen className="w-8 h-8 mb-2 opacity-40" />
        Sélectionnez un paramètre pour l'éditer.
      </div>
    );
  }

  const meta = PARAM_KNOWLEDGE[param.name];
  const enabled = (name) => currentProject.allParameters.some((p) => p.name === name && p.enabled);
  const deps = DEPENDENCIES[param.name] || [];
  const missingDeps = deps.filter((d) => !enabled(d));
  const categoryMeta = getCategoryMeta(param.category);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", param.enabled ? "bg-emerald-500" : "bg-muted-foreground/40")} />
          <h2 className="font-mono text-base font-semibold">{param.name}</h2>
          {param.modified && <span className="text-[10px] text-blue-500 font-medium px-1.5 py-0.5 rounded bg-blue-500/10">MODIFIÉ</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {param.file} · ligne {param.line + 1} · {param.category}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="text-sm">{param.description || <span className="text-muted-foreground italic">Paramètre non documenté. Éditable comme macro générique.</span>}</div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Rôle</div><div className="mt-0.5 font-medium">{meta?.purpose || categoryMeta.purpose}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Risque</div><div className="mt-0.5 font-medium">{meta?.risk || "À évaluer selon le matériel"}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Unité</div><div className="mt-0.5 font-mono">{meta?.units || "—"}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">Test</div><div className="mt-0.5">{meta?.test || categoryMeta.test}</div></div>
        </div>

        {(meta?.warning || meta?.risk === "Critique") && (
          <div className="flex items-start gap-2 p-2.5 rounded border border-amber-500/20 bg-amber-500/5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{meta.warning || "Cette option peut empêcher le démarrage correct du firmware si elle ne correspond pas au matériel."}</span>
          </div>
        )}

        {/* Value control */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Valeur</label>
          {renderControl(param, (v) => updateValue(currentProject.id, param.file, param, v), smartOptions)}
        </div>

        {isSmartChoiceParameter(param.name) && (
          <div className="flex items-start gap-2 rounded border border-primary/10 bg-primary/[0.03] p-2 text-[11px] text-muted-foreground">
            <Database className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            <div className="flex-1">
              <div className="font-medium text-foreground">Choix assisté par le projet Marlin</div>
              <div>La liste est construite à partir des sources du projet lorsque l'Agent local les trouve. La valeur actuelle est toujours conservée même si elle n'est pas reconnue.</div>
              {optionsError && <div className="mt-1 text-amber-700 dark:text-amber-300">{optionsError}</div>}
            </div>
            {currentProject?.localProjectPath && (
              <button
                type="button"
                disabled={optionsLoading}
                onClick={async () => {
                  setOptionsLoading(true);
                  setOptionsError("");
                  try { setSmartOptions(await agentApi.configurationOptions()); }
                  catch (error) { setOptionsError(error?.message || "Impossible de relire les options du projet."); }
                  finally { setOptionsLoading(false); }
                }}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50"
                title="Relire les choix depuis le projet Marlin"
              >
                <RefreshCw className={cn("w-3 h-3", optionsLoading && "animate-spin")} />
                Relire
              </button>
            )}
          </div>
        )}

        {/* Enabled toggle */}
        <div className="flex items-center justify-between py-2 border-y border-border">
          <div>
            <div className="text-sm font-medium">État</div>
            <div className="text-xs text-muted-foreground">{param.enabled ? "ACTIVÉ" : "DÉSACTIVÉ"}</div>
          </div>
          <button
            onClick={() => toggleParam(currentProject.id, param.file, param)}
            className={cn("relative w-11 h-6 rounded-full transition-colors", param.enabled ? "bg-primary" : "bg-muted")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-background transition-all", param.enabled ? "left-5" : "left-0.5")} />
          </button>
        </div>

        {/* Dependencies */}
        {deps.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Link2 className="w-3.5 h-3.5" /> Dépendances</div>
            {deps.map((d) => {
              const dep = currentProject.allParameters.find((p) => p.name === d);
              const ok = enabled(d);
              return (
                <div key={d} className="flex items-center gap-2 text-sm">
                  <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
                  <span className="font-mono">{d}</span>
                  <span className="text-xs text-muted-foreground">{ok ? "satisfait" : "manquant"}</span>
                </div>
              );
            })}
          </div>
        )}

        {missingDeps.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Cette option nécessite : {missingDeps.join(", ")}.</span>
          </div>
        )}

        {/* Raw text preview */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Code source</div>
          <pre className="text-xs font-mono p-2 rounded bg-muted overflow-x-auto">{param.rawText}</pre>
          {param.modified && (
            <div className="text-xs">
              <span className="text-muted-foreground">Original : </span>
              <span className="font-mono line-through text-red-500/70">{param.originalRawText.trim()}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {param.modified && (
            <button
              onClick={() => resetParam(currentProject.id, param.file, param)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
            </button>
          )}
          {meta?.doc && (
            <a href={meta.doc} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted">
              <ExternalLink className="w-3.5 h-3.5" /> Documentation
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function renderControl(param, onChange, smartOptions) {
  const meta = PARAM_KNOWLEDGE[param.name];
  const smart = getSmartControl(param, smartOptions);
  const options = smart?.options?.length ? smart.options : (meta?.options || []);

  if (param.type === "flag") {
    return <div className="text-sm text-muted-foreground italic">Directive booléenne (activer/désactiver via l'état).</div>;
  }

  if (options.length) {
    return (
      <div className="space-y-1.5">
        <select
          value={String(param.value)}
          onChange={(e) => {
            const raw = e.target.value;
            const selected = options.find((o) => String(o.value) === raw);
            const value = selected?.value ?? raw;
            onChange(param.type === "number" || param.type === "float" ? Number(value) : value);
          }}
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {ensureCurrentOption(options, param.value).map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label || String(o.value)}
            </option>
          ))}
        </select>
        {smart?.source && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Database className="w-3 h-3" />
            Source : <span className="font-mono">{smart.source}</span>
          </div>
        )}
        {smart?.selectedDescription && (
          <div className="rounded bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
            {smart.selectedDescription}
          </div>
        )}
      </div>
    );
  }

  if (param.type === "string") {
    return <input value={param.value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono" />;
  }
  if (param.type === "array") {
    return <ArrayEditor value={param.value} onChange={onChange} />;
  }
  if (param.type === "number" || param.type === "float") {
    return (
      <input
        type="number"
        step={param.type === "float" ? "0.001" : "1"}
        value={param.value}
        onChange={(e) => onChange(param.type === "float" ? parseFloat(e.target.value) : Number(e.target.value))}
        className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono"
      />
    );
  }
  return (
    <input
      value={param.rawValue}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background font-mono"
    />
  );
}

function ensureCurrentOption(options, value) {
  const normalized = options.map((option) => typeof option === "object" ? option : ({ value: option, label: String(option) }));
  if (normalized.some((option) => String(option.value) === String(value))) return normalized;
  return [
    { value, label: `Valeur actuelle — ${String(value)}`, description: "Valeur présente dans le fichier de configuration mais absente des choix détectés." },
    ...normalized,
  ];
}

function isSmartChoiceParameter(name) {
  return name === "MOTHERBOARD"
    || /^TEMP_SENSOR(?:_|$)/.test(name)
    || name === "LCD_LANGUAGE"
    || /^SERIAL_PORT(?:_\d+)?$/.test(name)
    || name === "EXTRUDERS"
    || /_DRIVER_TYPE$/.test(name)
    || /_MICROSTEPS$/.test(name);
}

function getSmartControl(param, smartOptions) {
  const name = param.name;
  const base = { options: [], source: null, selectedDescription: null };
  if (name === "MOTHERBOARD") {
    const source = smartOptions?.board_source || "Marlin/src/core/boards.h";
    const options = (smartOptions?.boards || []).map((board) => ({
      value: board.value,
      label: board.label ? `${board.value} — ${board.label}` : board.value,
      description: board.description || "",
    }));
    return { ...base, options, source, selectedDescription: options.find((o) => String(o.value) === String(param.value))?.description || null };
  }
  if (/^TEMP_SENSOR(?:_|$)/.test(name)) {
    const options = (smartOptions?.temperature_sensors || fallbackTemperatureSensors()).map((sensor) => ({
      value: sensor.value,
      label: sensor.label || String(sensor.value),
      description: sensor.description || "",
    }));
    const source = smartOptions?.temperature_sensor_source || "liste Marlin + valeurs de compatibilité";
    return { ...base, options, source, selectedDescription: options.find((o) => String(o.value) === String(param.value))?.description || null };
  }
  if (name === "LCD_LANGUAGE") return { ...base, options: smartOptions?.languages || fallbackLanguages(), source: "marlin/configuration + langues connues" };
  if (/^SERIAL_PORT(?:_\d+)?$/.test(name)) return { ...base, options: smartOptions?.serial_ports || [], source: "Marlin / ports série" };
  if (name === "EXTRUDERS") return { ...base, options: smartOptions?.extruders || [], source: "Marlin / configuration extrudeur" };
  if (/_DRIVER_TYPE$/.test(name)) return { ...base, options: smartOptions?.drivers || [], source: "Marlin / drivers courants" };
  if (/_MICROSTEPS$/.test(name)) return { ...base, options: smartOptions?.microsteps || [], source: "Marlin / microsteps" };
  return base;
}

function fallbackTemperatureSensors() {
  return [
    { value: 0, label: "0 — Aucun capteur" },
    { value: 1, label: "1 — 100k thermistor (EPCOS)" },
    { value: 5, label: "5 — 100k thermistor (ATC Semitec 104GT-2)" },
    { value: 11, label: "11 — 100k thermistor (QU-BD)" },
    { value: 13, label: "13 — 100k thermistor (Hisens)" },
    { value: 20, label: "20 — PT100 / PT1000 (selon interface)" },
    { value: 51, label: "51 — thermistor 100k" },
    { value: 55, label: "55 — thermocouple" },
    { value: 60, label: "60 — PT100 / MAX31865" },
    { value: 66, label: "66 — thermistor" },
    { value: 67, label: "67 — thermistor" },
    { value: 70, label: "70 — thermistor" },
    { value: 998, label: "998 — thermocouple" },
    { value: 999, label: "999 — thermocouple" },
    { value: 1000, label: "1000 — capteur analogique" },
  ];
}

function fallbackLanguages() {
  return [
    { value: "en", label: "English" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "es", label: "Español" },
    { value: "it", label: "Italiano" },
    { value: "pt", label: "Português" },
    { value: "nl", label: "Nederlands" },
    { value: "ru", label: "Русский" },
    { value: "pl", label: "Polski" },
    { value: "tr", label: "Türkçe" },
  ];
}

function ArrayEditor({ value, onChange }) {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-1">
      {arr.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4">{i}</span>
          <input
            value={v}
            onChange={(e) => { const n = [...arr]; n[i] = e.target.value; onChange(n); }}
            className="flex-1 px-2 py-1 text-sm rounded border border-input bg-background font-mono"
          />
        </div>
      ))}
      <div className="text-xs text-muted-foreground font-mono">{`{ ${arr.join(", ")} }`}</div>
    </div>
  );
}