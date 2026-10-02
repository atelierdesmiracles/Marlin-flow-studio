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
  { id: "probe", name: "Endstops & Probe", icon: "ToggleLeft" },
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
  probe: { purpose: "Endstops, sonde Z, logique de déclenchement, offsets et homing.", when: "À régler dès que les fins de course et la sonde sont identifiés.", files: ["Configuration.h", "Configuration_adv.h"], hardware: "Microswitches, capteurs, BLTouch, inductive, mécanique ou autre sonde compatible.", prerequisites: ["Carte mère"], warnings: ["La logique HIGH/LOW, les pull-ups/pull-downs et les offsets doivent correspondre au câblage réel.", "Tester chaque endstop et la probe avant tout mouvement automatique ou nivellement."], test: "Utiliser M119 pour vérifier séparément chaque endstop et l'état de la probe, puis tester le homing à faible vitesse." , docs: "https://marlinfw.org/docs/gcode/M119.html" },
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
  TEMP_SENSOR_1: { category: "thermal", description: "Type de thermistance hotend 1.", type: "number" },
  TEMP_SENSOR_2: { category: "thermal", description: "Type de thermistance hotend 2.", type: "number" },
  TEMP_SENSOR_3: { category: "thermal", description: "Type de thermistance hotend 3.", type: "number" },
  TEMP_SENSOR_4: { category: "thermal", description: "Type de thermistance hotend 4.", type: "number" },
  TEMP_SENSOR_5: { category: "thermal", description: "Type de thermistance hotend 5.", type: "number" },
  TEMP_SENSOR_6: { category: "thermal", description: "Type de thermistance hotend 6.", type: "number" },
  TEMP_SENSOR_7: { category: "thermal", description: "Type de thermistance hotend 7.", type: "number" },
  TEMP_SENSOR_BED: { category: "thermal", description: "Type de thermistance bed.", type: "number" },
  TEMP_SENSOR_CHAMBER: { category: "thermal", description: "Type de capteur de température de chambre.", type: "number" },
  TEMP_SENSOR_COOLER: { category: "thermal", description: "Type de capteur de température du refroidisseur.", type: "number" },
  TEMP_SENSOR_BOARD: { category: "thermal", description: "Type de capteur de température de la carte mère.", type: "number" },
  TEMP_SENSOR_SOC: { category: "thermal", description: "Type de capteur de température du processeur (SoC).", type: "number" },
  TEMP_SENSOR_PROBE: { category: "thermal", description: "Type de capteur de température de la sonde.", type: "number" },
  TEMP_SENSOR_REDUNDANT: { category: "thermal", description: "Type de capteur redondant de température.", type: "number" },
  TEMP_SENSOR_REDUNDANT_SOURCE: { category: "thermal", description: "Entrée thermique source comparée par le capteur redondant.", type: "string" },
  TEMP_SENSOR_REDUNDANT_TARGET: { category: "thermal", description: "Entrée thermique cible comparée par le capteur redondant.", type: "string" },
  TEMP_SENSOR_REDUNDANT_MAX_DIFF: { category: "thermal", description: "Écart maximal toléré entre les deux mesures redondantes (°C).", type: "number" },
  BLTOUCH: { category: "probe", description: "Active le support BLTouch.", type: "flag", purpose: "Activer la sonde BLTouch pour le palpage Z.", warning: "Le câblage, le mode et les offsets doivent correspondre au montage réel.", risk: "Élevé" },
  BLTOUCH_HS_MODE: { category: "probe", description: "Mode high-speed du BLTouch.", type: "flag" },
  MAGLEV4: { category: "probe", description: "Probe magnétique MagLev V4.", type: "flag" },
  TOUCH_MI_PROBE: { category: "probe", description: "Probe Touch-MI déployée par déplacement X.", type: "flag" },
  BD_SENSOR: { category: "probe", description: "Capteur de distance au plateau BD Sensor.", type: "flag" },
  BIQU_MICROPROBE_V1: { category: "probe", description: "BIQU MicroProbe V1.", type: "flag" },
  BIQU_MICROPROBE_V2: { category: "probe", description: "BIQU MicroProbe V2.", type: "flag" },
  SOLENOID_PROBE: { category: "probe", description: "Probe déployée par solénoïde.", type: "flag" },
  Z_PROBE_SLED: { category: "probe", description: "Probe montée sur un sled.", type: "flag" },
  RACK_AND_PINION_PROBE: { category: "probe", description: "Probe déployée par crémaillère.", type: "flag" },
  MAG_MOUNTED_PROBE: { category: "probe", description: "Probe à fixation magnétique.", type: "flag" },
  DUET_SMART_EFFECTOR: { category: "probe", description: "Duet Smart Effector.", type: "flag" },
  SENSORLESS_PROBING: { category: "probe", description: "Palpage sensorless via StallGuard.", type: "flag", risk: "Élevé" },

  NOZZLE_TO_PROBE_OFFSET: { category: "probe", description: "Offset buse/probe { X, Y, Z }.", type: "array", purpose: "Définir précisément la position de la probe par rapport à la buse." },
  PROBING_TOOL: { category: "probe", description: "Extrudeur utilisé pour le palpage.", type: "number" },
  PROBING_MARGIN: { category: "probe", description: "Marge minimale de palpage par rapport aux bords du plateau (mm).", type: "number" },
  XY_PROBE_FEEDRATE: { category: "probe", description: "Vitesse XY entre les points de palpage.", type: "expr" },
  Z_PROBE_FEEDRATE_FAST: { category: "probe", description: "Vitesse d'approche rapide du palpage Z.", type: "expr" },
  Z_PROBE_FEEDRATE_SLOW: { category: "probe", description: "Vitesse de palpage Z précis.", type: "expr" },
  // Endstops
  USE_XMIN_PLUG: { category: "probe", description: "Active la prise endstop X minimum.", type: "flag" },
  USE_XMAX_PLUG: { category: "probe", description: "Active la prise endstop X maximum.", type: "flag" },
  USE_YMIN_PLUG: { category: "probe", description: "Active la prise endstop Y minimum.", type: "flag" },
  USE_YMAX_PLUG: { category: "probe", description: "Active la prise endstop Y maximum.", type: "flag" },
  USE_ZMIN_PLUG: { category: "probe", description: "Active la prise endstop Z minimum.", type: "flag" },
  USE_ZMAX_PLUG: { category: "probe", description: "Active la prise endstop Z maximum.", type: "flag" },
  ENDSTOPPULLUPS: { category: "probe", description: "Active les pull-ups pour les fins de course.", type: "flag", risk: "Élevé" },
  ENDSTOPPULLDOWNS: { category: "probe", description: "Active les pull-downs pour les fins de course.", type: "flag", risk: "Élevé" },
  ENDSTOPPULLUP_XMIN: { category: "probe", description: "Pull-up du endstop X minimum.", type: "flag" },
  ENDSTOPPULLUP_XMAX: { category: "probe", description: "Pull-up du endstop X maximum.", type: "flag" },
  ENDSTOPPULLUP_YMIN: { category: "probe", description: "Pull-up du endstop Y minimum.", type: "flag" },
  ENDSTOPPULLUP_YMAX: { category: "probe", description: "Pull-up du endstop Y maximum.", type: "flag" },
  ENDSTOPPULLUP_ZMIN: { category: "probe", description: "Pull-up du endstop Z minimum.", type: "flag" },
  ENDSTOPPULLUP_ZMAX: { category: "probe", description: "Pull-up du endstop Z maximum.", type: "flag" },
  ENDSTOPPULLUP_IMIN: { category: "probe", description: "Pull-up du endstop I minimum.", type: "flag" },
  ENDSTOPPULLUP_IMAX: { category: "probe", description: "Pull-up du endstop I maximum.", type: "flag" },
  ENDSTOPPULLUP_JMIN: { category: "probe", description: "Pull-up du endstop J minimum.", type: "flag" },
  ENDSTOPPULLUP_JMAX: { category: "probe", description: "Pull-up du endstop J maximum.", type: "flag" },
  ENDSTOPPULLUP_KMIN: { category: "probe", description: "Pull-up du endstop K minimum.", type: "flag" },
  ENDSTOPPULLUP_KMAX: { category: "probe", description: "Pull-up du endstop K maximum.", type: "flag" },
  ENDSTOPPULLUP_UMIN: { category: "probe", description: "Pull-up du endstop U minimum.", type: "flag" },
  ENDSTOPPULLUP_UMAX: { category: "probe", description: "Pull-up du endstop U maximum.", type: "flag" },
  ENDSTOPPULLUP_VMIN: { category: "probe", description: "Pull-up du endstop V minimum.", type: "flag" },
  ENDSTOPPULLUP_VMAX: { category: "probe", description: "Pull-up du endstop V maximum.", type: "flag" },
  ENDSTOPPULLUP_WMIN: { category: "probe", description: "Pull-up du endstop W minimum.", type: "flag" },
  ENDSTOPPULLUP_WMAX: { category: "probe", description: "Pull-up du endstop W maximum.", type: "flag" },
  ENDSTOPPULLUP_ZMIN_PROBE: { category: "probe", description: "Pull-up du signal de la probe Z.", type: "flag" },
  ENDSTOPPULLDOWN_XMIN: { category: "probe", description: "Pull-down du endstop X minimum.", type: "flag" },
  ENDSTOPPULLDOWN_XMAX: { category: "probe", description: "Pull-down du endstop X maximum.", type: "flag" },
  ENDSTOPPULLDOWN_YMIN: { category: "probe", description: "Pull-down du endstop Y minimum.", type: "flag" },
  ENDSTOPPULLDOWN_YMAX: { category: "probe", description: "Pull-down du endstop Y maximum.", type: "flag" },
  ENDSTOPPULLDOWN_ZMIN: { category: "probe", description: "Pull-down du endstop Z minimum.", type: "flag" },
  ENDSTOPPULLDOWN_ZMAX: { category: "probe", description: "Pull-down du endstop Z maximum.", type: "flag" },
  ENDSTOPPULLDOWN_IMIN: { category: "probe", description: "Pull-down du endstop I minimum.", type: "flag" },
  ENDSTOPPULLDOWN_IMAX: { category: "probe", description: "Pull-down du endstop I maximum.", type: "flag" },
  ENDSTOPPULLDOWN_JMIN: { category: "probe", description: "Pull-down du endstop J minimum.", type: "flag" },
  ENDSTOPPULLDOWN_JMAX: { category: "probe", description: "Pull-down du endstop J maximum.", type: "flag" },
  ENDSTOPPULLDOWN_KMIN: { category: "probe", description: "Pull-down du endstop K minimum.", type: "flag" },
  ENDSTOPPULLDOWN_KMAX: { category: "probe", description: "Pull-down du endstop K maximum.", type: "flag" },
  ENDSTOPPULLDOWN_UMIN: { category: "probe", description: "Pull-down du endstop U minimum.", type: "flag" },
  ENDSTOPPULLDOWN_UMAX: { category: "probe", description: "Pull-down du endstop U maximum.", type: "flag" },
  ENDSTOPPULLDOWN_VMIN: { category: "probe", description: "Pull-down du endstop V minimum.", type: "flag" },
  ENDSTOPPULLDOWN_VMAX: { category: "probe", description: "Pull-down du endstop V maximum.", type: "flag" },
  ENDSTOPPULLDOWN_WMIN: { category: "probe", description: "Pull-down du endstop W minimum.", type: "flag" },
  ENDSTOPPULLDOWN_WMAX: { category: "probe", description: "Pull-down du endstop W maximum.", type: "flag" },
  ENDSTOPPULLDOWN_ZMIN_PROBE: { category: "probe", description: "Pull-down du signal de la probe Z.", type: "flag" },
  X_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop X minimum.", type: "string", options: ["HIGH", "LOW"] },
  X_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop X maximum.", type: "string", options: ["HIGH", "LOW"] },
  Y_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop Y minimum.", type: "string", options: ["HIGH", "LOW"] },
  Y_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop Y maximum.", type: "string", options: ["HIGH", "LOW"] },
  Z_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop Z minimum.", type: "string", options: ["HIGH", "LOW"] },
  Z_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop Z maximum.", type: "string", options: ["HIGH", "LOW"] },
  I_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop I minimum.", type: "string", options: ["HIGH", "LOW"] },
  I_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop I maximum.", type: "string", options: ["HIGH", "LOW"] },
  J_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop J minimum.", type: "string", options: ["HIGH", "LOW"] },
  J_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop J maximum.", type: "string", options: ["HIGH", "LOW"] },
  K_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop K minimum.", type: "string", options: ["HIGH", "LOW"] },
  K_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop K maximum.", type: "string", options: ["HIGH", "LOW"] },
  U_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop U minimum.", type: "string", options: ["HIGH", "LOW"] },
  U_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop U maximum.", type: "string", options: ["HIGH", "LOW"] },
  V_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop V minimum.", type: "string", options: ["HIGH", "LOW"] },
  V_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop V maximum.", type: "string", options: ["HIGH", "LOW"] },
  W_MIN_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop W minimum.", type: "string", options: ["HIGH", "LOW"] },
  W_MAX_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif du endstop W maximum.", type: "string", options: ["HIGH", "LOW"] },
  Z_MIN_PROBE_ENDSTOP_HIT_STATE: { category: "probe", description: "État logique actif de la probe Z.", type: "string", options: ["HIGH", "LOW"] },
  ENDSTOP_INTERRUPTS_FEATURE: { category: "probe", description: "Utilise les interruptions matérielles pour les endstops.", type: "flag", risk: "Élevé" },
  ENDSTOP_NOISE_THRESHOLD: { category: "probe", description: "Seuil de filtrage du bruit des endstops/probe.", type: "number", options: [2,3,4,5,6,7] },
  DETECT_BROKEN_ENDSTOP: { category: "probe", description: "Détecte les endstops bloqués ou déconnectés pendant le homing.", type: "flag" },

  // Probe
  Z_MIN_PROBE_ENDSTOP_INVERTING: { category: "probe", description: "Inversion endstop probe Z.", type: "flag" },
  Z_MIN_PROBE_USES_Z_MIN_ENDSTOP_PIN: { category: "probe", description: "Utilise la broche Z-MIN pour la sonde.", type: "flag" },
  USE_PROBE_FOR_Z_HOMING: { category: "probe", description: "Force l'utilisation de la probe pour le homing Z.", type: "flag" },
  Z_MIN_PROBE_PIN: { category: "probe", description: "Surcharge de la broche de la probe Z.", type: "number" },
  PROBE_MANUALLY: { category: "probe", description: "Palpage manuel sans sonde électronique.", type: "flag" },
  FIX_MOUNTED_PROBE: { category: "probe", description: "Sonde fixe non déployable.", type: "flag" },
  NOZZLE_AS_PROBE: { category: "probe", description: "Utilise la buse comme sonde.", type: "flag", risk: "Élevé" },
  Z_PROBE_SERVO_NR: { category: "probe", description: "Numéro du servo de sonde Z.", type: "number" },

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

  // --- Contrôleurs d'écran (profils Display Studio) ---
  REPRAP_DISCOUNT_FULL_GRAPHIC_SMART_CONTROLLER: { category: "display", description: "Écran RepRapDiscount Full Graphic 128×64 avec encodeur.", type: "flag" },
  REPRAPWORLD_GRAPHICAL_LCD: { category: "display", description: "Écran RepRapWorld Graphical LCD 128×64.", type: "flag" },
  VIKI2: { category: "display", description: "Écran Panucatt Viki 2, graphique avec encodeur.", type: "flag" },
  miniVIKI: { category: "display", description: "Écran Panucatt miniViki, graphique avec encodeur.", type: "flag" },
  MINIPANEL: { category: "display", description: "Écran MakerLab Mini Panel, graphique + SD.", type: "flag" },
  MAKRPANEL: { category: "display", description: "Écran MaKr3d Makr-Panel, graphique + SD.", type: "flag" },
  ELB_FULL_GRAPHIC_CONTROLLER: { category: "display", description: "Écran Adafruit ST7565 Full Graphic.", type: "flag" },
  BQ_LCD_SMART_CONTROLLER: { category: "display", description: "Écran BQ LCD Smart Controller (Hephestos / Witbox).", type: "flag" },
  CARTESIO_UI: { category: "display", description: "Écran Cartesio UI, clavier ADC.", type: "flag" },
  LCD_FOR_MELZI: { category: "display", description: "Écran LCD pour carte Melzi, 128×64.", type: "flag" },
  ULTI_CONTROLLER: { category: "display", description: "Écran Ulticontroller, SSD1309 / I2C.", type: "flag" },
  MKS_MINI_12864: { category: "display", description: "Écran MKS MINI 12864, 128×64 + SD.", type: "flag" },
  MKS_MINI_12864_V3: { category: "display", description: "Écran MKS MINI 12864 V3, 128×64 + NeoPixel.", type: "flag" },
  MKS_LCD12864A: { category: "display", description: "Écran MKS LCD12864A, 128×64 + SD.", type: "flag" },
  MKS_LCD12864B: { category: "display", description: "Écran MKS LCD12864B, 128×64 + SD.", type: "flag" },
  FYSETC_MINI_12864_X_X: { category: "display", description: "Écran FYSETC MINI 12864 X_X, 128×64 + SD.", type: "flag" },
  FYSETC_MINI_12864_1_2: { category: "display", description: "Écran FYSETC MINI 12864 1.2, 128×64 + RGB.", type: "flag" },
  FYSETC_MINI_12864_2_0: { category: "display", description: "Écran FYSETC MINI 12864 2.0, 128×64 + RGB.", type: "flag" },
  FYSETC_MINI_12864_2_1: { category: "display", description: "Écran FYSETC MINI 12864 2.1, 128×64 + NeoPixel.", type: "flag" },
  FYSETC_GENERIC_12864_1_1: { category: "display", description: "Écran FYSETC Generic 12864, 128×64.", type: "flag" },
  BTT_MINI_12864: { category: "display", description: "Écran BigTreeTech MINI 12864, 128×64 + NeoPixel.", type: "flag" },
  BEEZ_MINI_12864: { category: "display", description: "Écran Beez MINI 12864, 128×64 + NeoPixel.", type: "flag" },
  ENDER2_STOCKDISPLAY: { category: "display", description: "Écran Ender-2 stock, 128×64.", type: "flag" },
  ANET_FULL_GRAPHICS_LCD: { category: "display", description: "Écran Anet Full Graphics LCD, 128×64.", type: "flag" },
  CTC_A10S_A13: { category: "display", description: "Écran CTC A10S / A13, 128×64.", type: "flag" },
  AZSMZ_12864: { category: "display", description: "Écran AZSMZ 12864, 128×64 + SD.", type: "flag" },
  SILVER_GATE_GLCD_CONTROLLER: { category: "display", description: "Écran Silver Gate GLCD.", type: "flag" },
  EMOTION_TECH_LCD: { category: "display", description: "Écran eMotion Tech LCD + SD.", type: "flag" },
  U8GLIB_SSD1306: { category: "display", description: "Écran OLED SSD1306, I²C, graphique.", type: "flag" },
  SAV_3DGLCD: { category: "display", description: "Écran SAV 3DGLCD, SSD1306 / SH1106.", type: "flag" },
  MKS_ROBIN_TFT24: { category: "display", description: "Écran MKS Robin TFT24, 320×240.", type: "flag" },
  MKS_ROBIN_TFT28: { category: "display", description: "Écran MKS Robin TFT28, 320×240.", type: "flag" },
  MKS_ROBIN_TFT32: { category: "display", description: "Écran MKS Robin TFT32, 320×240.", type: "flag" },
  MKS_ROBIN_TFT35: { category: "display", description: "Écran MKS Robin TFT35, 480×320.", type: "flag" },
  MKS_ROBIN_TFT43: { category: "display", description: "Écran MKS Robin TFT43, 480×272.", type: "flag" },
  MKS_ROBIN_TFT_V1_1R: { category: "display", description: "Écran MKS Robin TFT V1.1R, 320×240.", type: "flag" },
  TFT_TRONXY_X5SA: { category: "display", description: "Écran Tronxy X5SA TFT, 480×320.", type: "flag" },
  ANYCUBIC_TFT35: { category: "display", description: "Écran AnyCubic TFT35, 480×320.", type: "flag" },
  LONGER_LK_TFT28: { category: "display", description: "Écran Longer LK TFT28, 320×240.", type: "flag" },
  ANET_ET4_TFT28: { category: "display", description: "Écran Anet ET4 TFT28, 320×240.", type: "flag" },
  ANET_ET5_TFT35: { category: "display", description: "Écran Anet ET5 TFT35, 480×320.", type: "flag" },
  BIQU_BX_TFT70: { category: "display", description: "Écran BIQU BX TFT70, TFT RGB 1024×600.", type: "flag", warning: "Nécessite la résolution TFT_RES_1024x600." },
  BTT_TFT35_SPI_V1_0: { category: "display", description: "Écran BTT TFT35 SPI V1.0, 480×320.", type: "flag" },
  TFT_GENERIC: { category: "display", description: "Écran TFT générique : pilote, interface et résolution choisis séparément.", type: "flag" },

  // --- TFT : pilote, interface, résolution, rotation, UI ---
  TFT_DRIVER: { category: "display", description: "Puce pilote de l'écran TFT (contrôleur graphique).", type: "string", options: ["AUTO", "ST7735", "ST7789", "ST7796", "R61505", "ILI9328", "ILI9341", "ILI9488"] },
  TFT_INTERFACE_FSMC: { category: "display", description: "Interface parallèle FSMC vers l'écran TFT.", type: "flag" },
  TFT_INTERFACE_SPI: { category: "display", description: "Interface SPI vers l'écran TFT.", type: "flag" },
  TFT_RES_320x240: { category: "display", description: "Résolution d'écran TFT 320×240.", type: "flag" },
  TFT_RES_480x272: { category: "display", description: "Résolution d'écran TFT 480×272.", type: "flag" },
  TFT_RES_480x320: { category: "display", description: "Résolution d'écran TFT 480×320.", type: "flag" },
  TFT_RES_800x480: { category: "display", description: "Résolution d'écran TFT 800×480.", type: "flag" },
  TFT_RES_1024x600: { category: "display", description: "Résolution d'écran TFT 1024×600 (ex. BIQU BX TFT70).", type: "flag" },
  TFT_ROTATION: { category: "display", description: "Rotation / mise en miroir de l'affichage TFT.", type: "string", options: ["TFT_NO_ROTATION", "TFT_ROTATE_90", "TFT_ROTATE_90_MIRROR_X", "TFT_ROTATE_90_MIRROR_Y", "TFT_ROTATE_180", "TFT_ROTATE_180_MIRROR_X", "TFT_ROTATE_180_MIRROR_Y", "TFT_ROTATE_270", "TFT_ROTATE_270_MIRROR_X", "TFT_ROTATE_270_MIRROR_Y", "TFT_MIRROR_X", "TFT_MIRROR_Y"] },
  TFT_COLOR_UI: { category: "display", description: "Interface graphique couleur (Color UI) pour écrans TFT.", type: "flag" },
  TFT_CLASSIC_UI: { category: "display", description: "Interface classique façon menu LCD, rendue sur TFT.", type: "flag" },
  TFT_LVGL_UI: { category: "display", description: "Interface graphique avancée basée sur la bibliothèque LVGL.", type: "flag" },
  EXTENSIBLE_UI: { category: "display", description: "Active l'interface extensible (ExtUI) utilisée par certaines UI tierces.", type: "flag" },
  EXTUI_LOCAL_BEEPER: { category: "display", description: "Beeper local piloté par l'ExtUI plutôt que par le buzzer natif.", type: "flag" },

  // --- Interface tactile (Touch UI FTDI EVE) ---
  TOUCH_UI_FTDI_EVE: { category: "display", description: "Active l'interface tactile Touch UI basée sur les puces FTDI EVE (FT800/FT810...).", type: "flag" },
  TOUCH_UI_320x240: { category: "display", description: "Résolution Touch UI 320×240.", type: "flag" },
  TOUCH_UI_480x272: { category: "display", description: "Résolution Touch UI 480×272.", type: "flag" },
  TOUCH_UI_800x480: { category: "display", description: "Résolution Touch UI 800×480.", type: "flag" },
  TOUCH_UI_INVERTED: { category: "display", description: "Inverse les couleurs de l'interface tactile.", type: "flag" },
  TOUCH_UI_PORTRAIT: { category: "display", description: "Affiche l'interface tactile en orientation portrait.", type: "flag" },
  TOUCH_UI_MIRRORED: { category: "display", description: "Affiche l'interface tactile en miroir.", type: "flag" },
  TOUCH_UI_USE_UTF8: { category: "display", description: "Active le rendu UTF-8 dans l'interface tactile.", type: "flag" },
  TOUCH_UI_FIT_TEXT: { category: "display", description: "Adapte automatiquement la taille du texte à l'espace disponible.", type: "flag" },

  // --- Brochage tactile (hérité du fichier pins de la carte) ---
  TOUCH_INT_PIN: { category: "display", description: "Broche d'interruption du contrôleur tactile.", type: "expr", warning: "Définie par le fichier pins de la carte ; ne pas dupliquer dans Configuration.h." },
  TOUCH_CS_PIN: { category: "display", description: "Broche Chip Select (CS) du contrôleur tactile SPI.", type: "expr", warning: "Définie par le fichier pins de la carte." },
  TOUCH_SCK_PIN: { category: "display", description: "Broche horloge SPI (SCK) du contrôleur tactile.", type: "expr", warning: "Définie par le fichier pins de la carte." },
  TOUCH_MISO_PIN: { category: "display", description: "Broche MISO SPI du contrôleur tactile.", type: "expr", warning: "Définie par le fichier pins de la carte." },
  TOUCH_MOSI_PIN: { category: "display", description: "Broche MOSI SPI du contrôleur tactile.", type: "expr", warning: "Définie par le fichier pins de la carte." },
  TOUCH_RESET_PIN: { category: "display", description: "Broche de reset matériel du contrôleur tactile.", type: "expr", warning: "Définie par le fichier pins de la carte." },

  // --- Écran tactile résistif (calibration, TOUCH_SCREEN) ---
  TOUCH_SCREEN: { category: "display", description: "Active la prise en charge d'un écran tactile résistif/capacitif (XPT2046 ou équivalent).", type: "flag", purpose: "Permettre la navigation tactile sur les interfaces TFT.", risk: "Modéré" },
  TOUCH_SCREEN_CALIBRATION: { category: "display", description: "Active l'assistant de calibration tactile (M255) au lieu de valeurs fixes.", type: "flag", purpose: "Calibrer précisément la correspondance entre coordonnées tactiles et pixels écran." },
  TOUCH_CALIBRATION_X: { category: "display", description: "Coefficient de calibration tactile en X (issu de M255 ou de l'assistant).", type: "number", warning: "Ne pas modifier sans recalibrer l'écran réel." },
  TOUCH_CALIBRATION_Y: { category: "display", description: "Coefficient de calibration tactile en Y (issu de M255 ou de l'assistant).", type: "number", warning: "Ne pas modifier sans recalibrer l'écran réel." },
  TOUCH_OFFSET_X: { category: "display", description: "Décalage (offset) tactile en X après application du coefficient de calibration.", type: "number" },
  TOUCH_OFFSET_Y: { category: "display", description: "Décalage (offset) tactile en Y après application du coefficient de calibration.", type: "number" },
  TOUCH_ORIENTATION: { category: "display", description: "Orientation logique de l'écran tactile.", type: "expr", options: ["TOUCH_LANDSCAPE", "TOUCH_PORTRAIT"] },
  TOUCH_CALIBRATION_AUTO_SAVE: { category: "display", description: "Sauvegarde automatiquement en EEPROM une calibration tactile réalisée via M255.", type: "flag" },
  SINGLE_TOUCH_NAVIGATION: { category: "display", description: "Navigation tactile simplifiée à un seul point de contact (TFT_COLOR_UI).", type: "flag" },
  NO_BACK_MENU_ITEM: { category: "display", description: "Retire l'élément de menu \"Retour\" au profit du geste ou du bouton tactile.", type: "flag" },
  BUTTON_DELAY_EDIT: { category: "display", description: "Délai de répétition (ms) des boutons/tactile sur les écrans d'édition de valeurs.", type: "number", units: "ms" },
  BUTTON_DELAY_MENU: { category: "display", description: "Délai de répétition (ms) des boutons/tactile dans les menus.", type: "number", units: "ms" },
  TOUCH_BUTTONS: { category: "display", description: "Active des boutons tactiles résistifs lus par ADC (au lieu d'un contrôleur tactile SPI dédié).", type: "flag" },

  // --- Réglages écran génériques ---
  LCD_LANGUAGE: { category: "display", description: "Langue de l'interface LCD/TFT.", type: "string" },
  DISPLAY_CHARSET_HD44780: { category: "display", description: "Jeu de caractères du contrôleur HD44780 (écrans caractères).", type: "string", options: ["JAPANESE", "WESTERN", "CYRILLIC"] },
  LCD_INFO_SCREEN_STYLE: { category: "display", description: "Style de l'écran d'informations (classique ou façon Prusa).", type: "number", options: [0, 1] },
  LCD_INFO_MENU: { category: "display", description: "Active le menu Information de la machine.", type: "flag" },
  STATUS_MESSAGE_SCROLLING: { category: "display", description: "Fait défiler les messages de statut trop longs pour l'écran.", type: "flag" },
  SHOW_BOOTSCREEN: { category: "display", description: "Affiche l'écran de démarrage Marlin.", type: "flag" },
  SHOW_CUSTOM_BOOTSCREEN: { category: "display", description: "Remplace le bootscreen par une image personnalisée.", type: "flag" },
  CUSTOM_STATUS_SCREEN_IMAGE: { category: "display", description: "Affiche une image personnalisée sur l'écran de statut.", type: "flag" },
  NO_LCD_MENUS: { category: "display", description: "Désactive entièrement les menus LCD (interface minimale).", type: "flag" },
  SLIM_LCD_MENUS: { category: "display", description: "Réduit la taille des menus LCD pour économiser la mémoire.", type: "flag" },
  REVERSE_ENCODER_DIRECTION: { category: "display", description: "Inverse le sens de rotation de l'encodeur.", type: "flag" },
  ENCODER_PULSES_PER_STEP: { category: "display", description: "Nombre d'impulsions de l'encodeur par pas de menu.", type: "number" },
  ENCODER_STEPS_PER_MENU_ITEM: { category: "display", description: "Nombre de pas d'encodeur nécessaires par élément de menu.", type: "number" },
  BEEPER_PIN: { category: "display", description: "Broche du buzzer/beeper de l'écran.", type: "expr", warning: "Définie par le fichier pins de la carte." },
  LCD_BACKLIGHT_TIMEOUT: { category: "display", description: "Délai (s) avant extinction automatique du rétroéclairage LCD.", type: "number", units: "s" },

  HAS_WIRED_NETWORKING: { category: "network", description: "Réseau filaire (Ethernet).", type: "flag" },
  HAS_WIFI: { category: "network", description: "Support Wi-Fi.", type: "flag" },
  WIFISUPPORT: { category: "network", description: "Gestion Wi-Fi Marlin pour ESP32 natif ou module WiFi-101 pris en charge.", type: "flag" },
  ESP3D_WIFISUPPORT: { category: "network", description: "Gestion Wi-Fi par la bibliothèque ESP3D sur un ESP32 compatible.", type: "flag" },
  WEBSUPPORT: { category: "network", description: "Serveur Web embarqué Marlin (dépend du mode Wi-Fi et de la version).", type: "flag" },
  OTASUPPORT: { category: "network", description: "Mise à jour firmware OTA (dépend du matériel et du mode Wi-Fi).", type: "flag" },
  WIFI_CUSTOM_COMMAND: { category: "network", description: "Commandes Wi-Fi ESP3D accessibles depuis l'hôte série.", type: "flag" },
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
  USE_WATCHDOG: { category: "safety", description: "Active le watchdog matériel : redémarre le contrôleur si le firmware se bloque et n'assure plus la régulation thermique.", type: "flag", risk: "Élevé", warning: "Ne jamais désactiver sans raison précise ; c'est une protection de sécurité." },

  // --- Board / Pins Studio (AllStudios) ---
  STRING_CONFIG_H_AUTHOR: { category: "general", description: "Nom de l'auteur de la configuration, affiché dans M115/Marlin.", type: "string" },
  SERIAL_PORT: { category: "general", description: "Port série principal utilisé pour la communication avec l'hôte.", type: "number" },
  SERIAL_PORT_2: { category: "general", description: "Port série secondaire (facultatif).", type: "number" },

  // --- Motion Studio ---
  DEFAULT_RETRACT_ACCELERATION: { category: "motion", description: "Accélération par défaut lors des rétractions.", type: "number" },
  DEFAULT_XJERK: { category: "motion", description: "Jerk par défaut sur l'axe X (mm/s), machines sans Junction Deviation.", type: "number" },
  DEFAULT_YJERK: { category: "motion", description: "Jerk par défaut sur l'axe Y (mm/s).", type: "number" },
  DEFAULT_ZJERK: { category: "motion", description: "Jerk par défaut sur l'axe Z (mm/s).", type: "number" },
  DEFAULT_EJERK: { category: "motion", description: "Jerk par défaut sur l'extrudeur E (mm/s).", type: "number" },
  MANUAL_X_HOME_POS: { category: "motion", description: "Position X déclarée après homing manuel.", type: "number" },
  MANUAL_Y_HOME_POS: { category: "motion", description: "Position Y déclarée après homing manuel.", type: "number" },
  MANUAL_Z_HOME_POS: { category: "motion", description: "Position Z déclarée après homing manuel.", type: "number" },
  Z_MIN_POS: { category: "machine", description: "Position minimale de l'axe Z (mm).", type: "number" },
  BED_CENTER_AT_0_0: { category: "machine", description: "Considère le centre du plateau comme origine (0,0), typique des machines delta.", type: "flag" },

  // --- Motor Direction Studio ---
  INVERT_X_DIR: { category: "motion", description: "Inverse le sens de rotation du moteur X.", type: "flag" },
  INVERT_Y_DIR: { category: "motion", description: "Inverse le sens de rotation du moteur Y.", type: "flag" },
  INVERT_Z_DIR: { category: "motion", description: "Inverse le sens de rotation du moteur Z.", type: "flag" },
  INVERT_E0_DIR: { category: "extruder", description: "Inverse le sens de rotation de l'extrudeur E0.", type: "flag" },
  INVERT_E1_DIR: { category: "extruder", description: "Inverse le sens de rotation de l'extrudeur E1.", type: "flag" },
  INVERT_E2_DIR: { category: "extruder", description: "Inverse le sens de rotation de l'extrudeur E2.", type: "flag" },
  INVERT_E3_DIR: { category: "extruder", description: "Inverse le sens de rotation de l'extrudeur E3.", type: "flag" },

  // --- Temperature / Fan Studio ---
  BED_MAXTEMP: { category: "thermal", description: "Température maximale autorisée pour le plateau (°C).", type: "number", risk: "Élevé" },
  WATCH_TEMP_PERIOD: { category: "thermal", description: "Durée (s) de surveillance de la montée en température du hotend après consigne.", type: "number", units: "s" },
  WATCH_TEMP_INCREASE: { category: "thermal", description: "Hausse minimale attendue (°C) pendant la période de surveillance, sinon erreur thermique.", type: "number", units: "°C" },
  PIDTEMPCHAMBER: { category: "thermal", description: "Active la régulation PID de la chambre.", type: "flag" },
  FAN_MIN_PWM: { category: "thermal", description: "Valeur PWM minimale appliquée à un ventilateur actif.", type: "number" },
  FAN_MAX_PWM: { category: "thermal", description: "Valeur PWM maximale appliquée à un ventilateur.", type: "number" },
  EXTRUDER_AUTO_FAN_TEMPERATURE: { category: "thermal", description: "Température hotend déclenchant le ventilateur de refroidissement automatique.", type: "number", units: "°C" },
  EXTRUDER_AUTO_FAN_SPEED: { category: "thermal", description: "Vitesse PWM du ventilateur de refroidissement automatique de l'extrudeur.", type: "number" },

  // --- Power / PSU Studio ---
  PSU_ACTIVE_STATE: { category: "safety", description: "Niveau logique correspondant à une alimentation active (HIGH/LOW).", type: "flag" },
  PSU_DEFAULT_OFF: { category: "safety", description: "Laisse l'alimentation éteinte par défaut au démarrage.", type: "flag" },
  PS_OFF_CONFIRMATION: { category: "safety", description: "Demande confirmation avant d'exécuter M81 (extinction).", type: "flag" },
  POWER_TIMEOUT: { category: "safety", description: "Délai (s) avant extinction automatique de l'alimentation en veille.", type: "number", units: "s" },

  // --- Stepper Driver / TMC Studio ---
  E0_CURRENT: { category: "drivers", description: "Courant RMS extrudeur E0 (mA).", type: "number" },
  Y_CURRENT: { category: "drivers", description: "Courant RMS axe Y (mA).", type: "number" },
  Z_CURRENT: { category: "drivers", description: "Courant RMS axe Z (mA).", type: "number" },
  INTERPOLATE: { category: "drivers", description: "Active l'interpolation à 256 microsteps sur les drivers TMC compatibles.", type: "flag" },
  MONITOR_DRIVER_STATUS: { category: "drivers", description: "Surveille l'état des drivers TMC (surchauffe, sur-courant) via UART/SPI.", type: "flag" },

  // --- Sensorless Homing Studio ---
  X_STALL_SENSITIVITY: { category: "drivers", description: "Sensibilité StallGuard pour le homing sensorless en X.", type: "number", risk: "Modéré" },
  Y_STALL_SENSITIVITY: { category: "drivers", description: "Sensibilité StallGuard pour le homing sensorless en Y.", type: "number", risk: "Modéré" },
  IMPROVE_HOMING_RELIABILITY: { category: "drivers", description: "Ajuste automatiquement l'accélération pendant le homing sensorless pour réduire les faux déclenchements.", type: "flag" },

  // --- Linear Advance Studio ---
  LIN_ADVANCE_K: { category: "advanced", description: "Facteur K par défaut du Linear Advance.", type: "float" },
  EXTRA_LIN_ADVANCE_K: { category: "advanced", description: "Second facteur K Linear Advance (M900 L). Ancien nom, remplacé par ADVANCE_K_EXTRA depuis Marlin 2.1.x.", type: "float" },
  ADVANCE_K_EXTRA: { category: "advanced", description: "Second facteur K Linear Advance configurable via M900 L (nouveau nom de EXTRA_LIN_ADVANCE_K depuis Marlin 2.1.x).", type: "flag" },
  SHAPING_FREQ_Z: { category: "advanced", description: "Fréquence de résonance dominante de l'axe Z (Hz), si l'Input Shaping Z est disponible.", type: "number", units: "Hz" },
  SHAPING_ZETA_Z: { category: "advanced", description: "Ratio d'amortissement (zeta) de l'axe Z.", type: "float" },
  FTM_SHAPING_DEFAULT_FREQ_X: { category: "advanced", description: "Fréquence de shaping FT Motion par défaut sur X (Hz).", type: "float", units: "Hz" },
  FTM_SHAPING_DEFAULT_FREQ_Y: { category: "advanced", description: "Fréquence de shaping FT Motion par défaut sur Y (Hz).", type: "float", units: "Hz" },
  FTM_SHAPING_ZETA_X: { category: "advanced", description: "Ratio d'amortissement FT Motion sur X.", type: "float" },
  FTM_SHAPING_ZETA_Y: { category: "advanced", description: "Ratio d'amortissement FT Motion sur Y.", type: "float" },
  CUSTOM_BOOTSCREEN_BMPWIDTH: { category: "display", description: "Largeur (pixels) du bitmap de bootscreen personnalisé.", type: "number" },
  CUSTOM_BOOTSCREEN_BMPHEIGHT: { category: "display", description: "Hauteur (pixels) du bitmap de bootscreen personnalisé.", type: "number" },
  CUSTOM_BOOTSCREEN_INVERTED: { category: "display", description: "Inverse les couleurs du bootscreen personnalisé.", type: "flag" },
  CUSTOM_BOOTSCREEN_TEXT: { category: "display", description: "Texte affiché avec le bootscreen personnalisé.", type: "string" },
  CUSTOM_BOOTSCREEN_CHARACTERS: { category: "display", description: "Caractères personnalisés du bootscreen pour écrans HD44780.", type: "string" },
  CUSTOM_BOOTSCREEN_X: { category: "display", description: "Position X du texte/bitmap de bootscreen.", type: "number" },
  CUSTOM_BOOTSCREEN_Y: { category: "display", description: "Position Y du texte/bitmap de bootscreen.", type: "number" },
  STATUS_LOGO_WIDTH: { category: "display", description: "Largeur (pixels) du logo de l'écran de statut.", type: "number" },
  STATUS_LOGO_HEIGHT: { category: "display", description: "Hauteur (pixels) du logo de l'écran de statut.", type: "number" },
  STATUS_LOGO_X: { category: "display", description: "Position X du logo de l'écran de statut.", type: "number" },
  STATUS_LOGO_Y: { category: "display", description: "Position Y du logo de l'écran de statut.", type: "number" },

  // --- Input Shaping / vibrations (Configuration_adv.h, ZV Input Shaping) ---
  INPUT_SHAPING_X: { category: "advanced", description: "Active l'Input Shaping (réduction de résonance) sur l'axe X.", type: "flag" },
  INPUT_SHAPING_Y: { category: "advanced", description: "Active l'Input Shaping (réduction de résonance) sur l'axe Y.", type: "flag" },
  SHAPING_FREQ_X: { category: "advanced", description: "Fréquence de résonance dominante mesurée sur l'axe X (Hz).", type: "number", units: "Hz" },
  SHAPING_FREQ_Y: { category: "advanced", description: "Fréquence de résonance dominante mesurée sur l'axe Y (Hz).", type: "number", units: "Hz" },
  SHAPING_ZETA_X: { category: "advanced", description: "Ratio d'amortissement (zeta) de l'axe X, de 0 (aucun) à 1 (critique).", type: "float" },
  SHAPING_ZETA_Y: { category: "advanced", description: "Ratio d'amortissement (zeta) de l'axe Y, de 0 (aucun) à 1 (critique).", type: "float" },
  FT_MOTION: { category: "advanced", description: "Active le mode de mouvement à temps fixe (Fixed-Time Motion), alternative à l'Input Shaping classique.", type: "flag", risk: "Modéré" },
  FTM_SHAPING_V_TOL_X: { category: "advanced", description: "Tolérance de vitesse résiduelle après shaping FT Motion sur X.", type: "float" },
  FTM_SHAPING_V_TOL_Y: { category: "advanced", description: "Tolérance de vitesse résiduelle après shaping FT Motion sur Y.", type: "float" },
  FTM_SHAPING_V_TOL_Z: { category: "advanced", description: "Tolérance de vitesse résiduelle après shaping FT Motion sur Z.", type: "float" },

  // --- Safety Studio ---
  VALIDATE_HOMING_ENDSTOPS: { category: "safety", description: "Vérifie qu'un endstop a bien été atteint pendant le homing, sinon signale une erreur.", type: "flag" },

  // --- Bed Leveling / Z Offset Studio ---
  AUTO_BED_LEVELING_UBL: { category: "leveling", description: "Nivellement Unified Bed Leveling (maillage avancé éditable).", type: "flag" },
  Z_CLEARANCE_DEPLOY_PROBE: { category: "probe", description: "Hauteur Z de dégagement lors du déploiement de la sonde.", type: "number", units: "mm" },
  Z_CLEARANCE_BETWEEN_PROBES: { category: "probe", description: "Hauteur Z de dégagement entre deux points de palpage.", type: "number", units: "mm" },
  Z_PROBE_OFFSET_RANGE_MIN: { category: "probe", description: "Limite basse acceptée pour l'offset Z de la sonde (M851).", type: "number", units: "mm" },
  Z_PROBE_OFFSET_RANGE_MAX: { category: "probe", description: "Limite haute acceptée pour l'offset Z de la sonde (M851).", type: "number", units: "mm" },

  // --- Extruder Studio ---
  DEFAULT_NOMINAL_FILAMENT_DIA: { category: "extruder", description: "Diamètre nominal du filament (mm).", type: "float" },
  EXTRUDE_MAXLENGTH: { category: "extruder", description: "Longueur maximale extrudable en une seule commande (mm), protection anti-bourrage.", type: "number", units: "mm" },
  PREVENT_COLD_EXTRUSION: { category: "safety", description: "Empêche toute extrusion sous la température minimale (EXTRUDE_MINTEMP).", type: "flag", risk: "Élevé" },

  // --- SD / Media Studio ---
  LONG_FILENAME_HOST_SUPPORT: { category: "display", description: "Transmet les noms de fichiers longs à l'hôte/slicer (pas seulement le format 8.3).", type: "flag" },
  AUTO_REPORT_SD_STATUS: { category: "display", description: "Rapporte automatiquement l'état de la carte SD à intervalle régulier.", type: "flag" },

  // --- Network / Connectivity / Lighting / Camera Studio ---
  WEBSERVER_PORT: { category: "network", description: "Port TCP du serveur web embarqué, sur les cartes qui l'exposent.", type: "number" },
  HOSTNAME: { category: "network", description: "Nom d'hôte réseau de l'imprimante.", type: "string" },
  WIFI_SSID: { category: "network", description: "Nom du réseau Wi-Fi auquel se connecter.", type: "string" },
  WIFI_PWD: { category: "network", description: "Mot de passe Wi-Fi compilé; garde-le dans Configuration_Secure.h et hors des dépôts publics.", type: "string", risk: "Élevé" },
  CAMERA_URL: { category: "network", description: "URL du flux vidéo d'une caméra IP/MJPEG associée à l'impression.", type: "string" },
  CAMERA_SNAPSHOT_URL: { category: "network", description: "URL de capture d'image fixe de la caméra.", type: "string" },
  NEOPIXEL_BRIGHTNESS: { category: "advanced", description: "Luminosité globale des NeoPixels (0-255).", type: "number" },
  NEOPIXEL_PIXELS: { category: "advanced", description: "Nombre de LED NeoPixel connectées.", type: "number" },
  NEOPIXEL_STARTUP_TEST: { category: "advanced", description: "Joue une animation de test des NeoPixels au démarrage.", type: "flag" },

  // --- Speaker Studio ---
  SPEAKER: { category: "display", description: "Indique que le buzzer est un haut-parleur piézo capable de jouer plusieurs tonalités, plutôt qu'un simple buzzer tout-ou-rien.", type: "flag" },
  STARTUP_TUNE: { category: "display", description: "Joue une mélodie de démarrage sur le haut-parleur (nécessite SPEAKER).", type: "flag" },

  // --- Bootscreen Studio ---
  CUSTOM_BOOTSCREEN_TIMEOUT: { category: "display", description: "Durée d'affichage (ms) du bootscreen personnalisé avant de passer à l'écran principal.", type: "number", units: "ms" },
  CUSTOM_BOOTSCREEN_ANIMATED: { category: "display", description: "Anime le bootscreen personnalisé (plusieurs images successives).", type: "flag" },
  CUSTOM_BOOTSCREEN_FRAME_TIME: { category: "display", description: "Durée d'affichage (ms) de chaque image d'un bootscreen animé.", type: "number", units: "ms" },
};

// Dependencies: if a param requires another to be enabled
export const DEPENDENCIES = {
  AUTO_BED_LEVELING_BILINEAR: ["GRID_MAX_POINTS_X", "GRID_MAX_POINTS_Y", "Z_SAFE_HOMING"],
  AUTO_BED_LEVELING_LINEAR: [],
  AUTO_BED_LEVELING_3POINT: ["Z_SAFE_HOMING"],
  GRID_MAX_POINTS_X: ["AUTO_BED_LEVELING_BILINEAR"],
  GRID_MAX_POINTS_Y: ["AUTO_BED_LEVELING_BILINEAR"],
  BLTOUCH: [],
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
  if (/^(?:[XYZIJKUVW]\d*|E\d+)_(?:DRIVER|MICROSTEP|CURRENT|RMS|STALL|HYBRID|HOLD|RSENSE)/.test(name)) return "drivers";
  if (/^INVERT_.*_DIR$/.test(name)) return /_E\d+/.test(name) ? "extruder" : "motion";
  if (/TEMP|HEATER|PID|THERM|^FAN_|_FAN_|AUTO_FAN/.test(name)) return "thermal";
  if (/PROBE|BLTOUCH|Z_MIN|ENDSTOPPULL|_ENDSTOP|^USE_[XYZ].*_PLUG/.test(name)) return "probe";
  if (/LEVEL|GRID|MESH|HOMING/.test(name)) return "leveling";
  if (/EEPROM/.test(name)) return "eeprom";
  if (/DISPLAY|LCD|SCREEN|SD|TOUCH|TFT/.test(name)) return "display";
  if (/FEEDRATE|ACCEL|STEPS|JUNCTION|HOMING/.test(name)) return "motion";
  if (/EXTRUD|NOZZLE|E0|E1/.test(name)) return "extruder";
  if (/BED|BEDSIZE/.test(name)) return "bed";
  if (/NET|WIFI|ETHERNET|HOST/.test(name)) return "network";
  if (/SAFETY|WATCHDOG|PROTECT/.test(name)) return "safety";
  return "advanced";
}

export function getMeta(name) {
  if (PARAM_KNOWLEDGE[name]) return PARAM_KNOWLEDGE[name];
  if (/^TEMP_SENSOR_[0-7]$/.test(name)) {
    const extruder = Number(name.slice("TEMP_SENSOR_".length));
    return { category: "thermal", description: `Type de capteur de température de l'extrudeur ${extruder}.`, type: "number" };
  }
  if (/^HEATER_[0-7]_(?:MIN|MAX)TEMP$/.test(name)) return { category: "thermal", description: `Limite ${name.includes("MINTEMP") ? "minimale" : "maximale"} de température de ${name.match(/^HEATER_(\d+)/)?.[1] === "0" ? "l'extrudeur" : `l'extrudeur ${name.match(/^HEATER_(\d+)/)?.[1]}`} (°C).`, type: "number" };
  if (/^(?:BED|CHAMBER|COOLER)_(?:MIN|MAX)TEMP$/.test(name)) return { category: "thermal", description: `Limite de température ${name.includes("MINTEMP") ? "minimale" : "maximale"} (${name.split("_")[0]}) en °C.`, type: "number" };
  if (/_DRIVER_TYPE$/.test(name)) return { category: "drivers", description: `Type de driver moteur pour l'axe ${name.replace(/_DRIVER_TYPE$/, "")}.`, type: "string" };
  if (/(?:_CURRENT|_MICROSTEPS|_STALL_SENSITIVITY|_HYBRID_THRESHOLD|_HOLD_MULTIPLIER|_CHAIN_POS|_RSENSE|_RMS_CURRENT)$/.test(name)) return { category: "drivers", description: `Paramètre moteur ${name.replaceAll("_", " ")}.`, type: "number" };
  return { category: getCategoryForParam(name), description: "Paramètre non documenté. Éditable comme macro générique.", type: null };
}
