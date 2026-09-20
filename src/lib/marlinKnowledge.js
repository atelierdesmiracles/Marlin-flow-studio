// Knowledge base: categories, known parameters metadata, dependencies, conflicts.
// Tolerant: unknown parameters are still editable as generic macros.

export const CATEGORIES = [
  { id: "general", name: "Général", icon: "Settings" },
  { id: "machine", name: "Machine", icon: "Box" },
  { id: "board", name: "Carte mère", icon: "Cpu" },
  { id: "motion", name: "Motion", icon: "Move" },
  { id: "thermal", name: "Thermique", icon: "Flame" },
  { id: "extruder", name: "Extrudeur", icon: "CircleDot" },
  { id: "bed", name: "Bed", icon: "Square" },
  { id: "probe", name: "Probe", icon: "Crosshair" },
  { id: "leveling", name: "Nivellement", icon: "Layers" },
  { id: "drivers", name: "Drivers", icon: "Zap" },
  { id: "display", name: "Affichage", icon: "Monitor" },
  { id: "eeprom", name: "EEPROM", icon: "Save" },
  { id: "network", name: "Réseau", icon: "Wifi" },
  { id: "safety", name: "Sécurité", icon: "ShieldCheck" },
  { id: "advanced", name: "Avancé", icon: "Wrench" },
];

// Map macro name -> { category, description, doc, type hint, enum options }


// Contextual documentation shown in Configuration for each section.
export const CATEGORY_KNOWLEDGE = {
  general: { purpose: "Identité de la machine et communication série.", when: "À régler sur toute nouvelle configuration.", files: ["Configuration.h"], hardware: "Carte mère + liaison USB/serial.", prerequisites: [], warnings: ["Un BAUDRATE incompatible avec le logiciel hôte peut empêcher la communication."], test: "M115 puis vérifier la réponse et l'identité de la machine.", docs: "https://marlinfw.org/docs/gcode/M115.html" },
  machine: { purpose: "Dimensions, limites et géométrie réelle de l'imprimante.", when: "À régler avant les premiers déplacements et calibrations.", files: ["Configuration.h"], hardware: "Mesurer le volume utile réel.", prerequisites: [], warnings: ["Des dimensions incorrectes peuvent provoquer des déplacements hors zone."], test: "Faire un homing puis vérifier les limites avec des déplacements très lents." },
  board: { purpose: "Carte mère, broches et architecture matérielle.", when: "Premier réglage indispensable du firmware.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Référence exacte de la carte.", prerequisites: [], warnings: ["Ne jamais choisir une carte uniquement parce que son nom semble proche."], test: "Compiler avant tout branchement moteur/chauffage." },
  motion: { purpose: "Cinématique, steps/mm, vitesses et accélérations.", when: "Après identification mécanique de la machine.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Moteurs, vis/courroies et mécanique.", prerequisites: ["Carte mère"], warnings: ["Des accélérations trop élevées peuvent augmenter vibrations et pertes de pas."], test: "Homing puis déplacement par petits incréments." },
  thermal: { purpose: "Capteurs, températures limites et régulation PID.", when: "Avant toute chauffe.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Thermistances/capteurs et chauffes réellement installés.", prerequisites: ["Carte mère"], warnings: ["Les protections thermiques ne doivent pas être désactivées sans raison précise."], test: "M105 puis autotune PID avec M303 lorsque la configuration est sûre.", docs: "https://marlinfw.org/docs/features/temperature.html" },
  extruder: { purpose: "Nombre d'extrudeurs, géométrie et comportement d'extrusion.", when: "Après identification du système d'extrusion.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Extrudeur(s), hotend(s), capteur(s).", prerequisites: ["Thermique"], warnings: ["Tester l'extrusion à froid peut être interdit par EXTRUDE_MINTEMP."], test: "Chauffer à une température adaptée puis extruder une petite quantité." },
  bed: { purpose: "Plateau chauffant, dimensions et paramètres associés.", when: "Pour les machines équipées d'un bed chauffant.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Plateau + capteur de température.", prerequisites: ["Thermique"], warnings: ["Vérifier la puissance et le câblage avant de chauffer."], test: "M105 puis montée progressive en température." },
  probe: { purpose: "Sonde Z, offsets et logique de déclenchement.", when: "Si une sonde de palpage est installée.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "BLTouch, inductive, mécanique ou autre sonde compatible.", prerequisites: ["Carte mère"], warnings: ["L'offset Z doit être mesuré ; ne pas le deviner."], test: "Tester le déclenchement de la sonde avant tout nivellement." },
  leveling: { purpose: "Nivellement du plateau et compensation de la géométrie.", when: "Après calibration mécanique et configuration de la sonde.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Probe pour les modes automatiques ; écran/commandes selon workflow.", prerequisites: ["Probe ou procédure manuelle"], warnings: ["Les modes de nivellement sont généralement exclusifs entre eux."], test: "Homing puis procédure de nivellement adaptée au mode choisi.", docs: "https://marlinfw.org/docs/features/auto_bed_leveling.html" },
  drivers: { purpose: "Drivers moteurs, microsteps, courant et modes de fonctionnement.", when: "Après identification exacte des drivers.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "A4988, TMC, LV8729 ou driver réellement monté.", prerequisites: ["Carte mère"], warnings: ["Un courant moteur incorrect peut provoquer échauffement ou pertes de pas."], test: "Tester chaque axe séparément à faible vitesse." },
  display: { purpose: "LCD/TFT, boutons, tactile, cartes SD et interface utilisateur.", when: "Après identification exacte du contrôleur d'écran.", files: ["Configuration.h", "Configuration_adv.h", "_Bootscreen.h", "_Statusscreen.h"], hardware: "Référence exacte de l'écran et de son contrôleur.", prerequisites: ["Carte mère"], warnings: ["Un profil d'écran proche mais différent peut produire un firmware non fonctionnel."], test: "Compiler puis vérifier l'initialisation de l'écran." },
  eeprom: { purpose: "Persistance des paramètres modifiables après redémarrage.", when: "Lorsque les calibrations doivent être conservées.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "EEPROM/émulation supportée par la carte.", prerequisites: [], warnings: ["Après modification de la structure des paramètres, réinitialiser l'EEPROM si nécessaire."], test: "M500 puis M503 après redémarrage.", docs: "https://marlinfw.org/docs/gcode/M500.html" },
  network: { purpose: "Fonctions réseau disponibles sur les cartes compatibles.", when: "Uniquement si le matériel et le framework les supportent.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Ethernet/Wi-Fi réellement présent.", prerequisites: ["Carte compatible"], warnings: ["Le support dépend fortement de la carte, du HAL et de la version de Marlin."], test: "Compiler puis vérifier l'initialisation réseau." },
  safety: { purpose: "Protections et mécanismes destinés à empêcher les états dangereux.", when: "Toujours examiner cette section avant un premier build.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Capteurs et actionneurs correspondants.", prerequisites: [], warnings: ["Ne pas désactiver une protection uniquement pour contourner une erreur de configuration."], test: "Valider les capteurs et limites avant toute chauffe ou mouvement." },
  advanced: { purpose: "Optimisations, fonctions expérimentales et réglages avancés.", when: "Après validation de la configuration de base.", files: ["Configuration_adv.h", "Config.h", "config.ini"], hardware: "Dépend de chaque fonctionnalité.", prerequisites: ["Configuration de base fonctionnelle"], warnings: ["Certaines options peuvent augmenter RAM/flash ou être limitées à certains HAL."], test: "Compiler et consulter les messages de compilation avant installation." },
};

export function getCategoryMeta(id) { return CATEGORY_KNOWLEDGE[id] || { purpose: "Section de configuration Marlin.", when: "Vérifier les paramètres avant compilation.", files: [], hardware: "Selon la fonctionnalité.", prerequisites: [], warnings: [], test: "Compiler puis valider sur machine." }; }

export const PARAM_KNOWLEDGE = {
  CUSTOM_MACHINE_NAME: { category: "general", description: "Nom personnalisé affiché sur l'écran et dans M115.", type: "string", purpose: "Identifier clairement la machine.", units: "texte", risk: "Faible" },
  MACHINE_UUID: { category: "general", description: "UUID unique de la machine (M115).", type: "string" },
  BAUDRATE: { category: "general", description: "Vitesse de communication série (bps).", type: "number", options: [9600, 115200, 250000, 500000] },
  X_BED_SIZE: { category: "machine", description: "Dimension du lit en X (mm).", type: "number" },
  Y_BED_SIZE: { category: "machine", description: "Dimension du lit en Y (mm).", type: "number" },
  Z_MAX_POS: { category: "machine", description: "Hauteur maximale de l'axe Z (mm).", type: "number" },
  X_MIN_POS: { category: "machine", description: "Position min X (mm).", type: "number" },
  Y_MIN_POS: { category: "machine", description: "Position min Y (mm).", type: "number" },
  X_MAX_POS: { category: "machine", description: "Position max X (mm).", type: "number" },
  Y_MAX_POS: { category: "machine", description: "Position max Y (mm).", type: "number" },
  MOTHERBOARD: { category: "board", description: "Carte mère sélectionnée (BOARD_*).", type: "string", purpose: "Sélectionner l'architecture et le brochage exacts.", risk: "Critique", warning: "Doit correspondre exactement à la carte installée." },
  DEFAULT_AXIS_STEPS_PER_UNIT: { category: "motion", description: "Steps/mm par axe { X, Y, Z, E }.", type: "array" },
  DEFAULT_MAX_FEEDRATE: { category: "motion", description: "Vitesse maximale par axe (mm/s).", type: "array" },
  DEFAULT_MAX_ACCELERATION: { category: "motion", description: "Accélération max par axe (mm/s²).", type: "array" },
  DEFAULT_ACCELERATION: { category: "motion", description: "Accélération par défaut (mm/s²).", type: "number" },
  DEFAULT_TRAVEL_ACCELERATION: { category: "motion", description: "Accélération en déplacement (sans extrusion).", type: "number" },
  JUNCTION_DEVIATION_MM: { category: "motion", description: "Déviation de jonction (mm).", type: "float" },
  DEFAULT_MINIMUMFEEDRATE: { category: "motion", description: "Vitesse minimum (mm/s).", type: "float" },
  HOMING_FEEDRATE_XY: { category: "motion", description: "Vitesse de homing XY (mm/min).", type: "number" },
  HOMING_FEEDRATE_Z: { category: "motion", description: "Vitesse de homing Z (mm/min).", type: "number" },
  EXTRUDE_MINTEMP: { category: "thermal", description: "Température minimum pour extruder (°C).", type: "number" },
  HEATER_0_MAXTEMP: { category: "thermal", description: "Température max hotend 0 (°C).", type: "number" },
  HEATER_BED_MAXTEMP: { category: "thermal", description: "Température max bed (°C).", type: "number" },
  PREHEAT_1_TEMP_HOTEND: { category: "thermal", description: "Temp préchauffage PLA hotend (°C).", type: "number" },
  PREHEAT_1_TEMP_BED: { category: "thermal", description: "Temp préchauffage PLA bed (°C).", type: "number" },
  PIDTEMP: { category: "thermal", description: "Active la régulation PID du hotend.", type: "flag", purpose: "Améliorer la stabilité de température.", test: "M303", risk: "Élevé" },
  PIDTEMPBED: { category: "thermal", description: "Active la régulation PID du bed.", type: "flag" },
  DEFAULT_Kp: { category: "thermal", description: "Gain proportionnel PID hotend.", type: "float" },
  DEFAULT_Ki: { category: "thermal", description: "Gain intégral PID hotend.", type: "float" },
  DEFAULT_Kd: { category: "thermal", description: "Gain dérivé PID hotend.", type: "float" },
  DEFAULT_bedKp: { category: "thermal", description: "Gain proportionnel PID bed.", type: "float" },
  EXTRUDERS: { category: "extruder", description: "Nombre d'extrudeurs.", type: "number" },
  SINGLENOZZLE: { category: "extruder", description: "Mode extrudeur unique partagé.", type: "flag" },
  DEFAULT_DUAL_X_CARRIAGE: { category: "extruder", description: "Mode double chariot X.", type: "flag" },
  TEMP_SENSOR_0: { category: "thermal", description: "Type de thermistance hotend 0.", type: "number", options: [0, 1, 5, 60, 66, 70, 998, 999] },
  TEMP_SENSOR_BED: { category: "thermal", description: "Type de thermistance bed.", type: "number" },
  BLTOUCH: { category: "probe", description: "Active le support BLTouch.", type: "flag", purpose: "Activer la sonde BLTouch pour le palpage Z.", warning: "Le câblage, le mode et les offsets doivent correspondre au montage réel.", risk: "Élevé" },
  BLTOUCH_HS_MODE: { category: "probe", description: "Mode high-speed du BLTouch.", type: "flag" },
  NOZZLE_TO_PROBE_OFFSET: { category: "probe", description: "Offset buse/probe { X, Y, Z }.", type: "array" },
  Z_MIN_PROBE_ENDSTOP_INVERTING: { category: "probe", description: "Inversion endstop probe Z.", type: "flag" },
  AUTO_BED_LEVELING_BILINEAR: { category: "leveling", description: "Nivellement bilinéaire (grille).", type: "flag" },
  AUTO_BED_LEVELING_LINEAR: { category: "leveling", description: "Nivellement linéaire (3 points).", type: "flag" },
  AUTO_BED_LEVELING_3POINT: { category: "leveling", description: "Nivellement 3 points.", type: "flag" },
  MESH_BED_LEVELING: { category: "leveling", description: "Nivellement manuel par maillage.", type: "flag" },
  GRID_MAX_POINTS_X: { category: "leveling", description: "Points de grille en X.", type: "number" },
  GRID_MAX_POINTS_Y: { category: "leveling", description: "Points de grille en Y.", type: "number" },
  Z_SAFE_HOMING: { category: "leveling", description: "Homing sécurisé (évite la probe).", type: "flag" },
  Z_SAFE_HOMING_X_POINT: { category: "leveling", description: "Point X homing sécurisé.", type: "number" },
  Z_SAFE_HOMING_Y_POINT: { category: "leveling", description: "Point Y homing sécurisé.", type: "number" },
  EEPROM_SETTINGS: { category: "eeprom", description: "Active la persistance EEPROM.", type: "flag", purpose: "Conserver les calibrations via M500/M501/M503.", test: "M500 puis M503", risk: "Modéré" },
  EEPROM_AUTO_INIT: { category: "eeprom", description: "Initialise l'EEPROM automatiquement.", type: "flag" },
  SDSUPPORT: { category: "display", description: "Support carte SD.", type: "flag" },
  REPRAP_DISCOUNT_SMART_CONTROLLER: { category: "display", description: "Écran RRD Smart Controller.", type: "flag" },
  CR10_STOCKDISPLAY: { category: "display", description: "Écran Creality CR-10.", type: "flag" },
  HAS_WIRED_NETWORKING: { category: "network", description: "Réseau filaire (Ethernet).", type: "flag" },
  HAS_WIFI: { category: "network", description: "Support Wi-Fi.", type: "flag" },
  POWER_LOSS_RECOVERY: { category: "safety", description: "Récupération après coupure.", type: "flag" },
  THERMAL_PROTECTION_HOTENDS: { category: "safety", description: "Protection thermique hotend.", type: "flag" },
  THERMAL_PROTECTION_BED: { category: "safety", description: "Protection thermique bed.", type: "flag" },
  LIN_ADVANCE: { category: "advanced", description: "Linear Advance (K factor).", type: "flag" },
  ADVANCE_K: { category: "advanced", description: "Facteur K Linear Advance.", type: "float" },
  S_CURVE_ACCELERATION: { category: "advanced", description: "Accélération en S.", type: "flag" },
  X_DRIVER_TYPE: { category: "drivers", description: "Driver axe X.", type: "string", options: ["A4988", "DRV8825", "TMC2208", "TMC2209", "TMC2130", "TMC5160", "LV8729"] },
  Y_DRIVER_TYPE: { category: "drivers", description: "Driver axe Y.", type: "string", options: ["A4988", "DRV8825", "TMC2208", "TMC2209", "TMC2130", "TMC5160", "LV8729"] },
  Z_DRIVER_TYPE: { category: "drivers", description: "Driver axe Z.", type: "string", options: ["A4988", "DRV8825", "TMC2208", "TMC2209", "TMC2130", "TMC5160", "LV8729"] },
  E0_DRIVER_TYPE: { category: "drivers", description: "Driver extrudeur 0.", type: "string", options: ["A4988", "DRV8825", "TMC2208", "TMC2209", "TMC2130", "TMC5160", "LV8729"] },
  X_MICROSTEPS: { category: "drivers", description: "Microsteps axe X.", type: "number", options: [1, 2, 4, 8, 16, 32, 64, 128, 256] },
  X_CURRENT: { category: "drivers", description: "Courant RMS axe X (mA).", type: "number" },
  STEALTHCHOP_XY: { category: "drivers", description: "stealthChop sur axes XY.", type: "flag" },
  STEALTHCHOP_Z: { category: "drivers", description: "stealthChop sur axe Z.", type: "flag" },
  STEALTHCHOP_E: { category: "drivers", description: "stealthChop sur extrudeur.", type: "flag" },
  USE_CONTROLLER_FAN: { category: "board", description: "Ventilateur contrôleur.", type: "flag" },
  USE_WATCHDOG: { category: "safety", description: "Watchdog timer.", type: "flag" },
};

// Dependencies: if a param requires another to be enabled
export const DEPENDENCIES = {
  AUTO_BED_LEVELING_BILINEAR: ["GRID_MAX_POINTS_X", "GRID_MAX_POINTS_Y", "Z_SAFE_HOMING"],
  AUTO_BED_LEVELING_LINEAR: [],
  AUTO_BED_LEVELING_3POINT: ["Z_SAFE_HOMING"],
  GRID_MAX_POINTS_X: ["AUTO_BED_LEVELING_BILINEAR"],
  GRID_MAX_POINTS_Y: ["AUTO_BED_LEVELING_BILINEAR"],
  BLTOUCH: ["Z_MIN_PROBE_ENDSTOP_INVERTING"],
  LIN_ADVANCE: ["ADVANCE_K"],
  PIDTEMP: ["DEFAULT_Kp", "DEFAULT_Ki", "DEFAULT_Kd"],
  PIDTEMPBED: ["DEFAULT_bedKp"],
  POWER_LOSS_RECOVERY: ["EEPROM_SETTINGS"],
  STEALTHCHOP_XY: ["X_DRIVER_TYPE", "Y_DRIVER_TYPE"],
};

// Conflicts: mutually exclusive groups
export const CONFLICTS = [
  { group: ["AUTO_BED_LEVELING_BILINEAR", "AUTO_BED_LEVELING_LINEAR", "AUTO_BED_LEVELING_3POINT", "MESH_BED_LEVELING"], message: "Plusieurs systèmes de nivellement actifs simultanément." },
];

// Fichiers système canoniques du dépôt MarlinFirmware/Marlin (racine config)
export const SYSTEM_FILES = [
  { name: "Config.h", description: "Configuration minimale moderne (Marlin 2.1.3+). Lorsqu'il est présent, Marlin ignore Configuration.h et Configuration_adv.h.", required: false },
  { name: "Configuration.h", description: "Configuration principale du firmware.", required: true },
  { name: "Configuration_adv.h", description: "Configuration avancée et fonctionnalités optionnelles.", required: false },
  { name: "_Bootscreen.h", description: "Écran de démarrage personnalisé (bitmap).", required: false },
  { name: "_Statusscreen.h", description: "Écran de statut personnalisé (bitmap).", required: false },
];

export function getCategoryForParam(name) {
  const k = PARAM_KNOWLEDGE[name];
  if (k) return k.category;
  // Heuristic by prefix
  if (/^X_|^Y_|^Z_/.test(name) && /DRIVER|MICROSTEP|CURRENT|RMS/.test(name)) return "drivers";
  if (/TEMP|HEATER|PID|THERM/.test(name)) return "thermal";
  if (/PROBE|BLTOUCH|Z_MIN/.test(name)) return "probe";
  if (/LEVEL|GRID|MESH|HOMING/.test(name)) return "leveling";
  if (/EEPROM/.test(name)) return "eeprom";
  if (/DISPLAY|LCD|SCREEN|SD/.test(name)) return "display";
  if (/FEEDRATE|ACCEL|STEPS|JUNCTION|HOMING/.test(name)) return "motion";
  if (/EXTRUD|NOZZLE|E0|E1/.test(name)) return "extruder";
  if (/BED|BEDSIZE/.test(name)) return "bed";
  if (/NET|WIFI|ETHERNET|HOST/.test(name)) return "network";
  if (/SAFETY|WATCHDOG|PROTECT/.test(name)) return "safety";
  return "advanced";
}

export function getMeta(name) {
  return PARAM_KNOWLEDGE[name] || { category: getCategoryForParam(name), description: "Paramètre non documenté. Éditable comme macro générique.", type: null };
}