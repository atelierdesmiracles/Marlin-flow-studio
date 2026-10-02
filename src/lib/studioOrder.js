// Ordre logique de configuration d'une imprimante Marlin.
//
// Source unique de vérité pour : StudioHub (grille numérotée), Sidebar (entrées
// Studio triées + numéro), barre d'étape "Étape N/M" (précédent / suivant).
//
// Principe : chaque étape ne dépend que des étapes précédentes.
//   1. La machine et la carte  →  2. Les moteurs et drivers  →  3. Le mouvement
//   →  4. Le thermique  →  5. Endstops, sonde, nivellement  →  6. Calibration
//   fine  →  7. Interface et options  →  8. Sécurité et validation  →  9. Build.
//
// Chaque entrée : [id de vue (Home.jsx), libellé].

export const STUDIO_PHASES = [
  {
    id: "identity", title: "Machine & carte", icon: "Cpu", color: "text-sky-500",
    desc: "Qui est la machine, quelle carte, quels ports : tout le reste en dépend.",
    studios: [
      ["machine", "Machine Studio"],
      ["printer-name", "Printer Name Studio"],
      ["board-pins", "Board / Pins Studio"],
      ["connectivity", "Connectivity Studio"],
    ],
  },
  {
    id: "drivers", title: "Moteurs & drivers", icon: "Zap", color: "text-yellow-500",
    desc: "Drivers, courants, sens de rotation, puis steps/mm : la base mécanique.",
    studios: [
      ["stepper-driver", "Stepper Driver Studio"],
      ["tmc", "TMC Studio"],
      ["motor-direction", "Motor Direction Studio"],
      ["belt-pulley", "Belt & Pulley Studio"],
      ["steps-mm", "Steps/mm Studio"],
    ],
  },
  {
    id: "motion", title: "Mouvement & extrusion", icon: "Gauge", color: "text-violet-500",
    desc: "Vitesses, accélérations et extrudeur, une fois les steps/mm justes.",
    studios: [
      ["motion", "Motion Studio"],
      ["acceleration", "Acceleration Studio"],
      ["extruder", "Extruder Studio"],
    ],
  },
  {
    id: "thermal", title: "Thermique", icon: "Thermometer", color: "text-orange-500",
    desc: "Capteurs d'abord, PID ensuite, puis ventilation et alimentation.",
    studios: [
      ["temperature", "Temperature Studio"],
      ["pid", "PID Studio"],
      ["fan", "Fan Studio"],
      ["power-psu", "Power / PSU Studio"],
    ],
  },
  {
    id: "probe", title: "Endstops, sonde & nivellement", icon: "Crosshair", color: "text-emerald-500",
    desc: "Homing, sonde, offset Z, puis maillage : dans cet ordre.",
    studios: [
      ["probe-endstop", "Probe & Endstop Studio"],
      ["sensorless", "Sensorless Homing Studio"],
      ["z-offset", "Z Offset Studio"],
      ["bed-leveling", "Bed Leveling Studio"],
      ["mesh-visualizer", "Mesh Visualizer Studio"],
    ],
  },
  {
    id: "tuning", title: "Calibration & performance", icon: "BrainCircuit", color: "text-fuchsia-500",
    desc: "Réglages fins, à faire sur une machine déjà fiable.",
    studios: [
      ["calibration", "Calibration Studio"],
      ["linear-advance", "Linear Advance Studio"],
      ["input-shaping", "Input Shaping Studio"],
      ["vibration", "Vibration Studio"],
    ],
  },
  {
    id: "interface", title: "Interface & options", icon: "Monitor", color: "text-cyan-500",
    desc: "Écran, son, lumière, SD, caméra et réseau : le confort d'usage.",
    studios: [
      ["display", "Display Studio"],
      ["bootscreen", "Bootscreen Studio"],
      ["mks-tft", "MKS TFT Studio"],
      ["speaker", "Speaker Studio"],
      ["lighting", "Lighting Studio"],
      ["sd-media", "SD / Media Studio"],
      ["camera", "Camera Studio"],
      ["network", "Web / Network Studio"],
      ["wifi", "Wi-Fi Studio"],
    ],
  },
  {
    id: "safety", title: "Sécurité & validation", icon: "ShieldCheck", color: "text-red-500",
    desc: "Protections, puis contrôles de cohérence avant de compiler.",
    studios: [
      ["safety", "Safety Studio"],
      ["configuration-checker", "Configuration Checker"],
      ["firmware-diagnostic", "Firmware Diagnostic Studio"],
      ["configuration-diff", "Configuration Diff Studio"],
    ],
  },
  {
    id: "build", title: "Build & outils", icon: "Wrench", color: "text-slate-500",
    desc: "Compilation, console série et G-code, pour tester le résultat.",
    studios: [
      ["platformio", "PlatformIO Studio"],
      ["serial-monitor", "Serial Monitor Studio"],
      ["gcode", "G-code Studio"],
    ],
  },
];

// Liste plate numérotée à partir de 1.
export const STUDIO_LIST = STUDIO_PHASES.flatMap((phase, pi) =>
  phase.studios.map(([id, label]) => ({ id, label, phase: phase.id, phaseIndex: pi, phaseTitle: phase.title }))
).map((s, i) => ({ ...s, number: i + 1 }));

export const STUDIO_COUNT = STUDIO_LIST.length;

const BY_ID = Object.fromEntries(STUDIO_LIST.map((s) => [s.id, s]));

export function getStudioStep(id) {
  const s = BY_ID[id];
  if (!s) return null;
  return { ...s, prev: STUDIO_LIST[s.number - 2] || null, next: STUDIO_LIST[s.number] || null };
}

export const pad2 = (n) => String(n).padStart(2, "0");
