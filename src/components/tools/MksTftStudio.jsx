import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Archive, CheckCircle2, Download, FileImage, FolderInput,
  Image as ImageIcon, Info, RefreshCw, SlidersHorizontal, Upload,
} from "lucide-react";
import { createZipStore } from "@/lib/zipStore";

const SIZE_PRESETS = [
  { id: "tft32-icon", label: "MKS TFT24/28/32 · icône documentée", width: 78, height: 104 },
  { id: "tft35-icon", label: "MKS TFT35 · icône documentée", width: 117, height: 140 },
  { id: "tft32-screen", label: "TFT24/28/32 · plein écran", width: 320, height: 240 },
  { id: "tft35-screen", label: "TFT35 · plein écran", width: 480, height: 320 },
  { id: "custom", label: "Dimensions personnalisées", width: 160, height: 120 },
];

const ROBIN_SIZE_PRESETS = [
  { id: "robin-logo", label: "Logo TFT35 · 480 × 320", width: 480, height: 320 },
  { id: "robin-icon", label: "Icône · 117 × 140", width: 117, height: 140 },
  { id: "robin-file", label: "Vignette · 117 × 92", width: 117, height: 92 },
  { id: "robin-button", label: "Bouton · 120 × 100", width: 120, height: 100 },
  { id: "robin-preview", label: "Aperçu G-code · 200 × 200", width: 200, height: 200 },
  { id: "robin-state", label: "État · 45 × 45", width: 45, height: 45 },
  { id: "robin-small-button", label: "Bouton · 70 × 40", width: 70, height: 40 },
  { id: "robin-state-small", label: "État · 60 × 45", width: 60, height: 45 },
  { id: "robin-value", label: "Valeur · 70 × 28", width: 70, height: 28 },
  { id: "custom", label: "Dimensions personnalisées", width: 160, height: 120 },
];

const PROFILE_INFO = {
  tft32: { name: "Profil MKS-TOOL · TFT24 / TFT28 / TFT32", pack: "MKS-TOOL 1.0.8 · mks_pic32", license: "LICENSE-GPL-3.0.txt" },
  tft35: { name: "Profil MKS-TOOL · TFT35", pack: "MKS-TOOL 1.0.8 · mks_pic35", license: "LICENSE-GPL-3.0.txt" },
  robin35: { name: "MKS Robin Nano TFT35 · Marlin 2.0 LVGL", pack: "Firmware Robin fourni · mks_pic", license: "LICENSE-ROBIN-FIRMWARE-GPL-3.0.txt" },
};

const TEMPLATE_BASE = `${import.meta.env.BASE_URL}mks-screen-templates/`;

function inferAssetDimensions(profile, filename, bytes) {
  const name = String(filename || "").split("/").pop().toLowerCase();
  if (name === "bmp_logo.bin") return profile === "tft32" ? { width: 320, height: 240 } : { width: 480, height: 320 };
  if (profile === "robin35") {
    const byLength = {
      307200: [480, 320], 80000: [200, 200], 32765: [117, 140], 32760: [117, 140],
      24005: [120, 100], 21533: [117, 92], 5605: [70, 40], 5405: [60, 45],
      4055: [45, 45], 3925: [70, 28],
    }[bytes?.byteLength];
    return byLength ? { width: byLength[0], height: byLength[1] } : null;
  }
  const byLength = profile === "tft32"
    ? { 16224: [78, 104], 16232: [78, 104], 153600: [320, 240] }[bytes?.byteLength]
    : { 32760: [117, 140], 21528: [117, 92], 24000: [120, 100], 80000: [200, 200], 20000: [100, 100], 5000: [50, 50], 4050: [45, 45], 307200: [480, 320] }[bytes?.byteLength];
  return byLength ? { width: byLength[0], height: byLength[1] } : null;
}

function presetForDimensions(profile, dimensions) {
  if (!dimensions) return "custom";
  const presets = profile === "robin35" ? ROBIN_SIZE_PRESETS : SIZE_PRESETS;
  return presets.find((preset) => preset.width === dimensions.width && preset.height === dimensions.height)?.id || "custom";
}

async function fetchBuiltinTemplate(profile) {
  const manifestResponse = await fetch(`${TEMPLATE_BASE}manifest.json`);
  if (!manifestResponse.ok) throw new Error("Le manifeste des packs MKS est introuvable.");
  const manifest = await manifestResponse.json();
  const metadata = manifest.profiles?.[profile];
  if (!metadata) throw new Error("Aucun pack local n’est défini pour ce profil MKS.");
  const files = {};
  for (let start = 0; start < metadata.files.length; start += 16) {
    const batch = metadata.files.slice(start, start + 16);
    const loaded = await Promise.all(batch.map(async (item) => {
      const url = `${TEMPLATE_BASE}${encodeURIComponent(metadata.folder)}/${encodeURIComponent(item.name)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Asset MKS manquant : ${item.name}`);
      return [item.name, new Uint8Array(await response.arrayBuffer())];
    }));
    for (const [name, bytes] of loaded) files[name] = bytes;
  }
  const licenseResponse = await fetch(`${TEMPLATE_BASE}${encodeURIComponent(PROFILE_INFO[profile].license)}`);
  if (!licenseResponse.ok) throw new Error("Le fichier de licence du pack MKS est introuvable.");
  return { files, metadata, license: await licenseResponse.text() };
}

const TARGETS = [
  "bmp_custom1.bin", "bmp_custom2.bin", "bmp_custom3.bin", "bmp_custom4.bin",
  "bmp_custom5.bin", "bmp_custom6.bin", "bmp_custom7.bin", "bmp_logo.bin",
  "bmp_about.bin", "bmp_menu.bin",
];

function safeTarget(value) {
  const name = String(value || "").trim();
  return /^bmp_[a-z0-9_-]+\.bin$/i.test(name) ? name : "";
}

function safeTemplatePath(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) return "";
  const rootAt = parts.findIndex((part) => part.toLowerCase() === "mks_pic");
  const relative = rootAt >= 0 ? parts.slice(rootAt + 1) : parts.slice(1);
  if (!relative.length || relative.some((part) => part.includes(":") || part.startsWith("."))) return "";
  if (!/\.(bin|lg)$/i.test(relative[relative.length - 1])) return "";
  return relative.join("/");
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fileBytesToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => resolve({ url, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Cette image ne peut pas être lue par le navigateur.")); };
    image.src = url;
  });
}

function rgb565Bytes(canvas, byteOrder, channelOrder, rotate180) {
  const width = canvas.width;
  const height = canvas.height;
  const pixels = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const output = new Uint8Array(width * height * 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = rotate180 ? width - 1 - x : x;
    const sy = rotate180 ? height - 1 - y : y;
    const source = (sy * width + sx) * 4;
    let red = pixels[source];
    const green = pixels[source + 1];
    let blue = pixels[source + 2];
    if (channelOrder === "bgr") [red, blue] = [blue, red];
    const value = ((red >> 3) << 11) | ((green >> 2) << 5) | (blue >> 3);
    const target = (y * width + x) * 2;
    if (byteOrder === "big") {
      output[target] = value >> 8;
      output[target + 1] = value & 0xff;
    } else {
      output[target] = value & 0xff;
      output[target + 1] = value >> 8;
    }
  }
  return output;
}

export default function MksTftStudio() {
  const canvasRef = useRef(null);
  const requestedProfiles = useRef(new Set());
  const [model, setModel] = useState("tft32");
  const [preset, setPreset] = useState(SIZE_PRESETS[0].id);
  const [width, setWidth] = useState(SIZE_PRESETS[0].width);
  const [height, setHeight] = useState(SIZE_PRESETS[0].height);
  const [fit, setFit] = useState("contain");
  const [background, setBackground] = useState("#101827");
  const [byteOrder, setByteOrder] = useState("little");
  const [channelOrder, setChannelOrder] = useState("rgb");
  const [rotate180, setRotate180] = useState(false);
  const [target, setTarget] = useState(TARGETS[0]);
  const [targetName, setTargetName] = useState(TARGETS[0]);
  const [source, setSource] = useState(null);
  const [builtinTemplates, setBuiltinTemplates] = useState({});
  const [customTemplates, setCustomTemplates] = useState({});
  const [templateMetadata, setTemplateMetadata] = useState({});
  const [templateLicenses, setTemplateLicenses] = useState({});
  const [templateStatus, setTemplateStatus] = useState({});
  const [retryTemplate, setRetryTemplate] = useState(0);
  const [message, setMessage] = useState("");

  const templateFiles = customTemplates[model] || builtinTemplates[model] || {};
  const templateList = useMemo(() => Object.entries(templateFiles).sort(([a], [b]) => a.localeCompare(b)), [templateFiles]);
  const targetOptions = useMemo(() => {
    const names = [...new Set(templateList.map(([path]) => path.split("/").pop()).filter((name) => /^bmp_[a-z0-9_-]+\.bin$/i.test(name)))];
    return names.length ? names : TARGETS;
  }, [templateList]);
  const activeSizePresets = model === "robin35" ? ROBIN_SIZE_PRESETS : SIZE_PRESETS;

  useEffect(() => {
    if (builtinTemplates[model] || templateStatus[model] === "loading" || templateStatus[model] === "ready" || templateStatus[model] === "error") return;
    if (requestedProfiles.current.has(model)) return;
    requestedProfiles.current.add(model);
    setTemplateStatus((current) => ({ ...current, [model]: "loading" }));
    fetchBuiltinTemplate(model).then(({ files, metadata, license }) => {
      setBuiltinTemplates((current) => ({ ...current, [model]: files }));
      setTemplateMetadata((current) => ({ ...current, [model]: metadata }));
      setTemplateLicenses((current) => ({ ...current, [model]: license }));
      setTemplateStatus((current) => ({ ...current, [model]: "ready" }));
      setMessage(`${metadata.name} chargé · ${Object.keys(files).length} ressources locales.`);
    }).catch((error) => {
      setTemplateStatus((current) => ({ ...current, [model]: "error" }));
      setMessage(error.message || "Impossible de charger le pack MKS fourni.");
    });
  }, [model, builtinTemplates, templateStatus, retryTemplate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    if (!source?.url) return;
    const image = new window.Image();
    image.onload = () => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      const scale = fit === "cover" ? Math.max(width / image.naturalWidth, height / image.naturalHeight) : Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    };
    image.src = source.url;
  }, [source, width, height, fit, background]);

  useEffect(() => () => { if (source?.url) URL.revokeObjectURL(source.url); }, [source]);

  function applyPreset(id) {
    const item = activeSizePresets.find((entry) => entry.id === id);
    setPreset(id);
    if (item) { setWidth(item.width); setHeight(item.height); }
  }

  function chooseModel(nextModel) {
    setModel(nextModel);
    const defaults = nextModel === "tft32"
      ? { target: "bmp_custom1.bin", preset: "tft32-icon", width: 78, height: 104 }
      : nextModel === "tft35"
        ? { target: "bmp_custom1.bin", preset: "tft35-icon", width: 117, height: 140 }
        : { target: "bmp_logo.bin", preset: "robin-logo", width: 480, height: 320 };
    setTarget(defaults.target);
    setTargetName(defaults.target);
    setPreset(defaults.preset);
    setWidth(defaults.width);
    setHeight(defaults.height);
    setMessage("");
  }

  function chooseTarget(name) {
    setTarget(name);
    setTargetName(name);
    const asset = templateList.find(([path]) => path.split("/").pop().toLowerCase() === name.toLowerCase())?.[1];
    const dimensions = inferAssetDimensions(model, name, asset);
    if (dimensions) {
      setPreset(presetForDimensions(model, dimensions));
      setWidth(dimensions.width);
      setHeight(dimensions.height);
    } else if (model === "tft32") applyPreset("tft32-icon");
    else if (model === "tft35") applyPreset("tft35-icon");
    else applyPreset("custom");
  }

  async function loadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = await fileBytesToImage(file);
      setSource(next);
      setMessage(`Image chargée : ${file.name} (${next.width} × ${next.height}).`);
    } catch (error) {
      setMessage(error.message || "Impossible d’ouvrir cette image.");
    }
  }

  async function loadTemplate(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const next = {};
    for (const file of files) {
      const relative = safeTemplatePath(file.webkitRelativePath || file.name);
      if (!relative) continue;
      next[relative] = new Uint8Array(await file.arrayBuffer());
    }
    setCustomTemplates((current) => ({ ...current, [model]: next }));
    setMessage(Object.keys(next).length ? `${Object.keys(next).length} ressource(s) MKS importée(s) pour ce profil.` : "Aucun fichier .bin ou .lg trouvé dans le dossier choisi.");
  }

  function outputBytes() {
    if (!source) throw new Error("Importe d’abord une image PNG, JPG, WebP ou BMP.");
    const filename = safeTarget(targetName);
    if (!filename) throw new Error("Le nom doit respecter le format bmp_nom.bin.");
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1600 || height > 1200) throw new Error("Choisis des dimensions valides (max. 1600 × 1200).");
    if (canvasRef.current.width !== width || canvasRef.current.height !== height) throw new Error("L’aperçu est encore en préparation. Réessaie dans un instant.");
    const pixels = rgb565Bytes(canvasRef.current, byteOrder, channelOrder, rotate180);
    const assetPath = templateList.find(([path]) => path.split("/").pop().toLowerCase() === filename.toLowerCase())?.[0];
    const original = assetPath ? templateFiles[assetPath] : null;
    if (model === "robin35" && !original) throw new Error("Choisis un asset existant du pack Robin Nano pour conserver son en-tête LVGL.");
    const headerBytes = model === "robin35" && original && original.byteLength % 2 === 1 ? 5 : 0;
    if (original && original.byteLength !== pixels.byteLength + headerBytes) {
      throw new Error(`La taille ne correspond pas à ${filename} (${original.byteLength} octets). Choisis les dimensions de l’asset d’origine.`);
    }
    if (!original && model === "robin35") throw new Error("Cet asset Robin Nano n’existe pas dans le pack de référence.");
    const output = new Uint8Array(headerBytes + pixels.byteLength);
    if (headerBytes) output.set(original.slice(0, headerBytes), 0);
    output.set(pixels, headerBytes);
    return { filename, bytes: output, headerBytes };
  }

  function exportBin() {
    try {
      const { filename, bytes } = outputBytes();
      saveBlob(new Blob([bytes], { type: "application/octet-stream" }), filename);
      setMessage(`${filename} exporté · ${bytes.byteLength.toLocaleString("fr-FR")} octets.`);
    } catch (error) { setMessage(error.message); }
  }

  function exportZip() {
    try {
      const { filename, bytes, headerBytes } = outputBytes();
      const packageFiles = {};
      for (const [path, data] of Object.entries(templateFiles)) {
        if (path.split("/").pop().toLowerCase() !== filename.toLowerCase()) packageFiles[`mks_pic/${path}`] = data;
      }
      packageFiles[`mks_pic/${filename}`] = bytes;
      packageFiles["LISEZ-MOI-MKS-TFT.txt"] = [
        "Marlin Flow Studio — ressources d’image MKS",
        "",
        `Profil sélectionné : ${PROFILE_INFO[model].name}`,
        `Pack de référence : ${templateMetadata[model]?.name || PROFILE_INFO[model].pack}`,
        `Image remplacée/générée : mks_pic/${filename}`,
        `Dimensions : ${width} × ${height}`,
        `Pixels : ${channelOrder.toUpperCase()}565 ; octets ${byteOrder === "big" ? "fort puis faible" : "faible puis fort"}${headerBytes ? ` ; en-tête source ${headerBytes} octets préservé` : ""}${rotate180 ? " ; rotation 180°" : ""}`,
        `Ressources reprises du dossier source : ${templateList.length}`,
        "",
        "Copiez le dossier mks_pic à la racine de la carte SD avec les fichiers d’origine correspondant exactement au modèle et au firmware de l’écran.",
        "Ce paquet ne contient pas le firmware ni mks_config.txt. Gardez une copie des ressources d’origine et vérifiez la compatibilité avec la révision exacte du firmware avant mise à jour.",
        "La génération est réalisée localement dans le navigateur.",
        "",
      ].join("\r\n");
      packageFiles["NOTICE-MKS-assets.txt"] = "Assets de référence issus des archives MKS fournies par l’utilisateur. Le code de MKS-TOOL n’est pas inclus. Voir la licence jointe au pack.\r\n";
      if (templateLicenses[model]) packageFiles[PROFILE_INFO[model].license] = templateLicenses[model];
      saveBlob(createZipStore(packageFiles), "MKS-TFT-mks_pic.zip");
      setMessage(`ZIP créé : ${Object.keys(packageFiles).length} fichier(s), dont mks_pic/${filename}.`);
    } catch (error) { setMessage(error.message || "Impossible de créer l’archive ZIP."); }
  }

  const selectedAsset = templateList.find(([path]) => path.split("/").pop().toLowerCase() === targetName.toLowerCase())?.[1];
  const outputHeaderBytes = model === "robin35" && selectedAsset && selectedAsset.byteLength % 2 === 1 ? 5 : 0;
  const binarySize = width * height * 2 + outputHeaderBytes;

  return <div className="h-full overflow-auto p-4 md:p-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><ImageIcon className="h-6 w-6 text-cyan-500" /><h1 className="text-2xl font-semibold">MKS TFT Studio</h1></div>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Personnalise les ressources RGB565 des packs MKS-TOOL et du firmware Robin Nano LVGL. Les images et exports restent sur ce PC.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><SlidersHorizontal className="h-4 w-4" />{PROFILE_INFO[model].pack}</div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">Aperçu de l’image</h2><p className="text-xs text-muted-foreground">{PROFILE_INFO[model].name} · rendu à la taille exacte choisie.</p></div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Upload className="h-4 w-4" />Importer une image<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" onChange={loadImage} /></label>
          </div>
          <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-950 p-4">
            {source ? <canvas ref={canvasRef} className="max-h-[60vh] max-w-full rounded shadow-lg [image-rendering:pixelated]" style={{ width: "auto", height: "auto", objectFit: "contain", transform: rotate180 ? "rotate(180deg)" : undefined }} /> : <div className="flex max-w-sm flex-col items-center gap-3 text-center text-muted-foreground"><FileImage className="h-12 w-12 opacity-40" /><p className="text-sm">Importe une image pour commencer. Tu pourras vérifier le cadrage avant de générer le fichier MKS.</p></div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{source ? `${source.width} × ${source.height} px · ${fit === "cover" ? "remplir / recadrer" : "contenir"}` : "Aucune image chargée"}</span><span>Sortie : {width} × {height} · {binarySize.toLocaleString("fr-FR")} octets</span></div>
          {message && <div role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</div>}
        </section>

        <div className="space-y-4">
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 md:p-5">
            <h2 className="font-semibold">Cible MKS</h2>
            <label className="block text-sm">Famille et modèle<select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={model} onChange={(event) => chooseModel(event.target.value)}><option value="tft32">MKS-TOOL · TFT24 / TFT28 / TFT32</option><option value="tft35">MKS-TOOL · TFT35</option><option value="robin35">MKS Robin Nano TFT35 · Marlin 2.0 LVGL</option></select></label>
            <label className="block text-sm">Taille d’image<select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={preset} onChange={(event) => applyPreset(event.target.value)}>{activeSizePresets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            {preset === "custom" && <div className="grid grid-cols-2 gap-3"><label className="text-sm">Largeur<input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" type="number" min="1" max="1600" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label className="text-sm">Hauteur<input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" type="number" min="1" max="1200" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label></div>}
            <label className="block text-sm">Ressource à remplacer<select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={target} onChange={(event) => { const next = event.target.value; if (next === "custom") { setTarget("custom"); setTargetName(""); } else chooseTarget(next); }} disabled={model === "robin35" && targetOptions.length === 0}>{targetOptions.map((name) => <option key={name} value={name}>{name}</option>)}{model !== "robin35" && <option value="custom">Nom personnalisé…</option>}</select></label>
            {target === "custom" && <label className="block text-sm">Nom dans mks_pic<input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono" value={targetName} onChange={(event) => setTargetName(event.target.value)} placeholder="bmp_custom.bin" /></label>}
            {target !== "custom" && <p className="rounded bg-muted/40 px-3 py-2 font-mono text-xs">mks_pic/{targetName}</p>}
            <p className="text-xs text-muted-foreground">{templateStatus[model] === "loading" ? "Chargement du pack de référence local…" : templateStatus[model] === "error" ? "Pack indisponible : importe le dossier mks_pic de ton firmware." : `${templateList.length} asset(s) dans le pack actif.`}</p>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4 md:p-5">
            <h2 className="font-semibold">Conversion et cadrage</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Ajustement<select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2" value={fit} onChange={(event) => setFit(event.target.value)}><option value="contain">Tout contenir</option><option value="cover">Remplir et recadrer</option></select></label>
              <label className="text-sm">Fond<input className="mt-1 h-10 w-full cursor-pointer rounded-md border border-border bg-background p-1" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
              <label className="text-sm">Canaux<select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2" value={channelOrder} onChange={(event) => setChannelOrder(event.target.value)}><option value="rgb">RGB565</option><option value="bgr">BGR565</option></select></label>
              <label className="text-sm">Ordre des octets<select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2" value={byteOrder} onChange={(event) => setByteOrder(event.target.value)}><option value="big">Fort puis faible</option><option value="little">Faible puis fort</option></select></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rotate180} onChange={(event) => setRotate180(event.target.checked)} />Rotation 180° à l’export</label>
          </section>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-start gap-3"><FolderInput className="mt-0.5 h-5 w-5 text-cyan-500" /><div className="min-w-0 flex-1"><h2 className="font-semibold">Pack de référence</h2><p className="mt-1 text-xs text-muted-foreground">{PROFILE_INFO[model].pack} est intégré. Tu peux importer ton dossier <code>mks_pic</code> : il remplacera le pack de référence pour ce profil.</p></div></div>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50"><Upload className="h-4 w-4" />Importer le dossier mks_pic<input className="sr-only" type="file" multiple webkitdirectory="" directory="" onChange={loadTemplate} /></label>
          {customTemplates[model] && <button type="button" onClick={() => setCustomTemplates((current) => { const next = { ...current }; delete next[model]; return next; })} className="ml-2 mt-4 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50">Restaurer le pack intégré</button>}
          <p className="mt-2 text-xs text-muted-foreground">{templateList.length ? `${templateList.length} fichier(s) conservé(s) (.bin / .lg)` : "Le pack se charge depuis les fichiers locaux de l’application."}</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 md:p-5">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><h2 className="font-semibold">Vérifie la variante du firmware</h2><p className="mt-1 text-sm text-muted-foreground">{model === "robin35" ? "Le pack Robin fourni utilise des images LVGL RGB565 ; le studio conserve l’en-tête de 5 octets des assets qui en ont un. Logo et aperçu restent bruts. L’export vérifie la longueur selon l’asset choisi." : "MKS-TOOL écrit les assets autonomes en RGB565 little-endian brut. Les dimensions varient selon la page et l’emplacement ; l’export reprend les dimensions usuelles par asset. Vérifie la version du firmware avant copie sur carte SD."}</p></div></div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0" /><span>ZIP `mks_pic` local uniquement · le firmware et mks_config.txt ne sont pas modifiés.</span></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setSource(null); setCustomTemplates((current) => { const next = { ...current }; delete next[model]; return next; }); setMessage(""); }} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50"><RefreshCw className="h-4 w-4" />Réinitialiser</button><button type="button" onClick={exportBin} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50"><Download className="h-4 w-4" />Exporter .bin</button><button type="button" onClick={exportZip} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Archive className="h-4 w-4" />Créer ZIP mks_pic</button></div>
      </footer>
      <p className="flex items-center gap-2 pb-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Conversion sans téléversement : l’image et les fichiers sources restent dans cette application locale.</p>
    </div>
  </div>;
}
