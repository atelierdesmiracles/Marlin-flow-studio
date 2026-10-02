import React, { useEffect, useMemo, useState } from "react";
import { useProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import { findWritableParam, writableConfigFiles } from "@/lib/configFileModel";
import { Cpu, Ruler, Gauge, Save, AlertTriangle, RefreshCw, CheckCircle2, Settings2, Cable, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Machine Studio intentionally exposes only parameters that are actually
// present in the loaded Marlin configuration. It never invents a #define.
const SECTIONS = [
  {
    title: "Carte & communication",
    icon: Cpu,
    fields: [
      ["CUSTOM_MACHINE_NAME", "Nom de la machine", "texte", "text"],
      ["STRING_CONFIG_H_AUTHOR", "Auteur de Configuration.h", "texte", "text"],
      ["SERIAL_PORT", "Port série", "port", "select", [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      ["BAUDRATE", "Vitesse série", "bps", "select", [2400, 9600, 19200, 38400, 57600, 115200, 250000, 500000, 1000000]],
    ],
  },
  {
    title: "Géométrie réelle",
    icon: Ruler,
    fields: [
      ["X_BED_SIZE", "Largeur utile X", "mm", "number", 1],
      ["Y_BED_SIZE", "Profondeur utile Y", "mm", "number", 1],
      ["Z_MAX_POS", "Hauteur maximale Z", "mm", "number", 1],
      ["X_MIN_POS", "Limite X min", "mm", "number", 1],
      ["X_MAX_POS", "Limite X max", "mm", "number", 1],
      ["Y_MIN_POS", "Limite Y min", "mm", "number", 1],
      ["Y_MAX_POS", "Limite Y max", "mm", "number", 1],
      ["Z_MIN_POS", "Limite Z min", "mm", "number", 1],
    ],
  },
  {
    title: "Cinématique — Steps / mm",
    icon: Settings2,
    vectors: [["DEFAULT_AXIS_STEPS_PER_UNIT", "Steps/mm", "X", "Y", "Z", "E"]],
  },
  {
    title: "Cinématique — vitesses",
    icon: Gauge,
    vectors: [["DEFAULT_MAX_FEEDRATE", "Vitesse maximale", "X", "Y", "Z", "E"]],
  },
  {
    title: "Cinématique — accélérations",
    icon: Gauge,
    vectors: [["DEFAULT_MAX_ACCELERATION", "Accélération maximale", "X", "Y", "Z", "E"]],
    fields: [
      ["DEFAULT_ACCELERATION", "Accélération impression", "mm/s²", "number", 1],
      ["DEFAULT_RETRACT_ACCELERATION", "Accélération rétraction", "mm/s²", "number", 1],
      ["DEFAULT_TRAVEL_ACCELERATION", "Accélération déplacement", "mm/s²", "number", 1],
      ["JUNCTION_DEVIATION_MM", "Junction deviation", "mm", "number", 0.001],
      ["DEFAULT_MINIMUMFEEDRATE", "Vitesse minimale", "mm/s", "number", 0.01],
    ],
  },
  {
    title: "Homing",
    icon: Cable,
    fields: [
      ["HOMING_FEEDRATE_XY", "Vitesse homing X/Y", "mm/min", "number", 1],
      ["HOMING_FEEDRATE_Z", "Vitesse homing Z", "mm/min", "number", 1],
      ["Z_SAFE_HOMING_X_POINT", "Point X du Z Safe Homing", "mm", "number", 1],
      ["Z_SAFE_HOMING_Y_POINT", "Point Y du Z Safe Homing", "mm", "number", 1],
      ["MANUAL_X_HOME_POS", "Position Home X", "mm", "number", 0.1],
      ["MANUAL_Y_HOME_POS", "Position Home Y", "mm", "number", 0.1],
      ["MANUAL_Z_HOME_POS", "Position Home Z", "mm", "number", 0.1],
    ],
    flags: ["Z_SAFE_HOMING", "VALIDATE_HOMING_ENDSTOPS", "BED_CENTER_AT_0_0"],
  },
  {
    title: "Extrudeurs — configuration machine",
    icon: Settings2,
    fields: [
      ["EXTRUDERS", "Nombre d'extrudeurs", "E", "select", [1, 2, 3, 4, 5, 6, 7, 8]],
    ],
  },
];

const LABELS = {
  CUSTOM_MACHINE_NAME: "Nom de la machine",
  STRING_CONFIG_H_AUTHOR: "Auteur de Configuration.h",
  MOTHERBOARD: "Carte mère",
};

function findParam(project, name) {
  return findWritableParam(project, name);
}

function scalarValue(p) {
  if (Array.isArray(p?.value)) return p.value.join(", ");
  if (p?.value === true) return "";
  return p?.value ?? "";
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  const raw = String(value ?? "").replace(/[{}]/g, "").trim();
  return raw.split(/[ ,;]+/).filter(Boolean).map((x) => Number(x.replace(/[()]/g, "")));
}

function MachineStudioView() {
  const { currentProject, updateValue, toggleParam, updateProject, exportFile } = useProject();
  const [message, setMessage] = useState("");
  const [boardOptions, setBoardOptions] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [boardFamily, setBoardFamily] = useState("all");
  const [boardSource, setBoardSource] = useState("");
  const [saving, setSaving] = useState(false);

  const board = currentProject ? findParam(currentProject, "MOTHERBOARD") : null;
  const configurationFiles = useMemo(
    () => [...new Set((currentProject?.allParameters || [])
      .filter((p) => p && ["Configuration.h", "Configuration_adv.h", "Config.h"].includes(p.file))
      .map((p) => p.file))],
    [currentProject]
  );

  const notify = (text) => {
    setMessage(text);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setMessage(""), 2200);
  };

  const change = (name, value) => {
    if (!currentProject?.id) return;
    const p = findParam(currentProject, name);
    if (!p) return;
    updateValue(currentProject.id, p.file, p, value);
    notify(`${name} modifié`);
  };

  const toggle = (name) => {
    if (!currentProject?.id) return;
    const p = findParam(currentProject, name);
    if (!p) return;
    if (p.type === "flag") toggleParam(currentProject.id, p.file, p);
    else updateValue(currentProject.id, p.file, p, !Boolean(p.value));
    notify(`${name} ${p.enabled ? "désactivé" : "activé"}`);
  };

  const changeVector = (name, index, value) => {
    if (!currentProject?.id) return;
    const p = findParam(currentProject, name);
    if (!p) return;
    const arr = normalizeArray(p.value);
    while (arr.length < 4) arr.push(0);
    arr[index] = Number(value);
    updateValue(currentProject.id, p.file, p, arr);
  };

  const saveToDisk = async () => {
    setSaving(true);
    try {
      if (!currentProject?.localProjectPath) throw new Error("Aucun projet local sélectionné.");
      const writable = new Set(writableConfigFiles(currentProject));
      // Never lose board changes because a parser/category is incomplete:
      // MOTHERBOARD is always a Configuration.h directive when that file exists.
      const touched = [...new Set((currentProject.allParameters || [])
        .filter((p) => p.modified && writable.has(p.file) && ["machine", "motion", "board", "general", "extruder"].includes(p.category))
        .map((p) => p.file))];
      const motherboard = findParam(currentProject, "MOTHERBOARD");
      if (motherboard?.modified && writable.has("Configuration.h")) touched.push("Configuration.h");
      const uniqueTouched = [...new Set(touched)];
      if (!uniqueTouched.length) {
        notify("Aucune modification Machine à enregistrer.");
        return;
      }
      const files = Object.fromEntries(uniqueTouched.map((file) => [file, exportFile(currentProject.id, file)]));
      // Refuse to write an invalid/empty export. This catches stale parser state
      // before it reaches the Local Agent.
      for (const [filename, content] of Object.entries(files)) {
        if (!content || !content.trim()) throw new Error(`Le contenu exporté de ${filename} est vide.`);
      }
      if (motherboard?.modified && uniqueTouched.includes("Configuration.h")) {
        if (!/^\s*#define\s+MOTHERBOARD\s+.+$/m.test(files["Configuration.h"])) {
          throw new Error("MOTHERBOARD modifié mais absent de Configuration.h après sérialisation.");
        }
      }
      const hashes = Object.fromEntries(uniqueTouched.filter((f) => currentProject.localHashes?.[f]).map((f) => [f, currentProject.localHashes[f]]));
      await agentApi.selectProject(currentProject.localProjectPath);
      const result = await agentApi.applyConfiguration(files, hashes);
      const nextHashes = { ...(currentProject.localHashes || {}) };
      for (const item of result.written || []) nextHashes[item.filename] = item.sha256;
      updateProject({ ...currentProject, localHashes: nextHashes, updatedDate: new Date().toISOString() });
      notify("✓ Configuration réelle enregistrée — sauvegarde .bak créée");
    } catch (e) {
      notify(`Erreur d'enregistrement : ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const loadBoards = async () => {
    setLoadingBoards(true);
    try {
      if (typeof agentApi?.configurationOptions !== "function") throw new Error("Agent local : configurationOptions indisponible.");
      const result = await agentApi.configurationOptions();
      const raw = Array.isArray(result?.boards) || result?.boards ? result.boards : [];
      const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([value, label]) => ({ value, label: String(label) }));
      const normalized = list.map((x) => typeof x === "string" ? { value: x, label: x } : {
        value: x.value ?? x.name ?? x.id,
        label: x.label ?? x.name ?? x.value,
        description: x.description ?? x.label ?? "",
        id: x.id,
        source: x.source ?? result?.board_source ?? "",
      }).filter((x) => x.value);
      setBoardOptions(normalized);
      setBoardSource(result?.board_source || normalized.find((x) => x.source)?.source || "");
      notify(`✓ ${normalized.length} cartes mères détectées dans boards.h`);
    } catch (e) {
      notify(`Impossible de charger les cartes : ${e.message || e}`);
    } finally {
      setLoadingBoards(false);
    }
  };

  useEffect(() => { if (currentProject?.id) loadBoards(); }, [currentProject?.id]);

  const boardFamilies = useMemo(() => {
    const families = new Map();
    for (const b of boardOptions) {
      const family = String(b.value || "").replace(/^BOARD_/, "").split("_")[0] || "AUTRE";
      families.set(family, (families.get(family) || 0) + 1);
    }
    return [...families.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [boardOptions]);

  const filteredBoards = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    return boardOptions.filter((b) => {
      const value = String(b.value || "").toLowerCase();
      const label = String(b.label || "").toLowerCase();
      const family = String(b.value || "").replace(/^BOARD_/, "").split("_")[0] || "AUTRE";
      return (boardFamily === "all" || family === boardFamily) && (!q || value.includes(q) || label.includes(q) || String(b.description || "").toLowerCase().includes(q));
    });
  }, [boardOptions, boardSearch, boardFamily]);

  const renderField = ([name, label, unit, type, extra]) => {
    const p = findParam(currentProject, name);
    if (!p) return null;
    const value = scalarValue(p);
    return (
      <div key={name} className="rounded-lg border border-border p-3 bg-card/50">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div><div className="text-sm font-medium">{label}</div><div className="text-[10px] font-mono text-muted-foreground">#define {name}</div></div>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
        {type === "select" ? (
          <select value={String(value)} onChange={(e) => change(name, Number(e.target.value))} className="w-full px-3 py-2 rounded border border-input bg-background font-mono text-sm">
            {extra.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : (
          <input type={type === "number" ? "number" : "text"} step={type === "number" ? extra : undefined} value={value} onChange={(e) => change(name, type === "number" ? Number(e.target.value) : e.target.value)} className="w-full px-3 py-2 rounded border border-input bg-background font-mono text-sm" />
        )}
      </div>
    );
  };

  const renderVector = ([name, label, ...axes]) => {
    const p = findParam(currentProject, name);
    if (!p) return null;
    const arr = normalizeArray(p.value);
    return (
      <div key={name} className="rounded-lg border border-border p-3 bg-card/50">
        <div className="mb-3"><div className="text-sm font-medium">{label}</div><div className="text-[10px] font-mono text-muted-foreground">#define {name} &#123; X, Y, Z, E &#125;</div></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {axes.map((axis, i) => <label key={axis} className="text-xs text-muted-foreground">{axis}<input type="number" step={name.includes("STEPS") ? "0.001" : "0.1"} value={arr[i] ?? ""} onChange={(e) => changeVector(name, i, e.target.value)} className="mt-1 w-full px-2 py-2 rounded border border-input bg-background text-foreground font-mono" /></label>)}
        </div>
      </div>
    );
  };

  const renderFlag = (name) => {
    const p = findParam(currentProject, name);
    if (!p) return null;
    return <label key={name} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40"><span><span className="block text-sm font-medium">{name}</span><span className="text-[10px] text-muted-foreground">{p.file} · directive conditionnelle</span></span><input type="checkbox" checked={p.type === "flag" ? Boolean(p.enabled) : Boolean(p.value)} onChange={() => toggle(name)} className="w-4 h-4" /></label>;
  };

  const realParameters = useMemo(() => (currentProject?.allParameters || []).filter((p) => ["general", "machine", "board", "motion", "extruder"].includes(p.category)), [currentProject]);
  const preview = useMemo(() => realParameters.filter((p) => p.modified).map((p) => {
    const v = Array.isArray(p.value) ? `{ ${p.value.join(", ")} }` : (p.value === true ? "" : String(p.value));
    return `#define ${p.name}${v ? ` ${v}` : ""}`;
  }), [realParameters]);

  if (!currentProject) return <div className="p-8 text-muted-foreground">Ouvre d'abord un projet Marlin.</div>;

  return <div className="h-full overflow-y-auto p-5 space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-xl font-semibold flex items-center gap-2"><Cpu className="w-5 h-5 text-primary" /> Machine Studio</h1><p className="text-sm text-muted-foreground mt-1">Configuration machine basée uniquement sur les directives réellement présentes dans les fichiers Marlin chargés.</p></div>
      <div className="text-xs rounded-md border border-border px-3 py-2">{realParameters.length} paramètres réels détectés</div>
    </div>

    <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center gap-2 font-semibold"><FileCode2 className="w-4 h-4" /> Ce qui est réellement écrit</div>
      <p className="text-xs text-muted-foreground">Le Studio modifie les macros existantes de <span className="font-mono">Configuration.h</span> / <span className="font-mono">Configuration_adv.h</span>. Il conserve la structure et les commentaires du fichier. Une option absente n'est pas créée par ce Studio.</p>
      <div className="flex flex-wrap gap-2">{configurationFiles.map((f) => <span key={f} className="text-[10px] font-mono rounded border px-2 py-1">{f}</span>)}</div>
    </section>

    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><Cpu className="w-4 h-4" /> Carte mère — MOTHERBOARD</div><div className="text-[11px] text-muted-foreground mt-1">Sélection issue directement de <span className="font-mono">boards.h</span> du Marlin chargé.</div></div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="rounded-full border px-2 py-1">{boardOptions.length} cartes</span><button onClick={loadBoards} disabled={loadingBoards} className="px-2 py-2 rounded border border-border hover:bg-muted disabled:opacity-50"><RefreshCw className={cn("w-4 h-4", loadingBoards && "animate-spin")} /></button></div></div>
      {board ? <>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2"><input value={boardSearch} onChange={(e) => setBoardSearch(e.target.value)} placeholder="Rechercher BTT, Creality, MKS, RAMPS…" className="w-full px-3 py-2 rounded border border-input bg-background text-sm" /><select value={boardFamily} onChange={(e) => setBoardFamily(e.target.value)} className="w-full px-3 py-2 rounded border border-input bg-background text-sm"><option value="all">Toutes les familles</option>{boardFamilies.map(([family, count]) => <option key={family} value={family}>{family} ({count})</option>)}</select></div>
        <select value={String(board.value ?? "")} onChange={(e) => change("MOTHERBOARD", e.target.value)} className="w-full px-3 py-2 rounded border border-input bg-background font-mono text-sm"><option value="">Sélectionner la carte…</option>{filteredBoards.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.value}</option>)}{board.value && !boardOptions.some((o) => String(o.value) === String(board.value)) && <option value={board.value}>{board.value} — valeur actuelle non cataloguée</option>}</select>
        <div className="flex flex-wrap justify-between gap-2 text-[10px] text-muted-foreground"><span>{filteredBoards.length} résultat(s)</span>{boardSource && <span className="font-mono">source : {boardSource}</span>}</div>
      </> : <div className="text-sm text-amber-700 dark:text-amber-300">MOTHERBOARD n'est pas présent dans les fichiers chargés.</div>}
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {SECTIONS.map((section) => {
        const fields = (section.fields || []).map(renderField).filter(Boolean);
        const vectors = (section.vectors || []).map(renderVector).filter(Boolean);
        const flags = (section.flags || []).map(renderFlag).filter(Boolean);
        if (!fields.length && !vectors.length && !flags.length) return null;
        const Icon = section.icon;
        return <section key={section.title} className="rounded-xl border border-border bg-card p-4 space-y-3"><h2 className="font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{section.title}</h2>{fields}{vectors}{flags}</section>;
      })}
    </div>

    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-2"><div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Vérification avant compilation</div><div>Une carte mère erronée peut sélectionner un mauvais MCU/pinout. Les dimensions et limites incorrectes peuvent provoquer des déplacements hors zone. Compile toujours avant de flasher.</div><div className="font-mono">Configuration.h → MOTHERBOARD · géométrie · motion · homing</div></section>

    {preview.length > 0 && <section className="rounded-xl border border-border bg-card p-4 space-y-2"><div className="font-semibold flex items-center gap-2"><FileCode2 className="w-4 h-4 text-primary" /> Aperçu exact des directives modifiées</div><pre className="max-h-64 overflow-auto rounded-lg bg-black/5 dark:bg-white/5 p-3 text-xs font-mono whitespace-pre-wrap">{preview.join("\n")}</pre></section>}

    <section className="sticky bottom-3 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-lg flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground">Écriture réelle avec contrôle SHA-256 et sauvegarde <span className="font-mono">.bak</span>.</div><button onClick={saveToDisk} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Save className="w-4 h-4 inline mr-1" />{saving ? "Enregistrement…" : "Enregistrer sur le PC"}</button></section>
    {message && <div className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg border border-emerald-500/30 bg-card shadow-lg text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{message}</div>}
  </div>;
}

class MachineStudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[Machine Studio] Erreur de rendu", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const error = this.state.error;
    return (
      <div className="h-full overflow-auto p-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <h2 className="font-semibold">Machine Studio — erreur d’affichage</h2>
              <p className="text-sm text-muted-foreground">Le Studio n’a pas pu afficher les données du projet. Le reste de l’application reste disponible.</p>
            </div>
          </div>
          <pre className="rounded-lg bg-black/5 dark:bg-white/5 p-3 text-xs whitespace-pre-wrap overflow-auto">{String(error?.stack || error?.message || error)}</pre>
          <button onClick={() => this.setState({ error: null })} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground">Réessayer</button>
        </div>
      </div>
    );
  }
}

export default function MachineStudio() {
  return <MachineStudioErrorBoundary><MachineStudioView /></MachineStudioErrorBoundary>;
}
