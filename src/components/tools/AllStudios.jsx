import React, { useEffect, useMemo, useState } from "react";
import { useProject } from "@/lib/projectStore";
import { PARAM_KNOWLEDGE } from "@/lib/marlinKnowledge";
import { agentApi } from "@/lib/localAgent";
import { findWritableParam, writableConfigFiles } from "@/lib/configFileModel";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, Code2, Cpu, Gauge, GitCompare,
  HardDrive, Info, Layers, Lightbulb, Monitor, Power, RefreshCw, RotateCcw, Save,
  Search, Scale, Send, Settings2, ShieldCheck, SlidersHorizontal, Target, Terminal,
  Thermometer, Undo2, Wifi, Wind, Zap
} from "lucide-react";

const DEFINITIONS = {
  "printer-name": { title: "Printer Name Studio", icon: Monitor, desc: "Identité complète de la machine et informations exposées par M115.", fields: [["CUSTOM_MACHINE_NAME", "Nom imprimante", "text", "Marlin"], ["STRING_CONFIG_H_AUTHOR", "Auteur configuration", "text", "Marlin Flow Studio"], ["MACHINE_UUID", "UUID machine", "text", ""]] },
  "board-pins": { title: "Board / Pins Studio", icon: Cpu, desc: "Sélection de la carte et paramètres de communication associés.", fields: [["MOTHERBOARD", "Carte mère", "choice", ""], ["SERIAL_PORT", "Port série", "choice", "-1"], ["SERIAL_PORT_2", "Port série 2", "choice", "-1"], ["BAUDRATE", "Baudrate", "choice", "250000"]] },
  "motion": { title: "Motion Studio", icon: Gauge, desc: "Cinématique, steps/mm, vitesses, accélérations et limites de déplacement.", fields: [["DEFAULT_AXIS_STEPS_PER_UNIT", "Steps/mm X Y Z E", "array", "80 80 400 93"], ["DEFAULT_MAX_FEEDRATE", "Feedrate max X Y Z E", "array", "300 300 5 25"], ["DEFAULT_MAX_ACCELERATION", "Acceleration max X Y Z E", "array", "3000 3000 100 10000"], ["DEFAULT_ACCELERATION", "Acceleration par défaut", "number", "1000"], ["DEFAULT_TRAVEL_ACCELERATION", "Acceleration travel", "number", "1000"], ["DEFAULT_RETRACT_ACCELERATION", "Acceleration rétraction", "number", "1000"], ["JUNCTION_DEVIATION_MM", "Junction deviation", "number", "0.013"]] },
  "motor-direction": { title: "Motor Direction Studio", icon: RotateCcw, desc: "Inversement contrôlé du sens des moteurs et préparation des tests.", fields: [["INVERT_X_DIR", "Inverser X", "bool", "false"], ["INVERT_Y_DIR", "Inverser Y", "bool", "false"], ["INVERT_Z_DIR", "Inverser Z", "bool", "false"], ["INVERT_E0_DIR", "Inverser E0", "bool", "false"], ["INVERT_E1_DIR", "Inverser E1", "bool", "false"], ["INVERT_E2_DIR", "Inverser E2", "bool", "false"], ["INVERT_E3_DIR", "Inverser E3", "bool", "false"]] },
  "acceleration": { title: "Acceleration Studio", icon: Gauge, desc: "Réglage séparé des accélérations, jerk et comportement dynamique.", fields: [["DEFAULT_ACCELERATION", "Print acceleration", "number", "1000"], ["DEFAULT_TRAVEL_ACCELERATION", "Travel acceleration", "number", "1000"], ["DEFAULT_RETRACT_ACCELERATION", "Retract acceleration", "number", "1000"], ["DEFAULT_XJERK", "X jerk", "number", "10"], ["DEFAULT_YJERK", "Y jerk", "number", "10"], ["DEFAULT_ZJERK", "Z jerk", "number", "0.4"], ["DEFAULT_EJERK", "E jerk", "number", "5"]] },
  "belt-pulley": { title: "Belt & Pulley Studio", icon: Scale, desc: "Calcul des steps/mm à partir du moteur, microsteps, poulie et pas de courroie.", calc: true },
  "temperature": { title: "Temperature Studio", icon: Thermometer, desc: "Capteurs, limites de température et surveillance thermique.", fields: [["TEMP_SENSOR_0", "Capteur Hotend 0", "choice", "1"], ["TEMP_SENSOR_BED", "Capteur Bed", "choice", "1"], ["TEMP_SENSOR_CHAMBER", "Capteur chambre", "choice", "0"], ["HEATER_0_MAXTEMP", "Hotend MAXTEMP", "number", "275"], ["BED_MAXTEMP", "Bed MAXTEMP", "number", "125"], ["WATCH_TEMP_PERIOD", "Watch period", "number", "20"], ["WATCH_TEMP_INCREASE", "Watch increase", "number", "2"]] },
  "fan": { title: "Fan Studio", icon: Wind, desc: "PWM, ventilateurs automatiques, vitesses et refroidissement.", fields: [["FAN_MIN_PWM", "PWM minimum", "number", "0"], ["FAN_MAX_PWM", "PWM maximum", "number", "255"], ["EXTRUDER_AUTO_FAN_TEMPERATURE", "Température auto-fan", "number", "50"], ["EXTRUDER_AUTO_FAN_SPEED", "Vitesse auto-fan", "number", "255"]] },
  "power-psu": { title: "Power / PSU Studio", icon: Power, desc: "Gestion de l'alimentation, état au démarrage et temporisation.", fields: [["PSU_ACTIVE_STATE", "État PSU actif", "bool", "true"], ["PSU_DEFAULT_OFF", "PSU OFF au démarrage", "bool", "false"], ["PS_OFF_CONFIRMATION", "Confirmation extinction", "bool", "true"], ["POWER_TIMEOUT", "Power timeout", "number", "0"]] },
  "bed-leveling": { title: "Bed Leveling Studio", icon: Target, desc: "Grille et paramètres de probing associés au système de nivellement détecté.", fields: [["GRID_MAX_POINTS_X", "Points X", "number", "5"], ["GRID_MAX_POINTS_Y", "Points Y", "number", "5"], ["PROBING_MARGIN", "Marge probing", "number", "10"], ["Z_CLEARANCE_DEPLOY_PROBE", "Clearance déploiement", "number", "5"], ["Z_CLEARANCE_BETWEEN_PROBES", "Clearance entre points", "number", "5"]] },
  "z-offset": { title: "Z Offset Studio", icon: Target, desc: "Offset géométrique de la sonde et contrôle des limites d'offset.", fields: [["NOZZLE_TO_PROBE_OFFSET", "Offset X Y Z", "array", "0 0 0"], ["Z_PROBE_OFFSET_RANGE_MIN", "Offset Z minimum", "number", "-20"], ["Z_PROBE_OFFSET_RANGE_MAX", "Offset Z maximum", "number", "20"]], gcode: "M851" },
  "steps-mm": { title: "Steps/mm Studio", icon: SlidersHorizontal, desc: "Calibration par distance commandée et distance réellement mesurée.", calcSteps: true, fields: [["DEFAULT_AXIS_STEPS_PER_UNIT", "Steps/mm X Y Z E", "array", "80 80 400 93"]] },
  "stepper-driver": { title: "Stepper Driver Studio", icon: Zap, desc: "Type de driver par axe et paramètres de courant lorsque le firmware les expose.", fields: [["X_DRIVER_TYPE", "Driver X", "choice", "A4988"], ["Y_DRIVER_TYPE", "Driver Y", "choice", "A4988"], ["Z_DRIVER_TYPE", "Driver Z", "choice", "A4988"], ["E0_DRIVER_TYPE", "Driver E0", "choice", "A4988"], ["X_CURRENT", "Courant X mA", "number", "800"], ["Y_CURRENT", "Courant Y mA", "number", "800"], ["Z_CURRENT", "Courant Z mA", "number", "800"], ["E0_CURRENT", "Courant E0 mA", "number", "800"]] },
  "tmc": { title: "TMC Studio", icon: Zap, desc: "Interpolation, modes de fonctionnement et surveillance des drivers TMC.", fields: [["INTERPOLATE", "Interpolation", "bool", "true"], ["STEALTHCHOP_XY", "StealthChop XY", "bool", "true"], ["STEALTHCHOP_Z", "StealthChop Z", "bool", "true"], ["MONITOR_DRIVER_STATUS", "Monitoring driver", "bool", "true"]] },
  "sensorless": { title: "Sensorless Homing Studio", icon: Target, desc: "Sensibilité StallGuard et options de fiabilité du homing sensorless.", fields: [["X_STALL_SENSITIVITY", "Sensibilité X", "number", "8"], ["Y_STALL_SENSITIVITY", "Sensibilité Y", "number", "8"], ["IMPROVE_HOMING_RELIABILITY", "Fiabilité homing", "bool", "true"]] },
  "linear-advance": { title: "Linear Advance Studio", icon: Activity, desc: "K-factor, paramètres avancés et commandes de calibration.", fields: [["LIN_ADVANCE", "Linear Advance", "bool", "false"], ["LIN_ADVANCE_K", "K factor", "number", "0"], ["EXTRA_LIN_ADVANCE_K", "K factor supplémentaire (Marlin ≤ 2.1.2)", "number", "0"], ["ADVANCE_K_EXTRA", "K factor supplémentaire (Marlin ≥ 2.1.3)", "bool", "false"]], gcode: "M900 K0" },
  "input-shaping": { title: "Input Shaping Studio", icon: Activity, desc: "Paramètres de réduction de résonance présents dans le firmware chargé.", fields: [["SHAPING_FREQ_X", "Fréquence résonante X (Hz)", "number", "40"], ["SHAPING_FREQ_Y", "Fréquence résonante Y (Hz)", "number", "40"], ["SHAPING_ZETA_X", "Amortissement (zeta) X", "number", "0.3"], ["SHAPING_ZETA_Y", "Amortissement (zeta) Y", "number", "0.3"]] },
  "safety": { title: "Safety Studio", icon: ShieldCheck, desc: "Protections thermiques, watchdog et mécanismes de sécurité.", fields: [["THERMAL_PROTECTION_HOTENDS", "Protection thermique hotends", "bool", "true"], ["THERMAL_PROTECTION_BED", "Protection thermique bed", "bool", "true"], ["USE_WATCHDOG", "Watchdog", "bool", "true"], ["ENDSTOP_INTERRUPTS_FEATURE", "Interruptions endstop", "bool", "false"]] },
  "firmware-diagnostic": { title: "Firmware Diagnostic Studio", icon: Search, desc: "Diagnostic structurel des fichiers et paramètres actuellement chargés.", diagnostic: true },
  "configuration-checker": { title: "Configuration Checker", icon: ShieldCheck, desc: "Contrôles de cohérence et détection de paramètres à risque.", diagnostic: true },
  "serial-monitor": { title: "Serial Monitor Studio", icon: Terminal, desc: "Console Marlin avec commandes rapides et historique local.", serial: true },
  "gcode": { title: "G-code Studio", icon: Code2, desc: "Éditeur de commandes G-code avec aperçu et envoi contrôlé.", gcodeEditor: true },
  "configuration-diff": { title: "Configuration Diff Studio", icon: GitCompare, desc: "Liste précise des paramètres modifiés avant écriture.", diff: true },
  "mesh-visualizer": { title: "Mesh Visualizer Studio", icon: Layers, desc: "Lecture et visualisation des valeurs de mesh reçues par la console.", mesh: true },
  "display": { title: "Display Studio", icon: Monitor, desc: "Langue, informations écran et options d'interface présentes dans le firmware.", fields: [["LCD_LANGUAGE", "Langue LCD", "choice", "fr"], ["LCD_INFO_MENU", "Menu information", "bool", "true"], ["STATUS_MESSAGE_SCROLLING", "Défilement statut", "bool", "true"]] },
  "sd-media": { title: "SD / Media Studio", icon: HardDrive, desc: "Support SD, noms longs et rapports média.", fields: [["SDSUPPORT", "Support SD", "bool", "true"], ["LONG_FILENAME_HOST_SUPPORT", "Noms longs", "bool", "true"], ["AUTO_REPORT_SD_STATUS", "Rapport SD", "bool", "false"]] },
  "connectivity": { title: "Connectivity Studio", icon: Wifi, desc: "Ports série et communication USB/serial.", fields: [["SERIAL_PORT", "Port série", "choice", "-1"], ["SERIAL_PORT_2", "Port série 2", "choice", "-1"], ["BAUDRATE", "Baudrate", "choice", "250000"]] },
  "camera": { title: "Camera Studio", icon: Monitor, desc: "Paramètres d'une caméra IP/MJPEG pour le suivi d'impression.", fields: [["CAMERA_URL", "URL caméra", "text", ""], ["CAMERA_SNAPSHOT_URL", "URL snapshot", "text", ""]] },
  "network": { title: "Web / Network Studio", icon: Wifi, desc: "Paramètres Web et réseau exposés par la configuration. Pour le Wi-Fi Marlin, utilise le Wi-Fi Studio dédié.", fields: [["WEBSERVER_PORT", "Port Web", "number", "80"], ["HOSTNAME", "Hostname", "text", "marlin"]] },
  "lighting": { title: "Lighting Studio", icon: Lightbulb, desc: "Luminosité, nombre de pixels et test de démarrage.", fields: [["NEOPIXEL_BRIGHTNESS", "Luminosité", "number", "127"], ["NEOPIXEL_PIXELS", "Nombre de pixels", "number", "1"], ["NEOPIXEL_STARTUP_TEST", "Test au démarrage", "bool", "false"]] },
  "extruder": { title: "Extruder Studio", icon: Gauge, desc: "Extrudeurs, diamètre filament, limites d'extrusion et sécurité à froid.", fields: [["EXTRUDERS", "Nombre d'extrudeurs", "number", "1"], ["DEFAULT_NOMINAL_FILAMENT_DIA", "Diamètre filament", "number", "1.75"], ["EXTRUDE_MAXLENGTH", "Longueur extrusion max", "number", "200"], ["PREVENT_COLD_EXTRUSION", "Protection extrusion froide", "bool", "true"], ["EXTRUDE_MINTEMP", "Température minimale extrusion", "number", "170"]] },
  "calibration": { title: "Calibration Studio", icon: Target, desc: "Parcours de calibration global avec contrôle des prérequis.", wizard: true }
};

const CHOICES = {
  BAUDRATE: [9600, 115200, 250000, 500000, 1000000],
  SERIAL_PORT: [-1, 0, 1, 2, 3], SERIAL_PORT_2: [-1, 0, 1, 2, 3],
  LCD_LANGUAGE: ["fr", "en", "de", "es", "it", "pt", "nl", "pl", "ru", "sv", "tr"],
};

// Marlin temperature sensor IDs, including thermocouple/RTD and specialty
// inputs. The actual list of controls is still limited to macros in the project.
const TEMPERATURE_SENSOR_IDS = [-18, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 20, 21, 22, 23, 30, 51, 52, 55, 60, 61, 66, 67, 68, 70, 71, 75, 99, 100, 110, 147, 201, 202, 331, 332, 501, 502, 503, 504, 505, 512, 666, 998, 999, 1000, 1010, 1022, 1047, 2000];
const TEMPERATURE_SENSOR_OPTIONS = TEMPERATURE_SENSOR_IDS.map((value) => ({
  value,
  label: value === 0 ? "0 — aucun capteur"
    : value === 998 || value === 999 ? `${value} — sonde de test, aucune lecture réelle`
      : `${value} — ID capteur Marlin`,
}));
const DRIVER_TYPES = [
  "A4988", "A5984", "DRV8825", "LV8729", "TB6560", "TB6600", "TMC2100",
  "TMC2130", "TMC2130_STANDALONE", "TMC2160", "TMC2160_STANDALONE",
  "TMC2208", "TMC2208_STANDALONE", "TMC2209", "TMC2209_STANDALONE",
  "TMC2240", "TMC2660", "TMC2660_STANDALONE", "TMC5130", "TMC5130_STANDALONE",
  "TMC5160", "TMC5160_STANDALONE",
];

function find(project, name) { return findWritableParam(project, name); }
function valueOf(project, name, fallback) { return find(project, name)?.value ?? fallback; }
function optionsFor(name) {
  const meta = PARAM_KNOWLEDGE?.[name];
  const options = /^TEMP_SENSOR_(?:[0-7]|BED|CHAMBER|COOLER|BOARD|SOC|PROBE|REDUNDANT)$/.test(name) ? TEMPERATURE_SENSOR_OPTIONS
    : /_DRIVER_TYPE$/.test(name) ? DRIVER_TYPES
      : meta?.options?.length ? meta.options : CHOICES[name];
  return (options || []).map(x => typeof x === "object" ? x : { value: x, label: String(x) });
}
function parseValue(v, type) {
  if (type === "number") return Number(v);
  if (type === "bool") return v === true || v === "true";
  if (type === "array") return String(v).trim().split(/[ ,;]+/).filter(Boolean).map(Number);
  return v;
}
function normalizeArray(v) { return Array.isArray(v) ? v.join(" ") : String(v ?? ""); }
function riskFor(name) { return PARAM_KNOWLEDGE?.[name]?.risk || "Standard"; }
function metaFor(name) { return PARAM_KNOWLEDGE?.[name] || {}; }

function detectedFamilyFields(project, id, guidedFields) {
  const names = {
    temperature: /^(?:TEMP_SENSOR_(?:[0-7]|BED|CHAMBER|COOLER|BOARD|SOC|PROBE|REDUNDANT)|TEMP_SENSOR_REDUNDANT_|HEATER_[0-7]_|(?:BED|CHAMBER)_(?:MIN|MAX)TEMP$|(?:WATCH|THERMAL_PROTECTION|PREHEAT|COOLER|CHAMBER)_)/,
    fan: /(?:^FAN_|_FAN_|AUTO_FAN|COOLER_FAN)/,
    "motor-direction": /^INVERT_.*_DIR$/,
    "stepper-driver": /(?:_DRIVER_TYPE|_CURRENT|_MICROSTEPS|_STALL_SENSITIVITY|_HYBRID_THRESHOLD|_HOLD_MULTIPLIER|_CHAIN_POS|_RSENSE|_RMS_CURRENT)$/,
  }[id];
  if (!names) return [];
  const known = new Set(guidedFields.map(([name]) => name));
  const writable = new Set(writableConfigFiles(project));
  return (project?.allParameters || [])
    .filter((param) => {
      if (!writable.has(param.file) || !names.test(param.name) || known.has(param.name) || param.directive === "undef") return false;
      known.add(param.name);
      return true;
    })
    .map((param) => {
      const choice = /_DRIVER_TYPE$/.test(param.name) || /^TEMP_SENSOR_(?:[0-7]|BED|CHAMBER|COOLER|BOARD|SOC|PROBE|REDUNDANT)$/.test(param.name);
      const type = choice ? "choice"
        : param.type === "flag" || param.type === "bool" ? "bool"
        : param.type === "number" || param.type === "float" ? "number"
          : param.type === "array" ? "array"
            : "text";
      return [param.name, param.name.replaceAll("_", " "), type, param.value];
    });
}

function validationFor(name, v) {
  const n = Number(v);
  if (/^TEMP_SENSOR_/.test(name) && [998, 999].includes(n)) return "ID de sonde simulée : ne mesure aucune température réelle et ne convient pas au chauffage.";
  if (/^TEMP_SENSOR_/.test(name) && n === 0) return "Aucun capteur sélectionné : vérifie qu'aucun chauffage ne dépend de cette entrée.";
  if (["HEATER_0_MAXTEMP", "BED_MAXTEMP"].includes(name) && (!Number.isFinite(n) || n < 100 || n > 400)) return "Limite thermique inhabituelle : vérifie la thermistance et le hotend/bed réel.";
  if (/CURRENT$/.test(name) && (!Number.isFinite(n) || n < 100 || n > 3000)) return "Courant moteur hors plage courante. Vérifie le driver avant compilation.";
  if (/SENSITIVITY$/.test(name) && (!Number.isFinite(n) || n < 0 || n > 255)) return "Sensibilité hors plage 0–255.";
  if (name.includes("BRIGHTNESS") && (!Number.isFinite(n) || n < 0 || n > 255)) return "Luminosité attendue entre 0 et 255.";
  if (["GRID_MAX_POINTS_X", "GRID_MAX_POINTS_Y"].includes(name) && (!Number.isInteger(n) || n < 2 || n > 15)) return "Nombre de points inhabituel : vérifie la surface et la durée de probing.";
  if (name === "Z_PROBE_OFFSET_RANGE_MIN" && n >= Number(valueOf(null, "", 0))) return "Vérifie que la limite minimale est bien négative.";
  return "";
}

export default function AllStudio({ id }) {
  const def = DEFINITIONS[id] || { title: "Studio", icon: Settings2, desc: "Assistant Marlin", fields: [] };
  const Icon = def.icon;
  const { currentProject, updateValue, toggleParam, updateProject, exportFile } = useProject();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [boards, setBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [calc, setCalc] = useState({ steps: 80, micro: 16, teeth: 20, pitch: 2, commanded: 100, measured: 100 });
  const [serial, setSerial] = useState("");
  const [out, setOut] = useState("");
  const [draftGcode, setDraftGcode] = useState("; Marlin Flow Studio\nM115\nM503\n");

  useEffect(() => {
    if (id !== "board-pins") return;
    let alive = true;
    setLoadingBoards(true);
    agentApi.configurationOptions().then(r => {
      const raw = r?.MOTHERBOARD || r?.motherboard || r?.boards || [];
      const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([value, label]) => ({ value, label }));
      if (alive) setBoards(list.map(x => typeof x === "string" ? { value: x, label: x } : { value: x.value ?? x.id ?? x.name, label: x.label ?? x.name ?? x.value }).filter(x => x.value));
    }).catch(() => {}).finally(() => alive && setLoadingBoards(false));
    return () => { alive = false; };
  }, [id]);

  const fields = useMemo(() => [...(def.fields || []), ...detectedFamilyFields(currentProject, id, def.fields || [])], [currentProject, id, def.fields]);
  const modified = useMemo(() => (currentProject?.allParameters || []).filter(p => p.modified), [currentProject]);
  const studioModified = useMemo(() => modified.filter(p => fields.some(f => f[0] === p.name)), [modified, fields]);
  const warnings = useMemo(() => studioModified.map(p => validationFor(p.name, p.value)).filter(Boolean), [studioModified]);

  const flashMessage = (text, isError = false) => {
    if (isError) setError(text); else setMsg(text);
    window.setTimeout(() => isError ? setError("") : setMsg(""), 3500);
  };

  const change = (name, raw, type) => {
    const p = find(currentProject, name);
    if (!p) { flashMessage(`${name} n'est pas présent dans le firmware chargé.`, true); return; }
    const parsed = parseValue(raw, type === "choice" ? (typeof p.value === "number" ? "number" : typeof p.value === "boolean" ? "bool" : "text") : type);
    if (type === "array" && parsed.some(n => !Number.isFinite(n))) { flashMessage(`${name} : tous les axes doivent être numériques.`, true); return; }
    // Marlin feature switches are normally value-less #define flags. Changing
    // their JS value does not comment/uncomment the line, so serializeMarlinFile
    // would previously write the exact same directive. Toggle the directive itself.
    if (type === "bool" && p.type === "flag") {
      const wanted = Boolean(parsed);
      if (Boolean(p.enabled) !== wanted) toggleParam(currentProject.id, p.file, p);
    } else {
      updateValue(currentProject.id, p.file, p, parsed);
    }
    const warning = validationFor(name, parsed);
    flashMessage(warning || `${name} modifié`);
  };

  const saveStudio = async () => {
    setBusy(true); setError("");
    try {
      if (!currentProject.localProjectPath) throw new Error("Aucun projet local sélectionné. Ouvre un projet depuis le disque avant d'écrire le firmware.");
      const writable = new Set(writableConfigFiles(currentProject));
      const touched = [...new Set(studioModified.filter(p => writable.has(p.file)).map(p => p.file))];
      if (!touched.length) { flashMessage("Aucune modification de ce Studio à enregistrer."); return; }
      const files = Object.fromEntries(touched.map(file => [file, exportFile(currentProject.id, file)]));
      const hashes = Object.fromEntries(touched.filter(f => currentProject.localHashes?.[f]).map(f => [f, currentProject.localHashes[f]]));
      await agentApi.selectProject(currentProject.localProjectPath);
      const result = await agentApi.applyConfiguration(files, hashes);
      const nextHashes = { ...(currentProject.localHashes || {}) };
      for (const item of result.written || []) nextHashes[item.filename] = item.sha256;
      updateProject({ ...currentProject, localHashes: nextHashes, updatedDate: new Date().toISOString() });
      flashMessage(`✓ ${touched.join(", ")} enregistré(s) avec sauvegarde .bak`);
    } catch (e) { flashMessage(e.message || String(e), true); }
    finally { setBusy(false); }
  };

  const resetStudio = () => {
    for (const p of studioModified) updateValue(currentProject.id, p.file, p, p.originalValue ?? p.defaultValue ?? p.value);
    flashMessage(studioModified.length ? `${studioModified.length} modification(s) réinitialisée(s) dans le Studio.` : "Aucune modification à réinitialiser.");
  };

  const send = async cmd => {
    if (!String(cmd).trim()) return;
    try {
      const r = await agentApi.serialSend(String(cmd).trim());
      setOut(x => `${x}\n> ${cmd}\n${r?.output || r?.response || JSON.stringify(r)}`.trim());
    } catch (e) { setOut(x => `${x}\n> ${cmd}\nERREUR: ${e.message || e}`); }
  };

  const beltCalc = calc.teeth > 0 && calc.pitch > 0 ? calc.steps * calc.micro / (calc.teeth * calc.pitch) : 0;
  const stepsCalc = calc.measured > 0 ? calc.commanded * calc.steps / calc.measured : 0;

  if (!currentProject) return <div className="p-8 text-muted-foreground">Ouvre d'abord un projet Marlin.</div>;

  const renderField = ([name, label, type, fallback]) => {
    const p = find(currentProject, name);
    const rawV = valueOf(currentProject, name, fallback);
    const v = type === "bool" && p?.type === "flag" ? Boolean(p.enabled) : rawV;
    const meta = metaFor(name);
    const options = name === "MOTHERBOARD" ? boards : optionsFor(name);
    const absent = !p || p.directive === "undef";
    return <div key={name} className={`rounded-xl border bg-card p-3 ${absent ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-medium">{label}</div><div className="text-[10px] font-mono text-muted-foreground">{name}</div></div><div className="flex items-center gap-1.5">{p?.commented && p.directive !== "undef" && <button type="button" onClick={() => toggleParam(currentProject.id, p.file, p)} className="rounded border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-700 hover:bg-amber-500/5">Activer</button>}<span className={`text-[10px] rounded-full border px-2 py-0.5 ${riskFor(name) === "Critique" ? "border-red-500/30 text-red-600" : "border-border text-muted-foreground"}`}>{riskFor(name)}</span></div></div>
      <div className="mt-2">
        {type === "bool" ? <button type="button" disabled={absent} onClick={() => change(name, !Boolean(v), type)} className={`w-full px-3 py-2 rounded border text-left ${Boolean(v) ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>{Boolean(v) ? "✓ Activé" : "○ Désactivé"}</button>
        : (type === "choice" || options.length > 0) ? <select disabled={absent || (name === "MOTHERBOARD" && loadingBoards)} value={String(v ?? "")} onChange={e => change(name, e.target.value, "choice")} className="w-full px-3 py-2 rounded border bg-background font-mono text-sm"><option value="">Sélectionner…</option>{options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label ?? String(o.value)}</option>)}{v != null && v !== "" && !options.some(o => String(o.value) === String(v)) && <option value={String(v)}>Valeur actuelle — {String(v)}</option>}</select>
        : <input disabled={absent} type={type === "number" ? "number" : type === "password" ? "password" : "text"} step={type === "number" ? "any" : undefined} value={type === "array" ? normalizeArray(v) : String(v ?? "")} onChange={e => change(name, e.target.value, type)} className="w-full px-3 py-2 rounded border bg-background font-mono text-sm" />}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{p?.directive === "undef" ? `Macro #undef dans ${p.file} : édition guidée indisponible.` : p ? `Détecté dans ${p.file}${p.modified ? " · modifié" : ""}` : "Paramètre absent du firmware chargé : aucune écriture ne sera inventée."}</div>
      {meta.description && <div className="mt-2 text-xs text-muted-foreground flex gap-1"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{meta.description}</div>}
      {validationFor(name, v) && <div className="mt-2 text-xs text-amber-600 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{validationFor(name, v)}</div>}
    </div>;
  };

  return <div className="h-full overflow-auto p-5"><div className="max-w-7xl mx-auto space-y-5">
    <header className="flex items-start justify-between gap-4"><div><h1 className="text-xl font-semibold flex items-center gap-2"><Icon className="w-5 h-5 text-primary" />{def.title}</h1><p className="text-sm text-muted-foreground mt-1">{def.desc}</p></div><div className="flex flex-wrap justify-end gap-2 text-xs"><span className="rounded-full border px-3 py-1.5">{fields.length} paramètres guidés</span><span className="rounded-full border px-3 py-1.5">{studioModified.length} modification(s)</span></div></header>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
    {msg && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm flex gap-2"><CheckCircle2 className="w-4 h-4" />{msg}</div>}
    {warnings.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><div className="font-semibold flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Points à vérifier avant compilation</div><ul className="mt-2 list-disc pl-5 space-y-1">{warnings.slice(0, 8).map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}</ul></div>}

    {fields.length > 0 && <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{fields.map(renderField)}</section>}

    {def.calc && <section className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-semibold">Calculateur courroie / poulie</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["steps","Steps moteur"],["micro","Microsteps"],["teeth","Dents poulie"],["pitch","Pas courroie (mm)"]].map(([k,l]) => <label key={k} className="text-xs">{l}<input type="number" value={calc[k]} onChange={e => setCalc({ ...calc, [k]: Number(e.target.value) })} className="w-full mt-1 px-2 py-2 rounded border bg-background" /></label>)}</div><div className="rounded-lg bg-muted/40 p-3 font-mono text-sm">Steps/mm calculés : <b>{beltCalc.toFixed(4)}</b></div><button onClick={() => { const p=find(currentProject,"DEFAULT_AXIS_STEPS_PER_UNIT"); if(p) change("DEFAULT_AXIS_STEPS_PER_UNIT", `${beltCalc} ${beltCalc} ${Array.isArray(p.value)?p.value[2]:400} ${Array.isArray(p.value)?p.value[3]:93}`, "array"); }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground">Appliquer à X/Y</button></section>}

    {def.calcSteps && <section className="rounded-xl border bg-card p-4 space-y-4"><h2 className="font-semibold">Calibration par mesure réelle</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[["steps","Steps actuels"],["commanded","Distance commandée"],["measured","Distance réelle"]].map(([k,l]) => <label key={k} className="text-xs">{l}<input type="number" value={calc[k]} onChange={e => setCalc({ ...calc, [k]: Number(e.target.value) })} className="w-full mt-1 px-2 py-2 rounded border bg-background" /></label>)}</div><div className="rounded-lg bg-muted/40 p-3 font-mono">Nouvelle valeur : <b>{stepsCalc.toFixed(5)}</b></div><button onClick={() => { const p=find(currentProject,"DEFAULT_AXIS_STEPS_PER_UNIT"); if(p) { const arr=Array.isArray(p.value)?[...p.value]:String(p.value||"80 80 400 93").split(/\s+/).map(Number); arr[3]=stepsCalc; change("DEFAULT_AXIS_STEPS_PER_UNIT", arr, "array"); } }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground">Appliquer au E</button></section>}

    {def.serial && <section className="rounded-xl border bg-card p-4 space-y-3"><div className="flex flex-wrap gap-2">{["M105","M114","M115","M119","M503","M500"].map(c => <button key={c} onClick={() => send(c)} className="px-3 py-2 rounded border font-mono text-xs">{c}</button>)}</div><div className="flex gap-2"><input value={serial} onChange={e => setSerial(e.target.value)} onKeyDown={e => e.key === "Enter" && send(serial)} placeholder="Commande G-code…" className="flex-1 px-3 py-2 rounded border bg-background font-mono"/><button onClick={() => send(serial)} className="px-4 rounded bg-primary text-primary-foreground"><Send className="w-4 h-4" /></button></div><pre className="min-h-40 max-h-80 overflow-auto bg-black/90 text-green-300 p-3 rounded text-xs whitespace-pre-wrap">{out || "Console prête."}</pre></section>}

    {def.gcodeEditor && <section className="rounded-xl border bg-card p-4 space-y-3"><textarea value={draftGcode} onChange={e => setDraftGcode(e.target.value)} className="w-full h-72 bg-black/90 text-green-300 rounded p-3 font-mono text-sm"/><div className="flex flex-wrap gap-2"><button onClick={() => navigator.clipboard?.writeText(draftGcode)} className="px-3 py-2 rounded border">Copier</button><button onClick={() => draftGcode.split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith(";")).forEach(send)} className="px-3 py-2 rounded bg-primary text-primary-foreground">Envoyer les lignes</button></div></section>}

    {def.diagnostic && <section className="rounded-xl border bg-card p-4 space-y-3"><button onClick={() => { const files=Object.keys(currentProject.parsedFiles||{}); const params=currentProject.allParameters||[]; const inactive=params.filter(p=>!p.active).length; setOut([`Diagnostic Marlin Flow Studio`, `✓ Fichiers chargés : ${files.join(", ") || "aucun"}`, `✓ Paramètres analysés : ${params.length}`, `ℹ Paramètres dans un bloc conditionnel inactif : ${inactive}`, `✓ Modifications en attente : ${modified.length}`, warnings.length ? `⚠ Avertissements Studio : ${warnings.length}` : "✓ Aucun avertissement Studio détecté"].join("\n")); }} className="px-4 py-2 rounded bg-primary text-primary-foreground">Lancer le diagnostic</button><pre className="whitespace-pre-wrap font-mono text-xs rounded bg-muted/40 p-3">{out || "Aucune analyse exécutée."}</pre></section>}

    {def.diff && <section className="rounded-xl border bg-card p-4"><div className="space-y-2">{modified.length ? modified.map(p => <div key={p.id} className="rounded-lg border p-3 font-mono text-xs"><span className="text-amber-600">~</span> {p.name}: <span className="text-muted-foreground">{String(p.originalValue ?? "?")}</span> → <b>{String(p.value)}</b><div className="mt-1 text-[10px] text-muted-foreground">{p.file}:{(p.line ?? 0)+1}</div></div>) : <div className="text-sm text-muted-foreground">Aucune modification en attente.</div>}</div></section>}

    {def.mesh && <section className="rounded-xl border bg-card p-4 space-y-3"><div className="flex flex-wrap gap-2"><button onClick={() => send("M420 V")} className="px-3 py-2 rounded border font-mono">M420 V</button><button onClick={() => send("G29 W")} className="px-3 py-2 rounded border font-mono">G29 W</button></div><pre className="min-h-32 bg-black/90 text-green-300 p-3 rounded text-xs whitespace-pre-wrap">{out || "Demande M420 V ou G29 W pour récupérer les valeurs dans la console."}</pre></section>}

    {def.wizard && <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">{["Machine","Motion","Moteurs","Endstops / Probe","PID","Extrudeur","Leveling","Safety"].map((x,i) => <div key={x} className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Étape {i+1}</div><div className="font-medium mt-1">{x}</div><div className="text-xs text-muted-foreground mt-2">Vérifier, tester puis sauvegarder avant de passer à l'étape suivante.</div></div>)}</section>}

    {def.gcode && <section className="rounded-xl border bg-card p-4 flex items-center gap-3"><code className="flex-1 font-mono text-sm">{def.gcode}</code><button onClick={() => navigator.clipboard?.writeText(def.gcode)} className="px-3 py-2 rounded border">Copier</button></section>}

    <section className="sticky bottom-3 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-lg flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground flex items-center gap-2"><Save className="w-4 h-4" /><span>{studioModified.length ? `${studioModified.length} modification(s) prête(s)` : "Aucune modification locale"} · écriture réelle avec contrôle SHA-256 et .bak</span></div><div className="flex gap-2"><button onClick={() => setShowAdvanced(v => !v)} className="px-3 py-2 rounded border"><ChevronDown className={`w-4 h-4 inline transition-transform ${showAdvanced ? "rotate-180" : ""}`} /> Détails</button><button onClick={resetStudio} disabled={!studioModified.length || busy} className="px-3 py-2 rounded border disabled:opacity-40"><Undo2 className="w-4 h-4 inline mr-1" />Réinitialiser</button><button onClick={saveStudio} disabled={!studioModified.length || busy} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"><Save className="w-4 h-4 inline mr-1" />{busy ? "Enregistrement…" : "Enregistrer sur le PC"}</button></div></section>

    {showAdvanced && <section className="rounded-xl border bg-card p-4 text-xs space-y-2"><div><b>Projet :</b> {currentProject.name}</div><div><b>Fichiers :</b> {Object.keys(currentProject.parsedFiles || {}).join(", ") || "aucun"}</div><div><b>Paramètres modifiés :</b> {modified.length}</div><div><b>Studio :</b> {studioModified.length}</div><div className="text-muted-foreground">Les paramètres absents ne sont jamais créés artificiellement. Les écritures utilisent les fichiers réellement chargés et le hash du dernier état connu.</div></section>}
  </div></div>;
}
