import React, { useEffect, useMemo, useRef, useState } from "react";
import { agentApi } from "@/lib/localAgent";
import { useProject } from "@/lib/projectStore";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon, Upload, Download, Save, Wand2, Monitor, Palette, RefreshCw,
  CheckCircle2, AlertTriangle, FileCode2, Layers3, Settings2, ShieldCheck,
  Play, Trash2, RotateCcw, Eye, Info, PackageCheck, Crop, FlipHorizontal, FlipVertical, Grid3X3
} from "lucide-react";

const PROFILES = [
  { id: "dogm128", name: "Marlin LCD graphique", desc: "128×64 monochrome / DOGM / U8glib", width: 128, height: 64, format: "marlin-mono", file: "_Bootscreen.h" },
  { id: "mono_custom", name: "Monochrome personnalisé", desc: "Résolution libre, bitmap 1 bit", width: 128, height: 64, format: "marlin-mono", file: "_Bootscreen.h" },
  { id: "character", name: "LCD caractère HD44780", desc: "16×2 ou 20×4 + jusqu'à 8 caractères personnalisés", width: 20, height: 4, format: "character", file: "_Bootscreen.h" },
  { id: "tft480x272", name: "TFT 480×272", desc: "Profil générique RGB565 — vérifier le pilote", width: 480, height: 272, format: "rgb565", file: "_Bootscreen_RGB565.h" },
  { id: "tft480x320", name: "TFT 480×320", desc: "Profil générique RGB565 — vérifier le pilote", width: 480, height: 320, format: "rgb565", file: "_Bootscreen_RGB565.h" },
  { id: "tft800x480", name: "TFT 800×480", desc: "Profil générique RGB565 — vérifier le pilote", width: 800, height: 480, format: "rgb565", file: "_Bootscreen_RGB565.h" },
  { id: "dgus480x272", name: "DGUS / MKS 480×272", desc: "RGB565 export + métadonnées ; protocole DGUS non généré automatiquement", width: 480, height: 272, format: "rgb565", file: "_Bootscreen_DGUS_RGB565.h" },
  { id: "custom", name: "Écran personnalisé", desc: "Résolution et format libres", width: 320, height: 240, format: "rgb565", file: "_Bootscreen_Custom.h" },
];

const STATUS_PROFILES = [
  { id: "status128", name: "Status logo 128×64", width: 128, height: 64 },
  { id: "status_custom", name: "Status personnalisé", width: 128, height: 64 },
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

function detectProfile(files = {}, project = {}) {
  const text = Object.values(files || {}).filter(Boolean).join("\n");
  const board = `${project?.board || ""} ${text}`.toUpperCase();
  if (/DGUS/.test(board)) return "dgus480x272";
  if (/MKS_ROBIN_TFT43|TFT_RES_480X272|MKS_TS35|MKS_ROBIN_TFT35|TFT/.test(board)) return "tft480x272";
  if (/REPRAP_DISCOUNT_FULL_GRAPHIC_SMART_CONTROLLER|GRAPHICAL|U8GLIB|DOGM|MINI_12864|12864/.test(board)) return "dogm128";
  if (/CHARACTER_LCD|REPRAP_DISCOUNT_SMART_CONTROLLER|HD44780/.test(board)) return "character";
  return "dogm128";
}

function detectConfigTarget(files = {}) {
  const keys = Object.keys(files || {});
  if (keys.some(k => /(^|\/)Config\.h$/i.test(k))) return "Config.h";
  if (keys.some(k => /(^|\/)Configuration\.h$/i.test(k))) return "Configuration.h";
  return "Configuration.h";
}

function hasDefine(text, name) {
  return new RegExp(`^\\s*#\\s*define\\s+${name}\\b`, "m").test(text || "");
}
function hasUndef(text, name) {
  return new RegExp(`^\\s*#\\s*undef\\s+${name}\\b`, "m").test(text || "");
}
function enableDefine(text, name, value = null) {
  const line = value == null ? `#define ${name}` : `#define ${name} ${value}`;
  const define = new RegExp(`^\\s*#\\s*define\\s+${name}\\b.*$`, "m");
  const commented = new RegExp(`^\\s*//\\s*#\\s*define\\s+${name}\\b.*$`, "m");
  if (define.test(text)) return text.replace(define, line);
  if (commented.test(text)) return text.replace(commented, line);
  return `${text.replace(/\s*$/, "")}\n\n${line}\n`;
}
function disableDefine(text, name) {
  const define = new RegExp(`^\\s*#\\s*define\\s+${name}\\b(.*)$`, "m");
  if (!define.test(text)) return text;
  return text.replace(define, `// #define ${name}$1`);
}
function upsertDefine(text, name, value) { return enableDefine(text, name, value); }

function canvasToMono(canvas, width, height, threshold, invert, dither) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, width, height);
  const bits = new Uint8Array(width * height);
  const matrix = [[0, 2], [3, 1]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const lum = 0.299 * src.data[i * 4] + 0.587 * src.data[i * 4 + 1] + 0.114 * src.data[i * 4 + 2];
    // Marlin's bitmap converter treats dark pixels as ON and light pixels as transparent.
    const t = dither ? threshold + (matrix[y % 2][x % 2] - 1.5) * 24 : threshold;
    let on = lum < t;
    if (invert) on = !on;
    bits[i] = on ? 1 : 0;
  }
  return bits;
}

function monoHeader(bits, width, height, opts, kind = "bootscreen") {
  const bytes = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) if (x + k < width && bits[y * width + x + k]) b |= (1 << (7 - k));
      bytes.push(b);
    }
  }
  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) rows.push("  " + bytes.slice(i, i + 16).map(b => `B${b.toString(2).padStart(8, "0")}`).join(", ") + ",");
  if (kind === "status") {
    return `#pragma once\n\n/** Generated by Marlin Flow Studio — Status Screen Logo. */\n#define STATUS_LOGO_WIDTH ${width}\n#define STATUS_LOGO_HEIGHT ${height}\n#define STATUS_LOGO_X ${opts.x}\n#define STATUS_LOGO_Y ${opts.y}\nconst unsigned char status_logo_bmp[] PROGMEM = {\n${rows.join("\n")}\n};\n`;
  }
  return `#pragma once\n\n/** Generated by Marlin Flow Studio Bootscreen Studio. */\n#define CUSTOM_BOOTSCREEN_TIMEOUT ${opts.timeout}\n#define CUSTOM_BOOTSCREEN_BMPWIDTH ${width}\n#define CUSTOM_BOOTSCREEN_BMPHEIGHT ${height}\n${opts.x != null ? `#define CUSTOM_BOOTSCREEN_X ${opts.x}\n` : ""}${opts.y != null ? `#define CUSTOM_BOOTSCREEN_Y ${opts.y}\n` : ""}${opts.invert ? "#define CUSTOM_BOOTSCREEN_INVERTED\n" : ""}\nconst unsigned char custom_start_bmp[] PROGMEM = {\n${rows.join("\n")}\n};\n`;
}

function imageDraw(ctx, img, width, height, opts = {}) {
  const {
    fit = "contain", offsetX = 50, offsetY = 50, rotation = 0,
    flipX = false, flipY = false, brightness = 0, contrast = 0,
    grayscale = true
  } = opts;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  const angle = ((rotation % 360) + 360) % 360;
  const quarter = angle === 90 || angle === 270;
  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;
  const rotatedW = quarter ? sourceH : sourceW;
  const rotatedH = quarter ? sourceW : sourceH;
  let scaleX = width / rotatedW, scaleY = height / rotatedH;
  if (fit === "contain") { const s = Math.min(scaleX, scaleY); scaleX = scaleY = s; }
  else if (fit === "cover") { const s = Math.max(scaleX, scaleY); scaleX = scaleY = s; }

  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle * Math.PI / 180);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.filter = `${grayscale ? "grayscale(1) " : ""}brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
  const dw = rotatedW * scaleX;
  const dh = rotatedH * scaleY;
  const cropX = ((offsetX - 50) / 100) * Math.max(0, dw - width);
  const cropY = ((offsetY - 50) / 100) * Math.max(0, dh - height);
  ctx.drawImage(img, -dw / 2 - cropX, -dh / 2 - cropY, dw, dh);
  ctx.restore();
}

function binaryBytes(bits, width, height) {
  const bytes = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) if (x + k < width && bits[y * width + x + k]) b |= (1 << (7 - k));
    bytes.push(b);
  }
  return bytes;
}

function fileExists(files, re) { return Object.keys(files || {}).some(k => re.test(k)); }

export default function BootscreenStudio() {
  const { currentProject } = useProject();
  const [module, setModule] = useState("bootscreen");
  const [profileId, setProfileId] = useState("dogm128");
  const profile = useMemo(() => PROFILES.find(p => p.id === profileId) || PROFILES[0], [profileId]);
  const [width, setWidth] = useState(profile.width);
  const [height, setHeight] = useState(profile.height);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [dither, setDither] = useState(true);
  const [timeout, setTimeoutMs] = useState(2500);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [text, setText] = useState("MARLIN FLOW STUDIO\nREADY");
  const [chars, setChars] = useState(8);
  const [fileName, setFileName] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [configTarget, setConfigTarget] = useState("auto");
  const [showBoot, setShowBoot] = useState(true);
  const [enableStatus, setEnableStatus] = useState(false);
  const [statusWidth, setStatusWidth] = useState(128);
  const [statusHeight, setStatusHeight] = useState(64);
  const [statusX, setStatusX] = useState(0);
  const [statusY, setStatusY] = useState(0);
  const [animation, setAnimation] = useState(false);
  const [frameTime, setFrameTime] = useState(500);
  const [integrationLog, setIntegrationLog] = useState([]);
  const [detected, setDetected] = useState(null);
  // Image conversion pipeline — shared by Bootscreen, Status and Converter modules.
  const [fitMode, setFitMode] = useState("contain");
  const [offsetX, setOffsetX] = useState(50);
  const [offsetY, setOffsetY] = useState(50);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [grayscale, setGrayscale] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  const files = currentProject?.files || {};
  const configAuto = useMemo(() => detectConfigTarget(files), [files]);
  const configFile = configTarget === "auto" ? configAuto : configTarget;
  const hasConfigIni = fileExists(files, /(^|\/)config\.ini$/i);
  const hasConfigH = fileExists(files, /(^|\/)Config\.h$/i);
  const hasConfigurationH = fileExists(files, /(^|\/)Configuration\.h$/i);
  const hasConfigurationAdv = fileExists(files, /(^|\/)Configuration_adv\.h$/i);
  const hasBootFile = fileExists(files, /(^|\/)\_Bootscreen\.h$/i);
  const hasStatusFile = fileExists(files, /(^|\/)\_Statusscreen\.h$/i);

  useEffect(() => {
    const d = detectProfile(files, currentProject);
    setDetected({ profile: d, config: configAuto, configIni: hasConfigIni });
    setProfileId(d);
  }, [currentProject?.id]);

  useEffect(() => { setWidth(profile.width); setHeight(profile.height); }, [profileId]);

  function renderPreview(targetWidth = width, targetHeight = height, forceMono = profile.format === "marlin-mono") {
    if (!imageSrc || !canvasRef.current || !imageRef.current?.naturalWidth) return;
    const img = imageRef.current, c = canvasRef.current, ctx = c.getContext("2d", { willReadFrequently: true });
    c.width = targetWidth; c.height = targetHeight;
    const useGray = forceMono || module === "status" || module === "converter" ? grayscale : false;
    imageDraw(ctx, img, targetWidth, targetHeight, { fit: fitMode, offsetX, offsetY, rotation, flipX, flipY, brightness, contrast, grayscale: useGray });
    if (forceMono) {
      const bits = canvasToMono(c, targetWidth, targetHeight, threshold, invert, dither);
      const out = ctx.createImageData(targetWidth, targetHeight);
      for (let i = 0; i < bits.length; i++) { const v = bits[i] ? 0 : 255; out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255; }
      ctx.putImageData(out, 0, 0);
    }
  }
  useEffect(() => { if (module === "bootscreen" || module === "converter") renderPreview(width, height, profile.format === "marlin-mono" || module === "converter"); }, [imageSrc, width, height, threshold, invert, dither, profile.format, module, fitMode, offsetX, offsetY, rotation, flipX, flipY, brightness, contrast, grayscale]);
  useEffect(() => { if (module === "status") renderPreview(statusWidth, statusHeight, true); }, [imageSrc, statusWidth, statusHeight, threshold, invert, dither, module, fitMode, offsetX, offsetY, rotation, flipX, flipY, brightness, contrast, grayscale]);

  function onImage(file) {
    if (!file) return;
    const reader = new FileReader(); reader.onload = () => setImageSrc(String(reader.result)); reader.readAsDataURL(file);
    setFileName(file.name); setStatus(`Image chargée : ${file.name}`);
  }

  function generateBootscreen() {
    if (profile.format === "character") return characterHeader(text, chars);
    if (!canvasRef.current || !imageSrc) throw new Error("Importe une image avant de générer le bootscreen.");
    renderPreview(width, height, profile.format === "marlin-mono");
    if (profile.format === "marlin-mono") {
      const bits = canvasToMono(canvasRef.current, width, height, threshold, invert, dither);
      return monoHeader(bits, width, height, { timeout, invert, x: posX, y: posY });
    }
    return rgb565Header(canvasRef.current, width, height, { invert });
  }

  function generateStatus() {
    if (!canvasRef.current || !imageSrc) throw new Error("Importe une image avant de générer le logo de status.");
    renderPreview(statusWidth, statusHeight, true);
    const bits = canvasToMono(canvasRef.current, statusWidth, statusHeight, threshold, invert, dither);
    return monoHeader(bits, statusWidth, statusHeight, { x: statusX, y: statusY }, "status");
  }

  function generateBinary() {
    if (!canvasRef.current || !imageSrc) throw new Error("Importe une image avant de générer le bitmap.");
    renderPreview(width, height, true);
    return new Uint8Array(binaryBytes(canvasToMono(canvasRef.current, width, height, threshold, invert, dither), width, height));
  }

  function downloadBinary() {
    const bytes = generateBinary();
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bootscreen.bin"; a.click(); URL.revokeObjectURL(a.href);
    setStatus(`✓ Bitmap binaire exporté (${bytes.length} octets).`);
  }

  function downloadPreviewPng() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bootscreen-preview.png"; a.click(); URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  function autoOptimize() {
    setFitMode("contain"); setOffsetX(50); setOffsetY(50); setRotation(0); setFlipX(false); setFlipY(false);
    setBrightness(0); setContrast(18); setGrayscale(true); setThreshold(128); setDither(true);
    setStatus("✓ Réglages optimisés pour un écran monochrome Marlin.");
  }

  function downloadText(name, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  async function readCfg(name) { return agentApi.readConfiguration(name); }

  async function integrate() {
    if (!currentProject?.localProjectPath) { setStatus("⚠ Aucun projet local ouvert."); return; }
    setBusy(true); setIntegrationLog([]);
    const log = [];
    try {
      if (module === "status") {
        if (!enableStatus) { log.push("Logo status généré mais non activé dans la configuration."); }
        const content = generateStatus();
        await agentApi.writeFile("_Statusscreen.h", content, undefined, true);
        log.push("✓ _Statusscreen.h sauvegardé (backup automatique).");
        if (enableStatus) {
          const cfg = await readCfg(configFile);
          let c = cfg.content || "";
          c = enableDefine(c, "CUSTOM_STATUS_SCREEN_IMAGE");
          await agentApi.writeConfiguration(configFile, c, cfg.sha256);
          log.push(`✓ CUSTOM_STATUS_SCREEN_IMAGE activé dans ${configFile}.`);
        }
      } else {
        const content = generateBootscreen();
        const target = profile.format === "marlin-mono" || profile.format === "character" ? "_Bootscreen.h" : profile.file;
        await agentApi.writeFile(target, content, undefined, true);
        log.push(`✓ ${target} sauvegardé (backup automatique).`);
        if (showBoot && (profile.format === "marlin-mono" || profile.format === "character")) {
          const cfg = await readCfg(configFile);
          let c = cfg.content || "";
          c = enableDefine(c, "SHOW_CUSTOM_BOOTSCREEN");
          c = upsertDefine(c, "CUSTOM_BOOTSCREEN_TIMEOUT", timeout);
          if (animation) {
            c = enableDefine(c, "CUSTOM_BOOTSCREEN_ANIMATED");
            c = upsertDefine(c, "CUSTOM_BOOTSCREEN_FRAME_TIME", frameTime);
          } else {
            c = disableDefine(c, "CUSTOM_BOOTSCREEN_ANIMATED");
            c = disableDefine(c, "CUSTOM_BOOTSCREEN_FRAME_TIME");
          }
          await agentApi.writeConfiguration(configFile, c, cfg.sha256);
          log.push(`✓ SHOW_CUSTOM_BOOTSCREEN + timeout configurés dans ${configFile}.`);
        }
      }
      setIntegrationLog(log); setStatus("✓ Intégration terminée sans remplacer la configuration existante.");
      window.dispatchEvent(new Event("marlin-project-changed"));
    } catch (e) {
      log.push(`⚠ ${e.message}`); setIntegrationLog(log); setStatus(`⚠ Intégration interrompue : ${e.message}`);
    } finally { setBusy(false); }
  }

  async function installBoth() {
    if (!currentProject?.localProjectPath) { setStatus("⚠ Aucun projet local ouvert."); return; }
    setBusy(true); setIntegrationLog([]);
    const log = [];
    try {
      const cfg = await readCfg(configFile); let c = cfg.content || "";
      if (showBoot) c = enableDefine(c, "SHOW_CUSTOM_BOOTSCREEN");
      if (showBoot) c = upsertDefine(c, "CUSTOM_BOOTSCREEN_TIMEOUT", timeout);
      if (enableStatus) c = enableDefine(c, "CUSTOM_STATUS_SCREEN_IMAGE");
      await agentApi.writeConfiguration(configFile, c, cfg.sha256); log.push(`✓ Configuration préparée : ${configFile}.`);
      if (showBoot && imageSrc) { await agentApi.writeFile("_Bootscreen.h", generateBootscreen(), undefined, true); log.push("✓ _Bootscreen.h installé."); }
      if (enableStatus && imageSrc) { await agentApi.writeFile("_Statusscreen.h", generateStatus(), undefined, true); log.push("✓ _Statusscreen.h installé."); }
      log.push("✓ Modules sélectionnés intégrés. Lance maintenant Marlin Doctor ou Build.");
      setIntegrationLog(log); setStatus("✓ Pack d'intégration installé."); window.dispatchEvent(new Event("marlin-project-changed"));
    } catch (e) { log.push(`⚠ ${e.message}`); setIntegrationLog(log); setStatus(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  }

  const steps = [
    { ok: !!currentProject?.localProjectPath, label: "Projet Marlin local ouvert" },
    { ok: !!detected, label: "Écran / carte analysé" },
    { ok: imageSrc || module === "bootscreen" && profile.format === "character", label: "Source prête" },
    { ok: configFile, label: `Configuration cible : ${configFile}` },
    { ok: showBoot || enableStatus, label: "Au moins un module sélectionné" },
  ];

  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-background">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" /> Bootscreen Studio</h1>
            <p className="text-sm text-muted-foreground">Création, validation et intégration guidée des écrans Marlin.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-md border bg-card text-sm flex items-center gap-2" onClick={() => { try { const c = module === "status" ? generateStatus() : generateBootscreen(); downloadText(module === "status" ? "_Statusscreen.h" : (profile.file || "_Bootscreen.h"), c); setStatus("✓ Fichier exporté."); } catch (e) { setStatus(`⚠ ${e.message}`); } }}><Download className="w-4 h-4" /> Exporter</button>
            <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-2 disabled:opacity-50" disabled={busy} onClick={integrate}><Save className="w-4 h-4" /> {busy ? "Intégration…" : "Intégrer"}</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-2">
          {[['bootscreen','Bootscreen',ImageIcon],['converter','Convertisseur image',Crop],['status','Status logo',Layers3],['integration','Assistant intégration',Wand2]].map(([id,label,Icon]) => (
            <button key={id} onClick={() => setModule(id)} className={cn("px-3 py-2 rounded-md text-sm flex items-center gap-2", module === id ? "bg-primary text-primary-foreground" : "border bg-card")}><Icon className="w-4 h-4" />{label}</button>
          ))}
        </div>

        {currentProject && <div className="rounded-lg border bg-card px-4 py-3 text-sm flex flex-wrap gap-4"><span><b>Projet :</b> {currentProject.name}</span><span><b>Carte :</b> {currentProject.board || "non détectée"}</span><span><b>Configuration :</b> {configFile}</span><span><b>Boot :</b> {hasBootFile ? "présent" : "à créer"}</span><span><b>Status :</b> {hasStatusFile ? "présent" : "à créer"}</span></div>}

        {module === "converter" && (
          <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_320px] gap-4">
            <section className="border rounded-xl bg-card p-4 space-y-4">
              <h2 className="font-semibold flex items-center gap-2"><Crop className="w-4 h-4" /> Convertisseur image → écran</h2>
              <label className="cursor-pointer w-full px-3 py-2 border rounded-md text-sm flex gap-2 items-center justify-center"><Upload className="w-4 h-4" /> Importer PNG / JPG / SVG / WebP<input type="file" accept="image/png,image/jpeg,image/bmp,image/webp,image/svg+xml" className="hidden" onChange={e=>onImage(e.target.files?.[0])} /></label>
              <div className="grid grid-cols-2 gap-2"><label className="text-sm">Largeur<input type="number" min="1" max="1600" value={width} onChange={e=>setWidth(clamp(Number(e.target.value)||1,1,1600))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label><label className="text-sm">Hauteur<input type="number" min="1" max="1200" value={height} onChange={e=>setHeight(clamp(Number(e.target.value)||1,1,1200))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label></div>
              <label className="text-sm block">Adaptation<select value={fitMode} onChange={e=>setFitMode(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 bg-background"><option value="contain">Conserver proportions — centrer</option><option value="cover">Remplir — recadrer</option><option value="stretch">Étendre à l'écran</option></select></label>
              <div className="grid grid-cols-2 gap-2"><label className="text-sm">Recadrage X<input type="range" min="0" max="100" value={offsetX} onChange={e=>setOffsetX(Number(e.target.value))} className="w-full" /></label><label className="text-sm">Recadrage Y<input type="range" min="0" max="100" value={offsetY} onChange={e=>setOffsetY(Number(e.target.value))} className="w-full" /></label></div>
              <div className="grid grid-cols-2 gap-2"><label className="text-sm">Rotation<select value={rotation} onChange={e=>setRotation(Number(e.target.value))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><div className="flex items-end gap-2"><button onClick={()=>setFlipX(v=>!v)} className={cn("flex-1 px-2 py-2 border rounded text-xs", flipX && "bg-primary text-primary-foreground")}><FlipHorizontal className="w-4 h-4 mx-auto" /></button><button onClick={()=>setFlipY(v=>!v)} className={cn("flex-1 px-2 py-2 border rounded text-xs", flipY && "bg-primary text-primary-foreground")}><FlipVertical className="w-4 h-4 mx-auto" /></button></div></div>
              <label className="text-sm block">Luminosité <span className="text-muted-foreground">{brightness}</span><input type="range" min="-100" max="100" value={brightness} onChange={e=>setBrightness(Number(e.target.value))} className="w-full" /></label>
              <label className="text-sm block">Contraste <span className="text-muted-foreground">{contrast}</span><input type="range" min="-100" max="100" value={contrast} onChange={e=>setContrast(Number(e.target.value))} className="w-full" /></label>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={grayscale} onChange={e=>setGrayscale(e.target.checked)} /> Niveaux de gris</label>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={dither} onChange={e=>setDither(e.target.checked)} /> Dithering 2×2</label>
              <label className="text-sm">Seuil <span className="text-muted-foreground">{threshold}</span><input type="range" min="0" max="255" value={threshold} onChange={e=>setThreshold(Number(e.target.value))} className="w-full" /></label>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={invert} onChange={e=>setInvert(e.target.checked)} /> Inverser</label>
              <button onClick={autoOptimize} className="w-full px-3 py-2 rounded-md border text-sm flex items-center justify-center gap-2"><Wand2 className="w-4 h-4" /> Optimiser automatiquement</button>
            </section>
            <section className="border rounded-xl bg-card p-4 space-y-4 min-w-0">
              <div className="flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><Eye className="w-4 h-4" /> Aperçu pixel réel</h2><span className="text-xs text-muted-foreground">{width}×{height} · 1 bit</span></div>
              <div className="rounded-lg bg-slate-950 min-h-[480px] flex items-center justify-center overflow-auto p-6"><canvas ref={canvasRef} style={{ imageRendering:"pixelated", maxWidth:"100%", maxHeight:"65vh", aspectRatio:`${width}/${height}`, backgroundImage:showGrid?"linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)":"none", backgroundSize:showGrid?"8px 8px":"auto", backgroundPosition:showGrid?"0 0,0 4px,4px -4px,-4px 0":"0 0" }} className="bg-white shadow-2xl" /><img ref={imageRef} src={imageSrc || undefined} alt="" className="hidden" onLoad={()=>{renderPreview(width,height,true);setStatus(`✓ Image adaptée en ${width}×${height}.`)}} /></div>
              <div className="flex flex-wrap gap-2"><button onClick={()=>setShowGrid(v=>!v)} className={cn("px-3 py-2 border rounded-md text-sm flex items-center gap-2",showGrid&&"bg-primary text-primary-foreground")}><Grid3X3 className="w-4 h-4" /> Grille</button><button onClick={downloadPreviewPng} className="px-3 py-2 border rounded-md text-sm flex items-center gap-2"><Download className="w-4 h-4" /> PNG aperçu</button><button onClick={downloadBinary} className="px-3 py-2 border rounded-md text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Bitmap .bin</button></div>
            </section>
            <section className="border rounded-xl bg-card p-4 space-y-4"><h2 className="font-semibold flex items-center gap-2"><FileCode2 className="w-4 h-4" /> Sortie Marlin</h2><div className="rounded-lg border p-3 text-sm space-y-2"><div className="flex justify-between"><span>Résolution</span><b>{width}×{height}</b></div><div className="flex justify-between"><span>Bytes bitmap</span><b>{Math.ceil(width / 8) * height}</b></div><div className="flex justify-between"><span>Format</span><b>1 bit / Bxxxxxxxx</b></div><div className="flex justify-between"><span>Source</span><b className="truncate max-w-[150px]">{fileName || "—"}</b></div></div><button onClick={()=>{try{downloadText("_Bootscreen.h",generateBootscreen());setStatus("✓ _Bootscreen.h généré avec les réglages actuels.")}catch(e){setStatus(`⚠ ${e.message}`)}}} className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm"><Download className="w-4 h-4 inline mr-2" /> Générer _Bootscreen.h</button><p className="text-xs text-muted-foreground">Le convertisseur suit la logique du convertisseur bitmap Marlin : les pixels sombres deviennent actifs. Le mode compact/RLE n'est pas inventé : il reste disponible via le convertisseur officiel Marlin.</p></section>
          </div>
        )}

        {module === "integration" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="border rounded-xl bg-card p-4 space-y-4 lg:col-span-2">
              <h2 className="font-semibold flex items-center gap-2"><Wand2 className="w-4 h-4" /> Assistant d'intégration</h2>
              <p className="text-sm text-muted-foreground">Le studio analyse le projet avant d'écrire. Les fichiers générés passent par l'Agent local avec sauvegarde, et la configuration n'est jamais remplacée en bloc.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {steps.map((s, i) => <div key={i} className="rounded-lg border p-3 flex gap-3 items-start"><span className={cn("mt-0.5", s.ok ? "text-emerald-600" : "text-amber-600")}>{s.ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}</span><div><b className="text-sm">{s.label}</b><p className="text-xs text-muted-foreground">{s.ok ? "Prêt" : "À compléter"}</p></div></div>)}
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium flex items-center gap-2"><Settings2 className="w-4 h-4" /> Cible de configuration</h3>
                <select value={configTarget} onChange={e=>setConfigTarget(e.target.value)} className="w-full border rounded-md px-3 py-2 bg-background text-sm"><option value="auto">Automatique — {configAuto}</option><option value="Config.h">Config.h</option><option value="Configuration.h">Configuration.h</option></select>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Config.h : {hasConfigH ? "✓" : "—"}</span><span>Configuration.h : {hasConfigurationH ? "✓" : "—"}</span><span>Configuration_adv.h : {hasConfigurationAdv ? "✓" : "—"}</span><span>config.ini : {hasConfigIni ? "✓" : "—"}</span></div>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium flex items-center gap-2"><PackageCheck className="w-4 h-4" /> Modules à installer</h3>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showBoot} onChange={e=>setShowBoot(e.target.checked)} /> Bootscreen {_BootscreenH()}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enableStatus} onChange={e=>setEnableStatus(e.target.checked)} /> Logo de status {_StatusscreenH()}</label>
                <button disabled={busy || !currentProject?.localProjectPath} onClick={installBoth} className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">Installer les modules sélectionnés</button>
              </div>
            </section>
            <section className="border rounded-xl bg-card p-4 space-y-4">
              <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Sécurité d'intégration</h2>
              <ul className="text-sm space-y-3 text-muted-foreground">
                <li>✓ écriture via l'Agent local</li><li>✓ backup activé pour les fichiers générés</li><li>✓ SHA de configuration utilisé lors de l'écriture</li><li>✓ modification ciblée des `#define`</li><li>✓ pas de remplacement de Configuration.h complet</li>
              </ul>
              <div className="rounded-lg bg-muted/50 p-3 text-xs"><b>Important</b><br />Les profils TFT/DGUS génèrent des données RGB565. Le protocole et le pilote propres à l'écran doivent être validés avant compilation.</div>
            </section>
          </div>
        )}

        {module === "bootscreen" && (
          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_320px] gap-4">
            <section className="border rounded-xl bg-card p-4 space-y-4">
              <h2 className="font-semibold flex items-center gap-2"><Monitor className="w-4 h-4" /> Écran</h2>
              <label className="text-sm block">Profil<select value={profileId} onChange={e=>setProfileId(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2">{PROFILES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <p className="text-xs text-muted-foreground">{profile.desc}</p>
              <div className="grid grid-cols-2 gap-2"><label className="text-sm">Largeur<input type="number" min="1" max="1600" value={width} onChange={e=>setWidth(clamp(Number(e.target.value)||1,1,1600))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label><label className="text-sm">Hauteur<input type="number" min="1" max="1200" value={height} onChange={e=>setHeight(clamp(Number(e.target.value)||1,1,1200))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label></div>
              <div className="border-t pt-3 space-y-3">
                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={invert} onChange={e=>setInvert(e.target.checked)} /> Inverser</label>
                {profile.format === "marlin-mono" && <><label className="text-sm flex items-center gap-2"><input type="checkbox" checked={dither} onChange={e=>setDither(e.target.checked)} /> Dithering 2×2</label><label className="text-sm">Seuil<input type="range" min="0" max="255" value={threshold} onChange={e=>setThreshold(Number(e.target.value))} className="w-full" /></label><label className="text-sm">Timeout<input type="number" min="100" max="60000" value={timeout} onChange={e=>setTimeoutMs(clamp(Number(e.target.value)||2500,100,60000))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /> ms</label></>}
              </div>
              <div className="border-t pt-3 space-y-3"><h3 className="text-sm font-medium flex items-center gap-2"><Crop className="w-4 h-4" /> Adaptation image</h3><label className="text-sm">Mode<select value={fitMode} onChange={e=>setFitMode(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 bg-background"><option value="contain">Conserver proportions</option><option value="cover">Remplir / recadrer</option><option value="stretch">Étirer</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm">X<input type="range" min="0" max="100" value={offsetX} onChange={e=>setOffsetX(Number(e.target.value))} className="w-full" /></label><label className="text-sm">Y<input type="range" min="0" max="100" value={offsetY} onChange={e=>setOffsetY(Number(e.target.value))} className="w-full" /></label></div><div className="grid grid-cols-2 gap-2"><button onClick={()=>setRotation(r=>(r+90)%360)} className="px-2 py-2 border rounded text-xs"><RotateCcw className="w-4 h-4 inline mr-1" /> Rotation</button><button onClick={autoOptimize} className="px-2 py-2 border rounded text-xs"><Wand2 className="w-4 h-4 inline mr-1" /> Auto</button></div></div><div className="border-t pt-3 space-y-2"><label className="text-sm flex items-center gap-2"><input type="checkbox" checked={animation} onChange={e=>setAnimation(e.target.checked)} /> Préparer animation</label>{animation && <label className="text-sm">Temps par frame<input type="number" min="50" max="10000" value={frameTime} onChange={e=>setFrameTime(clamp(Number(e.target.value)||500,50,10000))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /> ms</label>}</div>
            </section>
            <section className="border rounded-xl bg-card p-4 space-y-4 min-w-0">
              <div className="flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Création</h2><label className="cursor-pointer px-3 py-2 border rounded-md text-sm flex gap-2 items-center"><Upload className="w-4 h-4" /> Importer image<input type="file" accept="image/png,image/jpeg,image/bmp,image/webp,image/svg+xml" className="hidden" onChange={e=>onImage(e.target.files?.[0])} /></label></div>
              {profile.format === "character" ? <textarea value={text} onChange={e=>setText(e.target.value)} rows={6} className="w-full border rounded-lg bg-background p-3 font-mono" placeholder="Jusqu'à 4 lignes, 20 caractères par ligne" /> : <div className="rounded-lg bg-slate-950 min-h-[360px] flex items-center justify-center overflow-auto p-5"><canvas ref={canvasRef} style={{ imageRendering:"pixelated", maxWidth:"100%", maxHeight:"55vh", aspectRatio:`${width}/${height}` }} className="bg-white shadow-2xl" /><img ref={imageRef} src={imageSrc || undefined} alt="" className="hidden" onLoad={()=>{renderPreview(width,height);setStatus(`✓ Aperçu ${width}×${height} prêt.`)}} /></div>}
              <div className="text-xs text-muted-foreground flex items-center gap-2"><FileCode2 className="w-3.5 h-3.5" /> Sortie : <code>{profile.format === "marlin-mono" || profile.format === "character" ? "_Bootscreen.h" : profile.file}</code>{fileName && <span>· source : {fileName}</span>}</div>
            </section>
            <section className="border rounded-xl bg-card p-4 space-y-4"><h2 className="font-semibold flex items-center gap-2"><Wand2 className="w-4 h-4" /> Intégration</h2><div className="rounded-lg border p-3 text-sm space-y-2"><div className="flex justify-between"><span>Profil</span><b>{profile.name}</b></div><div className="flex justify-between"><span>Résolution</span><b>{width}×{height}</b></div><div className="flex justify-between"><span>Format</span><b>{profile.format === "marlin-mono" ? "1 bit" : profile.format === "character" ? "HD44780" : "RGB565"}</b></div><div className="flex justify-between"><span>Config</span><b>{configFile}</b></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showBoot} onChange={e=>setShowBoot(e.target.checked)} /> Activer SHOW_CUSTOM_BOOTSCREEN</label><button onClick={()=>{const detectedProfile=detectProfile(files,currentProject);setProfileId(detectedProfile);setStatus(`✓ Profil détecté : ${PROFILES.find(p=>p.id===detectedProfile)?.name}`)}} className="w-full px-3 py-2 border rounded-md text-sm flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Détecter l'écran</button><div className="rounded-lg bg-muted/50 p-3 text-xs">Marlin inclut <code>_Bootscreen.h</code> lorsque <code>SHOW_CUSTOM_BOOTSCREEN</code> est activé. Les options timeout / X / Y sont générées pour les profils monochromes.</div></section>
          </div>
        )}

        {module === "status" && (
          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_320px] gap-4">
            <section className="border rounded-xl bg-card p-4 space-y-4"><h2 className="font-semibold flex items-center gap-2"><Layers3 className="w-4 h-4" /> Logo de status</h2><p className="text-xs text-muted-foreground">Marlin utilise <code>_Statusscreen.h</code> pour le logo de l'écran de status sur les LCD graphiques compatibles.</p><div className="grid grid-cols-2 gap-2"><label className="text-sm">Largeur<input type="number" value={statusWidth} onChange={e=>setStatusWidth(clamp(Number(e.target.value)||128,1,512))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label><label className="text-sm">Hauteur<input type="number" value={statusHeight} onChange={e=>setStatusHeight(clamp(Number(e.target.value)||64,1,256))} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label></div><div className="grid grid-cols-2 gap-2"><label className="text-sm">X<input type="number" value={statusX} onChange={e=>setStatusX(Number(e.target.value)||0)} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label><label className="text-sm">Y<input type="number" value={statusY} onChange={e=>setStatusY(Number(e.target.value)||0)} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enableStatus} onChange={e=>setEnableStatus(e.target.checked)} /> Activer CUSTOM_STATUS_SCREEN_IMAGE</label></section>
            <section className="border rounded-xl bg-card p-4 space-y-4"><div className="flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><Eye className="w-4 h-4" /> Source et aperçu</h2><label className="cursor-pointer px-3 py-2 border rounded-md text-sm flex gap-2 items-center"><Upload className="w-4 h-4" /> Image<input type="file" accept="image/png,image/jpeg,image/bmp,image/webp,image/svg+xml" className="hidden" onChange={e=>onImage(e.target.files?.[0])} /></label></div><div className="rounded-lg bg-slate-950 min-h-[360px] flex items-center justify-center overflow-auto p-5"><canvas ref={canvasRef} style={{imageRendering:"pixelated",maxWidth:"100%",maxHeight:"55vh",aspectRatio:`${statusWidth}/${statusHeight}`}} className="bg-white shadow-2xl" /><img ref={imageRef} src={imageSrc || undefined} alt="" className="hidden" onLoad={()=>renderPreview(statusWidth,statusHeight,true)} /></div><p className="text-xs text-muted-foreground">Le générateur produit un bitmap 1 bit et ne modifie pas le layout de l'écran de status.</p></section>
            <section className="border rounded-xl bg-card p-4 space-y-4"><h2 className="font-semibold">Intégration</h2><button disabled={busy || !currentProject?.localProjectPath} onClick={integrate} className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">Installer le logo</button><button className="w-full px-3 py-2 border rounded-md text-sm" onClick={()=>{try{downloadText("_Statusscreen.h",generateStatus());setStatus("✓ _Statusscreen.h exporté.")}catch(e){setStatus(`⚠ ${e.message}`)}}}>Exporter _Statusscreen.h</button><div className="text-xs text-muted-foreground space-y-2"><p><b>Fichier :</b> _Statusscreen.h</p><p><b>Activation :</b> CUSTOM_STATUS_SCREEN_IMAGE</p><p><b>Projet :</b> {currentProject?.name || "aucun"}</p></div></section>
          </div>
        )}

        {integrationLog.length > 0 && <div className="border rounded-xl bg-card p-4"><h3 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Journal d'intégration</h3><div className="text-sm space-y-1">{integrationLog.map((x,i)=><div key={i}>{x}</div>)}</div></div>}
        {status && <div className={cn("text-sm rounded-md border p-3", status.startsWith("⚠") ? "text-amber-700 border-amber-300 bg-amber-50" : "text-emerald-700 border-emerald-300 bg-emerald-50")}>{status}</div>}
        <div className="text-xs text-muted-foreground flex items-start gap-2"><Info className="w-4 h-4 shrink-0" /> Marlin documente <code>_Bootscreen.h</code> pour les bootscreens et <code>_Statusscreen.h</code> pour les logos de status compatibles. Les profils couleur de ce studio restent des exports RGB565 génériques et ne prétendent pas implémenter tous les protocoles TFT/DGUS.</div>
      </div>
    </div>
  );
}

function _BootscreenH(){ return <code>_Bootscreen.h</code>; }
function _StatusscreenH(){ return <code>_Statusscreen.h</code>; }
