import React, { useMemo, useState } from "react";
import { useProject, parseProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, CircleDot,
  Copy, FileCode2, Gauge, Info, Magnet, RotateCcw, Save, ShieldCheck,
  SlidersHorizontal, Wrench
} from "lucide-react";

const PROBE_PROFILES = [
  {
    id: "none",
    name: "Pas de probe",
    icon: CircleDot,
    description: "Configuration classique avec fin de course Z.",
    defines: []
  },
  {
    id: "inductive",
    name: "Probe inductive / capacitive",
    icon: Magnet,
    description: "Capteur fixe sans servo. Très courant sur les imprimantes DIY.",
    defines: ["FIX_MOUNTED_PROBE"]
  },
  {
    id: "bltouch",
    name: "BLTouch / 3DTouch",
    icon: Activity,
    description: "Probe servo avec commande de déploiement/rétraction.",
    defines: ["BLTOUCH"]
  },
  {
    id: "klicky",
    name: "Klicky / dockable",
    icon: Wrench,
    description: "Probe mécanique amovible. Vérifier les macros de dock dans votre configuration.",
    defines: ["FIX_MOUNTED_PROBE"]
  },
  {
    id: "custom",
    name: "Probe personnalisé",
    icon: SlidersHorizontal,
    description: "Configuration manuelle des options Marlin.",
    defines: []
  }
];

const ENDSTOP_AXES = ["X", "Y", "Z"];
const ENDSTOP_TYPES = ["MIN", "MAX"];

function hasDefine(text, name) {
  return new RegExp(`^\\s*#\\s*define\\s+${name}\\b`, "m").test(text || "");
}

function getDefine(text, name, fallback = "") {
  const re = new RegExp(`^\\s*#\\s*define\\s+${name}\\s+([^\\s/]+)`, "m");
  const m = String(text || "").match(re);
  return m ? m[1] : fallback;
}

function setDefine(text, name, value = null, enabled = true) {
  const source = String(text || "");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const active = new RegExp(`^\\s*#\\s*define\\s+${escaped}\\b.*$`, "m");
  const commented = new RegExp(`^\\s*//\\s*#\\s*define\\s+${escaped}\\b.*$`, "m");
  const line = value == null ? `#define ${name}` : `#define ${name} ${value}`;
  if (enabled) {
    if (active.test(source)) return source.replace(active, line);
    if (commented.test(source)) return source.replace(commented, line);
    return `${source.replace(/\s*$/, "")}\n\n${line}\n`;
  }
  if (active.test(source)) return source.replace(active, `// ${line}`);
  return source;
}

function removeDefine(text, name) {
  return setDefine(text, name, null, false);
}

function detectConfigFile(project) {
  if (project?.parsedFiles?.["Configuration.h"]) return "Configuration.h";
  if (project?.parsedFiles?.["Config.h"]) return "Config.h";
  return null;
}

function detectState(project) {
  const file = detectConfigFile(project);
  const text = file ? project.parsedFiles[file].content : "";
  const probe =
    hasDefine(text, "BLTOUCH") ? "bltouch" :
    hasDefine(text, "FIX_MOUNTED_PROBE") ? "inductive" : "none";
  const leveling =
    hasDefine(text, "AUTO_BED_LEVELING_UBL") ? "UBL" :
    hasDefine(text, "AUTO_BED_LEVELING_LINEAR") ? "LINEAR" :
    hasDefine(text, "AUTO_BED_LEVELING_3POINT") ? "3POINT" :
    hasDefine(text, "MESH_BED_LEVELING") ? "MESH" :
    hasDefine(text, "AUTO_BED_LEVELING_BILINEAR") ? "BILINEAR" : "NONE";

  const endstops = {};
  for (const axis of ENDSTOP_AXES) {
    for (const type of ENDSTOP_TYPES) {
      const name = `${axis}_ENDSTOP_${type}`;
      endstops[name] = hasDefine(text, name);
    }
  }
  return {
    file,
    text,
    probe,
    leveling,
    useProbeForZ: hasDefine(text, "USE_PROBE_FOR_Z_HOMING"),
    safeZ: hasDefine(text, "Z_SAFE_HOMING"),
    probeOnZMin: hasDefine(text, "Z_MIN_PROBE_USES_Z_MIN_ENDSTOP_PIN"),
    pullups: hasDefine(text, "ENDSTOPPULLUPS"),
    endstops
  };
}

function buildConfig(text, state) {
  let out = text;

  // Probe family
  out = removeDefine(out, "BLTOUCH");
  out = removeDefine(out, "FIX_MOUNTED_PROBE");
  if (state.probe === "bltouch") out = setDefine(out, "BLTOUCH");
  if (state.probe === "inductive" || state.probe === "klicky") out = setDefine(out, "FIX_MOUNTED_PROBE");

  out = state.useProbeForZ ? setDefine(out, "USE_PROBE_FOR_Z_HOMING") : removeDefine(out, "USE_PROBE_FOR_Z_HOMING");
  out = state.safeZ ? setDefine(out, "Z_SAFE_HOMING") : removeDefine(out, "Z_SAFE_HOMING");
  out = state.probeOnZMin ? setDefine(out, "Z_MIN_PROBE_USES_Z_MIN_ENDSTOP_PIN") : removeDefine(out, "Z_MIN_PROBE_USES_Z_MIN_ENDSTOP_PIN");

  const levelingNames = [
    "AUTO_BED_LEVELING_BILINEAR",
    "AUTO_BED_LEVELING_LINEAR",
    "AUTO_BED_LEVELING_3POINT",
    "AUTO_BED_LEVELING_UBL",
    "MESH_BED_LEVELING"
  ];
  for (const name of levelingNames) {
    out = removeDefine(out, name);
  }
  if (state.leveling !== "NONE") {
    const map = {
      BILINEAR: "AUTO_BED_LEVELING_BILINEAR",
      LINEAR: "AUTO_BED_LEVELING_LINEAR",
      "3POINT": "AUTO_BED_LEVELING_3POINT",
      UBL: "AUTO_BED_LEVELING_UBL",
      MESH: "MESH_BED_LEVELING"
    };
    out = setDefine(out, map[state.leveling]);
  }

  out = state.pullups ? setDefine(out, "ENDSTOPPULLUPS") : removeDefine(out, "ENDSTOPPULLUPS");

  // The physical presence of endstops is tracked by the wizard but is not
  // converted into invented Marlin defines: board-specific pins are normally
  // supplied by Marlin's pins files and by the selected motherboard.
  if (state.probePin.trim()) {
    out = setDefine(out, "Z_MIN_PROBE_PIN", state.probePin.trim());
  }

  if (state.zProbeOffset !== "") {
    out = setDefine(out, "NOZZLE_TO_PROBE_OFFSET", `{ 0, 0, ${Number(state.zProbeOffset).toFixed(2)} }`);
  }
  if (state.zSafeX !== "" && state.zSafeY !== "") {
    out = setDefine(out, "Z_SAFE_HOMING_X_POINT", Number(state.zSafeX).toFixed(1));
    out = setDefine(out, "Z_SAFE_HOMING_Y_POINT", Number(state.zSafeY).toFixed(1));
  }

  return out;
}

function Button({ children, onClick, disabled, active, className = "" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-2 rounded-md border text-sm transition-colors disabled:opacity-40 ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, suffix, help }) {
  return (
    <label className="block">
      <div className="text-xs font-medium mb-1">{label}</div>
      <div className="flex">
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-2 rounded-l-md border border-input bg-background text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        {suffix && <span className="px-2 py-2 border border-l-0 border-input rounded-r-md text-xs text-muted-foreground bg-muted">{suffix}</span>}
      </div>
      {help && <div className="mt-1 text-[11px] text-muted-foreground">{help}</div>}
    </label>
  );
}

export default function ProbeEndstopStudio() {
  const { currentProject, updateProject, exportFile } = useProject();
  const detected = useMemo(() => detectState(currentProject), [currentProject]);
  const [step, setStep] = useState(0);
  const [probe, setProbe] = useState(detected.probe);
  const [leveling, setLeveling] = useState(detected.leveling);
  const [useProbeForZ, setUseProbeForZ] = useState(detected.useProbeForZ);
  const [safeZ, setSafeZ] = useState(detected.safeZ);
  const [probeOnZMin, setProbeOnZMin] = useState(detected.probeOnZMin);
  const [pullups, setPullups] = useState(detected.pullups);
  const [endstops, setEndstops] = useState(detected.endstops);
  const [zProbeOffset, setZProbeOffset] = useState("");
  const [probePin, setProbePin] = useState("");
  const [zSafeX, setZSafeX] = useState("");
  const [zSafeY, setZSafeY] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  const profile = PROBE_PROFILES.find((p) => p.id === probe) || PROBE_PROFILES[0];
  const file = detected.file;

  function resetFromFile() {
    const d = detectState(currentProject);
    setProbe(d.probe);
    setLeveling(d.leveling);
    setUseProbeForZ(d.useProbeForZ);
    setSafeZ(d.safeZ);
    setProbeOnZMin(d.probeOnZMin);
    setPullups(d.pullups);
    setEndstops(d.endstops);
    setMessage("État relu depuis le fichier de configuration.");
  }

  function makeState() {
    return { probe, leveling, useProbeForZ, safeZ, probeOnZMin, pullups, endstops, probePin, zProbeOffset, zSafeX, zSafeY };
  }

  function generatePreview() {
    if (!file) return;
    const next = buildConfig(detected.text, makeState());
    setPreview(next);
    setMessage("Prévisualisation générée. Vérifiez notamment les pins et la logique active avant compilation.");
  }

  function applyToProject() {
    if (!currentProject || !file) {
      setMessage("Aucun fichier Config.h / Configuration.h chargé.");
      return;
    }
    const nextText = buildConfig(detected.text, makeState());
    const files = {};
    for (const name of Object.keys(currentProject.parsedFiles || {})) {
      files[name] = exportFile(currentProject.id, name);
    }
    files[file] = nextText;
    const next = parseProject({
      ...currentProject,
      files,
      updatedDate: new Date().toISOString()
    });
    updateProject(next);
    setPreview(nextText);
    setMessage("Configuration appliquée au projet. Utilisez ensuite « Enregistrer sur le PC » pour l'écrire sur le disque.");
  }

  async function applyAndWrite() {
    if (!currentProject || !file) {
      setMessage("Aucun fichier de configuration disponible.");
      return;
    }
    setBusy(true);
    try {
      const nextText = buildConfig(detected.text, makeState());
      const files = {};
      for (const name of Object.keys(currentProject.parsedFiles || {})) files[name] = exportFile(currentProject.id, name);
      files[file] = nextText;

      const expected = {};
      if (currentProject.localHashes?.[file]) expected[file] = currentProject.localHashes[file];

      await agentApi.selectProject(currentProject.localProjectPath);
      const result = await agentApi.applyConfiguration({ [file]: nextText }, expected);
      const hashes = { ...(currentProject.localHashes || {}) };
      for (const item of result.written || []) hashes[item.filename] = item.sha256;

      const next = parseProject({
        ...currentProject,
        files,
        localHashes: hashes,
        updatedDate: new Date().toISOString()
      });
      updateProject(next);
      setPreview(nextText);
      setMessage("Configuration appliquée et enregistrée sur le projet local.");
    } catch (e) {
      setMessage(e?.message || "Écriture impossible sur le projet local.");
    } finally {
      setBusy(false);
    }
  }

  function toggleEndstop(name) {
    setEndstops((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  const warnings = [];
  if (probe !== "none" && !useProbeForZ) warnings.push("La probe est sélectionnée mais n'est pas utilisée pour le homing Z.");
  if (probe === "bltouch" && !safeZ) warnings.push("BLTouch sans Z_SAFE_HOMING : vérifiez la procédure de homing et la zone de mesure.");
  if (probeOnZMin) warnings.push("La probe partage l'entrée Z_MIN : le câblage et la logique du endstop Z doivent correspondre à cette architecture.");
  if (leveling !== "NONE" && probe === "none") warnings.push("Un nivellement automatique est activé sans profil de probe. Vérifiez votre architecture.");
  if (leveling === "NONE" && probe !== "none") warnings.push("Aucun mode de bed leveling n'est sélectionné. La probe peut néanmoins être utilisée uniquement pour le homing Z.");
  if (Object.values(endstops).filter(Boolean).length === 0) warnings.push("Aucun endstop explicite n'est sélectionné dans l'assistant. Les définitions de carte peuvent néanmoins fournir les entrées par défaut.");

  const steps = [
    { title: "Probe", icon: Activity },
    { title: "Homing Z", icon: Gauge },
    { title: "Endstops", icon: ShieldCheck },
    { title: "Nivellement", icon: SlidersHorizontal },
    { title: "Vérification", icon: CheckCircle2 }
  ];

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
          <h2 className="text-lg font-semibold">Probe & Endstop Studio</h2>
          <p className="mt-2 text-sm text-muted-foreground">Ouvrez ou importez un projet Marlin pour lancer l'assistant de configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-4">
        <header className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Probe & Endstop Studio</h1>
            <p className="text-sm text-muted-foreground">
              Assistant guidé pour configurer les probes, le homing Z, les endstops et le bed leveling.
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono">{file || "aucun fichier"}</div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.title}
                onClick={() => setStep(i)}
                className={`p-2.5 rounded-lg border text-left ${step === i ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{i + 1}. {s.title}</span>
                </div>
              </button>
            );
          })}
        </div>

        <section className="rounded-xl border bg-card p-4 lg:p-5">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">1. Type de probe</h2>
                <p className="text-sm text-muted-foreground mt-1">Choisissez le type qui correspond réellement au câblage de votre imprimante.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Type de probe</label>
                <select value={probe} onChange={(e) => setProbe(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  {PROBE_PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {(() => { const selected = PROBE_PROFILES.find(p => p.id === probe); return selected ? <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">{selected.description}</div> : null; })()}
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 p-3 rounded-lg border">
                  <input type="checkbox" checked={probeOnZMin} onChange={(e) => setProbeOnZMin(e.target.checked)} />
                  <span className="text-sm">Probe sur entrée Z_MIN</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-lg border">
                  <input type="checkbox" checked={pullups} onChange={(e) => setPullups(e.target.checked)} />
                  <span className="text-sm">Pull-ups endstops</span>
                </label>
                <div className="p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
                  Profil sélectionné : <strong className="text-foreground">{profile.name}</strong>
                </div>
                <label className="block p-3 rounded-lg border">
                  <div className="text-xs font-medium mb-1">Pin probe (optionnel)</div>
                  <input value={probePin} onChange={(e) => setProbePin(e.target.value)} placeholder="ex. PA1 / 32" className="w-full px-2 py-1.5 rounded border border-input bg-background text-xs font-mono" />
                  <div className="text-[10px] text-muted-foreground mt-1">N'écrivez ce pin que si vous l'avez vérifié pour votre carte.</div>
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">2. Homing Z et offset</h2>
                <p className="text-sm text-muted-foreground mt-1">Ces paramètres déterminent comment Marlin utilise la probe pendant le référencement.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 p-4 rounded-lg border">
                  <input type="checkbox" className="mt-1" checked={useProbeForZ} onChange={(e) => setUseProbeForZ(e.target.checked)} />
                  <span><b className="text-sm">USE_PROBE_FOR_Z_HOMING</b><span className="block text-xs text-muted-foreground mt-1">Utiliser la probe pour le homing Z.</span></span>
                </label>
                <label className="flex items-start gap-3 p-4 rounded-lg border">
                  <input type="checkbox" className="mt-1" checked={safeZ} onChange={(e) => setSafeZ(e.target.checked)} />
                  <span><b className="text-sm">Z_SAFE_HOMING</b><span className="block text-xs text-muted-foreground mt-1">Déplacer la tête vers une zone sûre avant le homing Z.</span></span>
                </label>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Offset Z probe" value={zProbeOffset} onChange={setZProbeOffset} suffix="mm" help="Valeur à confirmer avec une procédure de calibration Z-offset." />
                <Field label="Point X du Z_SAFE_HOMING" value={zSafeX} onChange={setZSafeX} suffix="mm" />
                <Field label="Point Y du Z_SAFE_HOMING" value={zSafeY} onChange={setZSafeY} suffix="mm" />
              </div>
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs">
                <Info className="inline w-3.5 h-3.5 mr-1" />
                L'assistant ne devine pas la broche MCU : elle dépend de la carte. Le pin doit être vérifié dans les fichiers de pins Marlin et avec le schéma de câblage.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">3. Endstops X / Y / Z</h2>
                <p className="text-sm text-muted-foreground mt-1">Déclarez la topologie physique de votre machine. Le studio utilise ces informations pour les contrôles de cohérence ; les pins restent ceux de la carte Marlin.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="border-b"><th className="text-left p-2">Axe</th>{ENDSTOP_TYPES.map((t) => <th key={t} className="p-2 text-left">{t}</th>)}</tr></thead>
                  <tbody>
                    {ENDSTOP_AXES.map((axis) => (
                      <tr key={axis} className="border-b last:border-0">
                        <td className="p-2 font-semibold">{axis}</td>
                        {ENDSTOP_TYPES.map((type) => {
                          const name = `${axis}_ENDSTOP_${type}`;
                          return (
                            <td key={type} className="p-2">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!endstops[name]} onChange={() => toggleEndstop(name)} />
                                <span>{endstops[name] ? "Présent" : "Absent"}</span>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border text-xs">
                  <b>Logique électrique</b>
                  <p className="mt-1 text-muted-foreground">Le studio ne force pas l'inversion des endstops : HIGH/LOW dépend du câblage, des pull-ups et de la carte.</p>
                </div>
                <div className="p-3 rounded-lg border text-xs">
                  <b>Test recommandé</b>
                  <p className="mt-1 text-muted-foreground">Après flash : M119, puis actionnez chaque endstop séparément. Ne lancez pas un homing à l'aveugle.</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">4. Bed leveling</h2>
                <p className="text-sm text-muted-foreground mt-1">Choisissez le moteur de nivellement utilisé avec votre probe.</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ["NONE", "Aucun", "Probe uniquement pour le homing ou les mesures manuelles."],
                  ["BILINEAR", "Bilinear", "Sonde une grille et corrige la hauteur localement."],
                  ["UBL", "UBL", "Universal Bed Leveling avec mesh plus avancé."],
                  ["LINEAR", "Linear", "Nivellement par approximation plane."],
                  ["3POINT", "3 points", "Plan calculé à partir de trois points."],
                  ["MESH", "Mesh Bed Leveling", "Mesh piloté manuellement."]
                ].map(([id, name, desc]) => (
                  <button key={id} onClick={() => setLeveling(id)} className={`text-left p-4 rounded-lg border ${leveling === id ? "border-primary ring-1 ring-primary bg-accent" : "hover:bg-accent/50"}`}>
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                  </button>
                ))}
              </div>
              {leveling !== "NONE" && probe === "none" && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-300">
                  Une méthode de leveling automatique nécessite une source de mesure cohérente. Vérifiez la probe ou la méthode de palpage avant compilation.
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">5. Vérification avant application</h2>
                <p className="text-sm text-muted-foreground mt-1">Le studio vérifie la cohérence de la configuration choisie sans prétendre connaître votre câblage physique.</p>
              </div>
              {warnings.length ? (
                <div className="space-y-2">
                  {warnings.map((w) => <div key={w} className="flex gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><span>{w}</span></div>)}
                </div>
              ) : (
                <div className="flex gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Aucun conflit évident détecté par l'assistant.
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg border">
                  <div className="text-xs text-muted-foreground">Probe</div>
                  <div className="font-medium mt-1">{profile.name}</div>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="text-xs text-muted-foreground">Leveling</div>
                  <div className="font-medium mt-1">{leveling}</div>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="text-xs text-muted-foreground">Homing Z</div>
                  <div className="font-medium mt-1">{useProbeForZ ? "Probe" : "Endstop Z"}</div>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="text-xs text-muted-foreground">Endstops sélectionnés</div>
                  <div className="font-medium mt-1">{Object.values(endstops).filter(Boolean).length} / 6</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={generatePreview}><FileCode2 className="w-4 h-4 inline mr-1" />Prévisualiser</Button>
                <Button onClick={applyToProject} active><CheckCircle2 className="w-4 h-4 inline mr-1" />Appliquer au projet</Button>
                <Button onClick={applyAndWrite} disabled={busy}><Save className="w-4 h-4 inline mr-1" />{busy ? "Écriture..." : "Appliquer + écrire sur le PC"}</Button>
                <Button onClick={resetFromFile}><RotateCcw className="w-4 h-4 inline mr-1" />Relire la configuration</Button>
              </div>
            </div>
          )}
        </section>

        {message && <div className="p-3 rounded-lg border text-sm bg-muted/30">{message}</div>}

        {preview && (
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <FileCode2 className="w-4 h-4" />
              <span className="font-medium text-sm">Prévisualisation de {file}</span>
              <button
                type="button"
                className="ml-auto p-1.5 rounded hover:bg-accent"
                title="Copier"
                onClick={() => navigator.clipboard?.writeText(preview)}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <pre className="max-h-72 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap">{preview}</pre>
          </section>
        )}

        <footer className="text-xs text-muted-foreground flex gap-2 items-start">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Important : l'assistant configure les directives Marlin ; il ne peut pas valider physiquement le câblage, la tension, la polarité ou la broche MCU. Toujours vérifier <code>M119</code> et effectuer les premiers homings à vitesse réduite, prêt à couper l'alimentation.
          </span>
        </footer>
      </div>
    </div>
  );
}
