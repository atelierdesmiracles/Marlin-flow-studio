import React, { useMemo, useState } from "react";
import { useProject } from "@/lib/projectStore";
import { agentApi } from "@/lib/localAgent";
import { findWritableParam, writableConfigFiles } from "@/lib/configFileModel";
import {
  AlertTriangle, CheckCircle2, Cpu, Info, Monitor, RefreshCw, RotateCcw,
  Save, Settings2, SlidersHorizontal, Smartphone, Volume2
} from "lucide-react";

// Real Marlin display directives. The list is intentionally limited to known
// Marlin options; a profile is only writable when the directive exists in the
// loaded firmware, so the Studio never invents unsupported configuration.
const DISPLAY_PROFILES = [
  ["REPRAP_DISCOUNT_SMART_CONTROLLER", "RepRapDiscount Smart Controller", "LCD caractère", "20x4 / encodeur"],
  ["REPRAP_DISCOUNT_FULL_GRAPHIC_SMART_CONTROLLER", "RepRapDiscount Full Graphic", "Graphique", "128×64 / encodeur"],
  ["REPRAPWORLD_GRAPHICAL_LCD", "RepRapWorld Graphical LCD", "Graphique", "128×64"],
  ["VIKI2", "Panucatt Viki 2", "Graphique", "LCD graphique"],
  ["miniVIKI", "Panucatt miniViki", "Graphique", "LCD graphique"],
  ["MINIPANEL", "MakerLab Mini Panel", "Graphique", "SD + encodeur"],
  ["MAKRPANEL", "MaKr3d Makr-Panel", "Graphique", "SD + encodeur"],
  ["ELB_FULL_GRAPHIC_CONTROLLER", "Adafruit ST7565 Full Graphic", "Graphique", "ST7565"],
  ["BQ_LCD_SMART_CONTROLLER", "BQ LCD Smart Controller", "LCD caractère", "Hephestos / Witbox"],
  ["CARTESIO_UI", "Cartesio UI", "LCD", "Clavier ADC"],
  ["LCD_FOR_MELZI", "LCD for Melzi", "Graphique", "128×64"],
  ["ULTI_CONTROLLER", "Ulticontroller", "Graphique", "SSD1309 / I2C"],
  ["MKS_MINI_12864", "MKS MINI 12864", "Graphique", "128×64 / SD"],
  ["MKS_MINI_12864_V3", "MKS MINI 12864 V3", "Graphique", "128×64 / NeoPixel"],
  ["MKS_LCD12864A", "MKS LCD12864A", "Graphique", "128×64 / SD"],
  ["MKS_LCD12864B", "MKS LCD12864B", "Graphique", "128×64 / SD"],
  ["FYSETC_MINI_12864_X_X", "FYSETC MINI 12864 X_X", "Graphique", "128×64 / SD"],
  ["FYSETC_MINI_12864_1_2", "FYSETC MINI 12864 1.2", "Graphique", "128×64 / RGB"],
  ["FYSETC_MINI_12864_2_0", "FYSETC MINI 12864 2.0", "Graphique", "128×64 / RGB"],
  ["FYSETC_MINI_12864_2_1", "FYSETC MINI 12864 2.1", "Graphique", "128×64 / NeoPixel"],
  ["FYSETC_GENERIC_12864_1_1", "FYSETC Generic 12864", "Graphique", "128×64"],
  ["BTT_MINI_12864", "BigTreeTech MINI 12864", "Graphique", "128×64 / NeoPixel"],
  ["BEEZ_MINI_12864", "Beez MINI 12864", "Graphique", "128×64 / NeoPixel"],
  ["CR10_STOCKDISPLAY", "Creality CR-10 / Ender-3 Stock", "Graphique", "128×64"],
  ["ENDER2_STOCKDISPLAY", "Ender-2 Stock", "Graphique", "128×64"],
  ["ANET_FULL_GRAPHICS_LCD", "Anet Full Graphics LCD", "Graphique", "128×64"],
  ["CTC_A10S_A13", "CTC A10S / A13", "Graphique", "128×64"],
  ["AZSMZ_12864", "AZSMZ 12864", "Graphique", "128×64 / SD"],
  ["SILVER_GATE_GLCD_CONTROLLER", "Silver Gate GLCD", "Graphique", "GLCD"],
  ["EMOTION_TECH_LCD", "eMotion Tech LCD", "Graphique", "LCD + SD"],
  ["U8GLIB_SSD1306", "OLED SSD1306", "OLED", "I²C / graphique"],
  ["SAV_3DGLCD", "SAV 3DGLCD", "OLED", "SSD1306 / SH1106"],
  ["MKS_ROBIN_TFT24", "MKS Robin TFT24", "TFT", "320×240"],
  ["MKS_ROBIN_TFT28", "MKS Robin TFT28", "TFT", "320×240"],
  ["MKS_ROBIN_TFT32", "MKS Robin TFT32", "TFT", "320×240"],
  ["MKS_ROBIN_TFT35", "MKS Robin TFT35", "TFT", "480×320"],
  ["MKS_ROBIN_TFT43", "MKS Robin TFT43", "TFT", "480×272"],
  ["MKS_ROBIN_TFT_V1_1R", "MKS Robin TFT V1.1R", "TFT", "320×240"],
  ["TFT_TRONXY_X5SA", "Tronxy X5SA TFT", "TFT", "480×320"],
  ["ANYCUBIC_TFT35", "AnyCubic TFT35", "TFT", "480×320"],
  ["LONGER_LK_TFT28", "Longer LK TFT28", "TFT", "320×240"],
  ["ANET_ET4_TFT28", "Anet ET4 TFT28", "TFT", "320×240"],
  ["ANET_ET5_TFT35", "Anet ET5 TFT35", "TFT", "480×320"],
  ["BIQU_BX_TFT70", "BIQU BX TFT70", "TFT RGB", "1024×600"],
  ["BTT_TFT35_SPI_V1_0", "BTT TFT35 SPI V1.0", "TFT SPI", "480×320"],
  ["TFT_GENERIC", "TFT générique", "TFT", "Pilote / interface / résolution"],
];

const LANGUAGES = [
  ["en", "English"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"],
  ["it", "Italiano"], ["pt", "Português"], ["pt_br", "Português (Brésil)"],
  ["nl", "Nederlands"], ["pl", "Polski"], ["ru", "Русский"], ["uk", "Українська"],
  ["tr", "Türkçe"], ["zh_CN", "中文简体"], ["zh_TW", "中文繁體"], ["ko_KR", "한국어"],
  ["jp_kana", "日本ais / Kana"], ["test", "TEST"],
];

const CHARSETS = [["JAPANESE", "JAPANESE"], ["WESTERN", "WESTERN"], ["CYRILLIC", "CYRILLIC"]];
const TFT_DRIVERS = [["AUTO", "AUTO"], ["ST7735", "ST7735"], ["ST7789", "ST7789"], ["ST7796", "ST7796"], ["R61505", "R61505"], ["ILI9328", "ILI9328"], ["ILI9341", "ILI9341"], ["ILI9488", "ILI9488"]];
const TFT_RES = [["TFT_RES_320x240", "320×240"], ["TFT_RES_480x272", "480×272"], ["TFT_RES_480x320", "480×320"], ["TFT_RES_800x480", "800×480"], ["TFT_RES_1024x600", "1024×600"]];
const TFT_ROTATIONS = ["TFT_NO_ROTATION", "TFT_ROTATE_90", "TFT_ROTATE_90_MIRROR_X", "TFT_ROTATE_90_MIRROR_Y", "TFT_ROTATE_180", "TFT_ROTATE_180_MIRROR_X", "TFT_ROTATE_180_MIRROR_Y", "TFT_ROTATE_270", "TFT_ROTATE_270_MIRROR_X", "TFT_ROTATE_270_MIRROR_Y", "TFT_MIRROR_X", "TFT_MIRROR_Y"];

const TOUCH_PINS = [
  ["TOUCH_INT_PIN", "Interruption tactile (INT)"],
  ["TOUCH_CS_PIN", "Chip Select tactile (CS)"],
  ["TOUCH_SCK_PIN", "Horloge SPI tactile (SCK)"],
  ["TOUCH_MISO_PIN", "MISO tactile"],
  ["TOUCH_MOSI_PIN", "MOSI tactile"],
  ["TOUCH_RESET_PIN", "Reset tactile"],
];

// Réglages logiciels de l'écran tactile résistif/capacitif (Configuration.h /
// Configuration_adv.h). Contrairement à TOUCH_PINS (brochage matériel hérité
// du fichier pins de la carte, lecture seule), ces directives vivent dans la
// configuration du projet et sont donc réellement éditables lorsqu'elles sont
// présentes dans le firmware chargé.
const TOUCH_SETTINGS = [
  ["TOUCH_SCREEN", "Écran tactile (TOUCH_SCREEN)", "bool"],
  ["TOUCH_SCREEN_CALIBRATION", "Assistant de calibration (M255)", "bool"],
  ["TOUCH_CALIBRATION_AUTO_SAVE", "Sauvegarde auto. de la calibration", "bool"],
  ["TOUCH_CALIBRATION_X", "Calibration X", "number"],
  ["TOUCH_CALIBRATION_Y", "Calibration Y", "number"],
  ["TOUCH_OFFSET_X", "Offset X", "number"],
  ["TOUCH_OFFSET_Y", "Offset Y", "number"],
  ["TOUCH_ORIENTATION", "Orientation tactile", "choice", [["TOUCH_LANDSCAPE", "Paysage"], ["TOUCH_PORTRAIT", "Portrait"]]],
  ["SINGLE_TOUCH_NAVIGATION", "Navigation tactile mono-point", "bool"],
  ["NO_BACK_MENU_ITEM", "Masquer l'élément de menu Retour", "bool"],
  ["BUTTON_DELAY_EDIT", "Délai répétition — édition (ms)", "number"],
  ["BUTTON_DELAY_MENU", "Délai répétition — menus (ms)", "number"],
  ["TOUCH_BUTTONS", "Boutons tactiles résistifs (ADC)", "bool"],
];

const ADVANCED = [
  ["LCD_LANGUAGE", "Langue LCD", "choice", LANGUAGES],
  ["DISPLAY_CHARSET_HD44780", "Jeu de caractères HD44780", "choice", CHARSETS],
  ["LCD_INFO_SCREEN_STYLE", "Style écran info", "choice", [["0", "Classique"], ["1", "Prusa"]]],
  ["LCD_INFO_MENU", "Menu Information", "bool"],
  ["STATUS_MESSAGE_SCROLLING", "Défilement messages", "bool"],
  ["SHOW_BOOTSCREEN", "Afficher Bootscreen", "bool"],
  ["SHOW_CUSTOM_BOOTSCREEN", "Bootscreen personnalisé", "bool"],
  ["CUSTOM_STATUS_SCREEN_IMAGE", "Image Status personnalisée", "bool"],
  ["SDSUPPORT", "Support carte SD", "bool"],
  ["NO_LCD_MENUS", "Désactiver menus LCD", "bool"],
  ["SLIM_LCD_MENUS", "Menus LCD réduits", "bool"],
  ["REVERSE_ENCODER_DIRECTION", "Inverser encodeur", "bool"],
  ["ENCODER_PULSES_PER_STEP", "Pulsations encodeur / pas", "number"],
  ["ENCODER_STEPS_PER_MENU_ITEM", "Pas encodeur / menu", "number"],
  ["TFT_GENERIC", "TFT générique", "bool"],
  ["TFT_DRIVER", "Pilote TFT", "choice", TFT_DRIVERS],
  ["TFT_INTERFACE_FSMC", "Interface FSMC", "bool"],
  ["TFT_INTERFACE_SPI", "Interface SPI", "bool"],
  ["TFT_RES_320x240", "Résolution 320×240", "bool"],
  ["TFT_RES_480x272", "Résolution 480×272", "bool"],
  ["TFT_RES_480x320", "Résolution 480×320", "bool"],
  ["TFT_RES_800x480", "Résolution 800×480", "bool"],
  ["TFT_RES_1024x600", "Résolution 1024×600", "bool"],
  ["TFT_ROTATION", "Rotation TFT", "choice", TFT_ROTATIONS.map(x => [x, x])],
  ["TFT_COLOR_UI", "TFT Color UI", "bool"],
  ["TFT_CLASSIC_UI", "TFT Classic UI", "bool"],
  ["TFT_LVGL_UI", "TFT LVGL UI", "bool"],
  ["TOUCH_UI_FTDI_EVE", "Touch UI FTDI EVE", "bool"],
  ["TOUCH_UI_320x240", "Touch UI 320×240", "bool"],
  ["TOUCH_UI_480x272", "Touch UI 480×272", "bool"],
  ["TOUCH_UI_800x480", "Touch UI 800×480", "bool"],
  ["TOUCH_UI_INVERTED", "Touch inversé", "bool"],
  ["TOUCH_UI_PORTRAIT", "Touch portrait", "bool"],
  ["TOUCH_UI_MIRRORED", "Touch miroir", "bool"],
  ["TOUCH_UI_USE_UTF8", "Touch UTF-8", "bool"],
  ["TOUCH_UI_FIT_TEXT", "Adapter le texte Touch", "bool"],
  ["EXTENSIBLE_UI", "Extensible UI", "bool"],
  ["EXTUI_LOCAL_BEEPER", "Beeper local ExtUI", "bool"],
];

const mutuallyExclusive = [
  DISPLAY_PROFILES.map(x => x[0]),
  ["TFT_INTERFACE_FSMC", "TFT_INTERFACE_SPI"],
  TFT_RES.map(x => x[0]),
  ["TFT_COLOR_UI", "TFT_CLASSIC_UI", "TFT_LVGL_UI"],
  ["TOUCH_UI_320x240", "TOUCH_UI_480x272", "TOUCH_UI_800x480"],
];

function find(project, name) {
  const param = findWritableParam(project, name);
  return param?.directive === "define" ? param : null;
}
function findAny(project, name) {
  const files = Object.values(project?.parsedFiles || {});
  for (const file of files) {
    const p = file?.parameters?.find?.(x => x.name === name);
    if (p) return p;
  }
  return null;
}
function pinValue(project, name) {
  const p = findAny(project, name);
  if (!p) return null;
  return p.value ?? p.rawValue ?? p.enabled ?? p.defaultValue ?? null;
}
function value(project, name, fallback = "") {
  const p = find(project, name);
  if (!p) return fallback;
  if (p.type === "flag") return isEnabled(p);
  return p.value ?? fallback;
}

function isEnabled(p) { return Boolean(p && p.directive === "define" && !p.commented); }

export default function DisplayStudio() {
  const { currentProject, updateValue, toggleParam, resetParam, updateProject, exportFile } = useProject();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const params = currentProject?.allParameters || [];
  const presentProfiles = useMemo(() => DISPLAY_PROFILES.filter(([name]) => !!find(currentProject, name)), [currentProject]);
  const activeProfiles = useMemo(() => presentProfiles.filter(([name]) => isEnabled(find(currentProject, name))), [presentProfiles, currentProject]);
  const modified = useMemo(() => params.filter(p => p.modified), [params]);
  const displayModified = useMemo(() => modified.filter(p => DISPLAY_PROFILES.some(x => x[0] === p.name) || ADVANCED.some(x => x[0] === p.name) || TOUCH_PINS.some(x => x[0] === p.name) || TOUCH_SETTINGS.some(x => x[0] === p.name)), [modified]);
  const detectedTouchPins = useMemo(() => TOUCH_PINS.map(([name, label]) => ({ name, label, param: findAny(currentProject, name), value: pinValue(currentProject, name) })).filter(x => x.param), [currentProject]);
  const detectedTouchSettings = useMemo(() => TOUCH_SETTINGS.some(([name]) => !!find(currentProject, name)), [currentProject]);
  const filteredProfiles = presentProfiles.filter(x => `${x[0]} ${x[1]} ${x[2]} ${x[3]}`.toLowerCase().includes(search.toLowerCase()));

  if (!currentProject) return <div className="p-8 text-muted-foreground">Ouvre d'abord un projet Marlin.</div>;

  const flash = (text, bad = false) => {
    if (bad) { setError(text); setMsg(""); } else { setMsg(text); setError(""); }
    window.setTimeout(() => bad ? setError("") : setMsg(""), 3500);
  };

  const setBool = (name, wanted) => {
    const p = find(currentProject, name);
    if (!p) return flash(`${name} n'est pas présent dans le firmware chargé.`, true);
    if (isEnabled(p) !== wanted) toggleParam(currentProject.id, p.file, p);
  };

  const setValue = (name, next) => {
    const p = find(currentProject, name);
    if (!p) return flash(`${name} n'est pas présent dans le firmware chargé.`, true);
    if (p.type === "flag" && typeof next === "boolean") setBool(name, next);
    else updateValue(currentProject.id, p.file, p, next);
  };

  const selectExclusive = (name, group) => {
    const target = find(currentProject, name);
    if (!target) return flash(`${name} n'est pas présent dans le firmware chargé. Cette version de Marlin ne l'expose pas dans ses fichiers.`, true);
    for (const candidate of group) {
      if (candidate === name) setBool(candidate, true);
      else if (find(currentProject, candidate)) setBool(candidate, false);
    }
    flash(`Profil écran sélectionné : ${name}`);
  };

  const selectTftRotation = (next) => {
    const p = find(currentProject, "TFT_ROTATION");
    if (!p) return flash("TFT_ROTATION n'est pas présent dans le firmware chargé.", true);
    updateValue(currentProject.id, p.file, p, next);
    flash(`Rotation TFT : ${next}`);
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      if (!currentProject.localProjectPath) throw new Error("Aucun projet local sélectionné. Ouvre un projet depuis le disque avant d'écrire le firmware.");
      const writable = new Set(writableConfigFiles(currentProject));
      const touched = [...new Set(displayModified.filter(p => writable.has(p.file)).map(p => p.file))];
      if (!touched.length) throw new Error("Aucune modification d'écran à enregistrer.");
      const files = Object.fromEntries(touched.map(file => [file, exportFile(currentProject.id, file)]));
      const hashes = Object.fromEntries(touched.filter(f => currentProject.localHashes?.[f]).map(f => [f, currentProject.localHashes[f]]));
      await agentApi.selectProject(currentProject.localProjectPath);
      const result = await agentApi.applyConfiguration(files, hashes);
      const nextHashes = { ...(currentProject.localHashes || {}) };
      for (const item of result.written || []) nextHashes[item.filename] = item.sha256;
      updateProject({ ...currentProject, localHashes: nextHashes, updatedDate: new Date().toISOString() });
      flash(`✓ ${touched.join(", ")} enregistré(s) avec sauvegarde .bak`);
    } catch (e) { flash(e.message || String(e), true); }
    finally { setBusy(false); }
  };

  const reset = () => {
    for (const p of displayModified) resetParam(currentProject.id, p.file, p);
    flash(displayModified.length ? `${displayModified.length} modification(s) écran réinitialisée(s).` : "Aucune modification écran.");
  };

  const renderAdvanced = ([name, label, type, options]) => {
    const p = find(currentProject, name);
    if (!p) return null;
    const v = p.type === "flag" ? isEnabled(p) : (p.value ?? "");
    return <div key={name} className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2"><div><div className="text-sm font-medium">{label}</div><div className="font-mono text-[10px] text-muted-foreground">{name}</div></div><span className="text-[10px] rounded-full border px-2 py-0.5">{p.file}</span></div>
      <div className="mt-2">
        {type === "bool" && <button onClick={() => setBool(name, !Boolean(v))} className={`w-full text-left px-3 py-2 rounded-lg border ${Boolean(v) ? "border-emerald-500/40 bg-emerald-500/5" : "bg-muted/20"}`}><span className="font-medium">{Boolean(v) ? "Activé" : "Désactivé"}</span></button>}
        {type === "choice" && <select value={String(v)} onChange={e => setValue(name, e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background">{options.map(([val, label2]) => <option key={val} value={val}>{label2}</option>)}</select>}
        {type === "number" && <input type="number" value={v} onChange={e => setValue(name, Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border bg-background" />}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{p.modified ? "● modification en attente" : "Valeur actuelle du fichier"}</div>
    </div>;
  };

  return <div className="h-full overflow-auto p-5">
    <div className="max-w-7xl mx-auto space-y-5 pb-24">
      <header className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-semibold flex items-center gap-2"><Monitor className="w-6 h-6 text-primary" />Display Studio</h1><p className="text-sm text-muted-foreground mt-1">Configuration complète de l'écran Marlin : contrôleur, TFT, tactile, langue, encodeur, SD et interface utilisateur.</p></div>
          <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border px-3 py-1.5">{presentProfiles.length} profils détectés</span><span className="rounded-full border px-3 py-1.5">{displayModified.length} modification(s)</span></div>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {msg && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm flex gap-2"><CheckCircle2 className="w-4 h-4" />{msg}</div>}

      <section className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h2 className="font-semibold flex items-center gap-2"><Cpu className="w-4 h-4" />Contrôleur / modèle d'écran</h2><p className="text-xs text-muted-foreground mt-1">Seuls les vrais #define présents dans le firmware sont modifiables.</p></div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un écran…" className="md:w-80 px-3 py-2 rounded-lg border bg-background text-sm" /></div>
        {activeProfiles.length > 1 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="w-4 h-4 inline mr-2" />Plusieurs profils d'écran sont actifs. Sélectionne un seul profil avant compilation.</div>}
        {filteredProfiles.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{filteredProfiles.map(([name, label, kind, detail]) => { const p=find(currentProject,name); const active=isEnabled(p); return <button key={name} onClick={() => selectExclusive(name, DISPLAY_PROFILES.map(x=>x[0]))} className={`text-left rounded-xl border p-4 transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/40"}`}><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{label}</div><div className="font-mono text-[10px] text-muted-foreground mt-1">{name}</div></div><span className={`text-[10px] rounded-full px-2 py-1 border ${active ? "border-emerald-500/40 text-emerald-600" : "text-muted-foreground"}`}>{active ? "ACTIF" : "disponible"}</span></div><div className="mt-3 text-xs text-muted-foreground">{kind} · {detail}</div></button>; })}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Aucun profil d'écran connu n'est présent dans les fichiers chargés.</div>}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 space-y-3"><h2 className="font-semibold flex items-center gap-2"><Smartphone className="w-4 h-4" />TFT générique</h2><p className="text-xs text-muted-foreground">Disponible lorsque Marlin expose les directives correspondantes.</p>{[["TFT_DRIVER","Pilote",TFT_DRIVERS],["TFT_RES_320x240","Résolution 320×240",null],["TFT_RES_480x272","Résolution 480×272",null],["TFT_RES_480x320","Résolution 480×320",null],["TFT_RES_800x480","Résolution 800×480",null],["TFT_RES_1024x600","Résolution 1024×600",null]].map(([name,label,opts]) => {const p=find(currentProject,name); if(!p) return null; const v=p.type==="flag"?isEnabled(p):p.value; return <div key={name}>{opts ? <select value={String(v)} onChange={e=>setValue(name,e.target.value)} className="w-full px-3 py-2 rounded border bg-background text-sm">{opts.map(([x,l])=><option key={x} value={x}>{l}</option>)}</select> : <button onClick={()=>{const group=TFT_RES.map(x=>x[0]); selectExclusive(name,group)}} className={`w-full text-left px-3 py-2 rounded border text-sm ${v?"border-primary bg-primary/5":""}`}>{label} — {v?"Activée":"désactivée"}</button>}</div>})}<div className="flex gap-2">{["TFT_INTERFACE_FSMC","TFT_INTERFACE_SPI"].map(name=>{const p=find(currentProject,name); if(!p)return null; return <button key={name} onClick={()=>selectExclusive(name,["TFT_INTERFACE_FSMC","TFT_INTERFACE_SPI"])} className={`flex-1 px-2 py-2 rounded border text-xs ${isEnabled(p)?"border-primary bg-primary/5":""}`}>{name.replace("TFT_INTERFACE_","")}</button>})}</div></div>

        <div className="rounded-xl border bg-card p-4 space-y-3"><h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" />Interface utilisateur</h2><p className="text-xs text-muted-foreground">Classic, Color UI ou LVGL, selon les options présentes.</p>{["TFT_CLASSIC_UI","TFT_COLOR_UI","TFT_LVGL_UI"].map(name=>{const p=find(currentProject,name);if(!p)return null;return <button key={name} onClick={()=>selectExclusive(name,["TFT_CLASSIC_UI","TFT_COLOR_UI","TFT_LVGL_UI"])} className={`w-full text-left px-3 py-2 rounded border text-sm ${isEnabled(p)?"border-primary bg-primary/5":""}`}>{name.replace("TFT_","TFT ")} — {isEnabled(p)?"actif":"inactif"}</button>})}</div>

        <div className="rounded-xl border bg-card p-4 space-y-3"><h2 className="font-semibold flex items-center gap-2"><RotateCcw className="w-4 h-4" />Orientation / tactile</h2>{find(currentProject,"TFT_ROTATION") && <select value={String(value(currentProject,"TFT_ROTATION","TFT_NO_ROTATION"))} onChange={e=>selectTftRotation(e.target.value)} className="w-full px-3 py-2 rounded border bg-background text-sm">{TFT_ROTATIONS.map(x=><option key={x} value={x}>{x}</option>)}</select>}{["TOUCH_UI_INVERTED","TOUCH_UI_PORTRAIT","TOUCH_UI_MIRRORED","TOUCH_UI_USE_UTF8"].map(name=>{const p=find(currentProject,name);if(!p)return null;return <button key={name} onClick={()=>setBool(name,!isEnabled(p))} className={`w-full text-left px-3 py-2 rounded border text-sm ${isEnabled(p)?"border-primary bg-primary/5":""}`}>{name.replace("TOUCH_UI_","")} — {isEnabled(p)?"activé":"désactivé"}</button>})}</div>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-4">
        <div><h2 className="font-semibold flex items-center gap-2"><Smartphone className="w-4 h-4" />🖐️ Brochage tactile</h2><p className="text-xs text-muted-foreground mt-1">Broches réellement détectées dans les fichiers Marlin chargés. Les valeurs provenant de <span className="font-mono">pins_*.h</span> sont affichées en lecture seule : elles dépendent de la carte mère.</p></div>
        {detectedTouchPins.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{detectedTouchPins.map(({name,label,param,value:pin}) => {
          const writable = writableConfigFiles(currentProject).includes(param.file);
          return <div key={name} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-medium">{label}</div><div className="font-mono text-[10px] text-muted-foreground">{name}</div></div><span className="text-[10px] rounded-full border px-2 py-0.5">{param.file}</span></div>
            <div className="mt-3 font-mono text-sm rounded-lg bg-muted/40 px-3 py-2">{String(pin ?? "non défini")}</div>
            <div className="mt-2 text-[10px] text-muted-foreground">{writable ? "Définition modifiable dans ce fichier." : "Broche héritée de la carte / fichier pins — lecture seule."}</div>
          </div>;
        })}</div> : <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Aucune broche tactile <span className="font-mono">TOUCH_*</span> n'a été détectée dans les fichiers du firmware.</div>}
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300">Marlin peut définir <span className="font-mono">TOUCH_INT_PIN</span>, <span className="font-mono">TOUCH_CS_PIN</span>, <span className="font-mono">TOUCH_SCK_PIN</span>, <span className="font-mono">TOUCH_MISO_PIN</span> et <span className="font-mono">TOUCH_MOSI_PIN</span> dans le fichier de pins de la carte. Display Studio conserve donc cette définition matérielle au lieu de la dupliquer artificiellement dans Configuration.h.</div>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-4">
        <div><h2 className="font-semibold flex items-center gap-2"><Settings2 className="w-4 h-4" />🎯 Calibration de l'écran tactile</h2><p className="text-xs text-muted-foreground mt-1">Réglages logiciels <span className="font-mono">TOUCH_*</span> de <span className="font-mono">Configuration.h</span> / <span className="font-mono">Configuration_adv.h</span> : contrairement au brochage matériel ci-dessus, ces valeurs sont réellement modifiables et écrites sur le projet.</p></div>
        {detectedTouchSettings ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {TOUCH_SETTINGS.map(([name, label, type, options]) => {
            const p = find(currentProject, name);
            if (!p) return null;
            const v = type === "bool" ? isEnabled(p) : (p.value ?? "");
            return <div key={name} className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2"><div><div className="text-sm font-medium">{label}</div><div className="font-mono text-[10px] text-muted-foreground">{name}</div></div><span className="text-[10px] rounded-full border px-2 py-0.5">{p.file}</span></div>
              <div className="mt-2">
                {type === "bool" && <button onClick={() => setBool(name, !Boolean(v))} className={`w-full text-left px-3 py-2 rounded-lg border ${Boolean(v) ? "border-emerald-500/40 bg-emerald-500/5" : "bg-muted/20"}`}><span className="font-medium">{Boolean(v) ? "Activé" : "Désactivé"}</span></button>}
                {type === "choice" && <select value={String(v)} onChange={e => setValue(name, e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background">{options.map(([val, label2]) => <option key={val} value={val}>{label2}</option>)}</select>}
                {type === "number" && <input type="number" value={v} onChange={e => setValue(name, Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border bg-background" />}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{p.modified ? "● modification en attente" : "Valeur actuelle du fichier"}</div>
            </div>;
          })}
        </div> : <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Aucun réglage <span className="font-mono">TOUCH_SCREEN</span> / <span className="font-mono">TOUCH_CALIBRATION_*</span> n'a été détecté : ce firmware n'utilise probablement pas d'écran tactile résistif calibré (TFT Color UI/LVGL avec XPT2046 ou équivalent).</div>}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="w-4 h-4 inline mr-2" />Les coefficients de calibration proviennent normalement de la commande <span className="font-mono">M255</span> exécutée sur la machine réelle. Ne pas les modifier à la main sans recalibrer, sous peine de décaler le tactile par rapport à l'affichage.</div>
      </section>

      <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold flex items-center gap-2"><Settings2 className="w-4 h-4" />Réglages écran</h2><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">{ADVANCED.map(renderAdvanced)}</div></section>

      <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold flex items-center gap-2"><Volume2 className="w-4 h-4" />Contrôles complémentaires détectés</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">{[["BEEPER_PIN","Beeper / pin", "info"],["LCD_BACKLIGHT_TIMEOUT","Timeout rétroéclairage","info"],["LCD_BACKLIGHT_TIMEOUT","Timeout rétroéclairage","info"]].map(([name,label])=>{const p=find(currentProject,name);return p?<div key={name} className="rounded-lg border p-3"><div className="text-sm font-medium">{label}</div><div className="font-mono text-xs mt-1">{name}</div><div className="text-xs text-muted-foreground mt-1">{String(p.value ?? p.rawValue ?? p.enabled)}</div></div>:null})}</div><p className="text-xs text-muted-foreground mt-3">Les broches physiques de l'écran restent définies par le fichier pins de la carte. Display Studio ne remplace pas les définitions matérielles de Marlin.</p></section>

      <section className="rounded-xl border bg-card p-4"><button onClick={()=>setShowAdvanced(v=>!v)} className="text-sm font-medium">{showAdvanced?"Masquer":"Afficher"} le diagnostic Display</button>{showAdvanced&&<div className="mt-3 grid md:grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-muted/40 p-3"><b>Fichier(s) modifiables :</b><br/>{writableConfigFiles(currentProject).join(", ")||"aucun"}</div><div className="rounded-lg bg-muted/40 p-3"><b>Profil(s) actif(s) :</b><br/>{activeProfiles.map(x=>x[0]).join(", ")||"aucun"}</div><div className="rounded-lg bg-muted/40 p-3"><b>Paramètres Display modifiés :</b> {displayModified.length}</div><div className="rounded-lg bg-muted/40 p-3"><b>Attention :</b> un profil d'écran doit correspondre exactement au matériel réel.</div></div>}</section>

      <div className="sticky bottom-3 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-lg flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground flex items-center gap-2"><Save className="w-4 h-4" />{displayModified.length} modification(s) écran en attente · écriture réelle + contrôle SHA-256 + .bak</div><div className="flex gap-2"><button onClick={reset} disabled={!displayModified.length||busy} className="px-3 py-2 rounded-lg border disabled:opacity-40"><RefreshCw className="w-4 h-4 inline mr-1"/>Réinitialiser</button><button onClick={save} disabled={!displayModified.length||busy} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"><Save className="w-4 h-4 inline mr-1"/>{busy?"Enregistrement…":"Enregistrer sur le PC"}</button></div></div>

      <div className="text-xs text-muted-foreground flex gap-2"><Info className="w-4 h-4 shrink-0"/>Les profils et options présentés sont basés sur les directives Marlin connues. Une option absente du firmware chargé n'est jamais créée artificiellement par ce Studio.</div>
    </div>
  </div>;
}
