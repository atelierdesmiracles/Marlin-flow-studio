import React, { useState } from "react";
import { AlertTriangle, Check, CircleHelp, Copy, ExternalLink, Info, Router, Save, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { parseProject, useProject } from "@/lib/projectStore";
import { renderLine, serializeMarlinFile } from "@/lib/marlinParser";

const WIFI_MACROS = [
  "WIFISUPPORT", "ESP3D_WIFISUPPORT", "WEBSUPPORT", "OTASUPPORT", "WIFI_CUSTOM_COMMAND",
  "WIFI_SSID", "WIFI_PWD", "SERIAL_PORT_2", "MKS_WIFI_MODULE", "TFT_LVGL_UI",
];

const MODES = [
  { id: "native", title: "Wi-Fi natif Marlin", subtitle: "ESP32 intégré ou module WiFi-101", icon: Wifi },
  { id: "esp3d", title: "ESP3D Library", subtitle: "ESP32 intégré avec l’interface ESP3D", icon: Router },
  { id: "serial", title: "Module Wi-Fi série", subtitle: "ESP-01 / ESP8266 avec firmware autonome", icon: WifiOff },
  { id: "mks", title: "Module Wi-Fi MKS", subtitle: "Écran MKS avec interface TFT LVGL", icon: Router },
];

const PREFERRED_FILE = {
  MOTHERBOARD: "Configuration.h", SERIAL_PORT_2: "Configuration.h",
  MKS_WIFI_MODULE: "Configuration.h", TFT_LVGL_UI: "Configuration.h",
};

function versionNumber(project) {
  const source = String(project?.marlinVersion || "");
  return source.match(/\d+(?:\.\d+){2,}/)?.[0] || "";
}

function getPlan(mode, version) {
  if (mode === "native") return [
    ["WIFISUPPORT", true], ["ESP3D_WIFISUPPORT", false], ["WEBSUPPORT", true],
    ["OTASUPPORT", true], ["WIFI_CUSTOM_COMMAND", false],
  ];
  if (mode === "esp3d") {
    const knownLegacy = /^2\.1\.2\.(?:[3-9]|\d{2,})$/.test(version);
    const knownBroken = version === "2.1.2.2";
    const plan = [["WIFISUPPORT", false], ["ESP3D_WIFISUPPORT", true], ["WIFI_CUSTOM_COMMAND", true]];
    if (knownLegacy) plan.push(["WEBSUPPORT", true], ["OTASUPPORT", true]);
    if (knownBroken) plan.push(["WEBSUPPORT", false], ["OTASUPPORT", false]);
    return plan;
  }
  if (mode === "mks") return [["TFT_LVGL_UI", true], ["MKS_WIFI_MODULE", true]];
  return [
    ["WIFISUPPORT", false], ["ESP3D_WIFISUPPORT", false], ["WEBSUPPORT", false],
    ["OTASUPPORT", false], ["WIFI_CUSTOM_COMMAND", false],
  ];
}

function sourceDefined(param) {
  return Boolean(param && param.directive === "define" && !param.commented);
}

export default function WifiStudio({ onOpenProjects, onSaveLocal }) {
  const { currentProject, updateProject } = useProject();
  const [mode, setMode] = useState("native");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const version = versionNumber(currentProject);
  const params = currentProject?.allParameters || [];
  const findMacro = (name) => {
    const preferred = PREFERRED_FILE[name];
    return (preferred && params.find((p) => p.name === name && p.file === preferred))
      || params.find((p) => p.name === name)
      || null;
  };
  const board = String(findMacro("MOTHERBOARD")?.value || currentProject?.board || "");
  const likelyEsp32 = /ESP32|TINYBEE|FYSETC_E4/i.test(board);
  const isLegacyEsp3d = /^2\.1\.2\.(?:[3-9]|\d{2,})$/.test(version);
  const isKnownBrokenEsp3d = version === "2.1.2.2";
  const snippet = mode === "native"
    ? ["// Configuration_adv.h — carte mère ESP32 uniquement", "#define WIFISUPPORT", "#define WEBSUPPORT", "#define OTASUPPORT", "// Identifiants : Configuration_Secure.h, jamais dans un dépôt public"].join("\n")
    : mode === "esp3d"
      ? ["// Configuration_adv.h — ESP32 + ESP3D Library", "#define ESP3D_WIFISUPPORT", ...(isLegacyEsp3d ? ["#define WEBSUPPORT", "#define OTASUPPORT"] : []), "#define WIFI_CUSTOM_COMMAND"].join("\n")
      : mode === "mks"
        ? ["// Configuration.h — uniquement avec l’interface TFT LVGL MKS", "#define TFT_LVGL_UI", "#define MKS_WIFI_MODULE"].join("\n")
        : ["// Configuration.h — choisir le port selon le schéma exact de la carte", "#define SERIAL_PORT_2 <port série du module Wi-Fi>", "// Le module ESP3D externe gère lui-même le réseau et ses identifiants"].join("\n");
  if (!currentProject) return <div className="h-full overflow-auto p-6"><div className="max-w-4xl mx-auto rounded-xl border bg-card p-6"><h1 className="text-xl font-semibold flex items-center gap-2"><Wifi className="w-5 h-5" />Wi-Fi Studio</h1><p className="text-sm text-muted-foreground mt-2">Ouvre un projet Marlin local pour analyser et préparer sa configuration Wi-Fi.</p><button onClick={onOpenProjects} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Ouvrir les projets</button></div></div>;

  const saveToPc = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!onSaveLocal) throw new Error("L’enregistrement local n’est pas disponible.");
      await onSaveLocal({ throwOnError: true });
      setMessage("Configuration enregistrée dans le projet Marlin local.");
    } catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  };

  const configureMode = () => {
    setMessage(""); setError("");
    const changes = [];
    const absent = [];
    const nextFiles = Object.fromEntries(Object.entries(currentProject.parsedFiles || {}).map(([file, parsed]) => [
      file, serializeMarlinFile(parsed.parameters, parsed.originalLines, file),
    ]));
    const editedLines = new Map();
    for (const [name, wanted] of getPlan(mode, version)) {
      const param = findMacro(name);
      if (!param || param.directive !== "define") { absent.push(name); continue; }
      if (sourceDefined(param) !== wanted) {
        const parsedFile = currentProject.parsedFiles?.[param.file];
        if (!parsedFile) { absent.push(name); continue; }
        if (!editedLines.has(param.file)) {
          const source = serializeMarlinFile(parsedFile.parameters, parsedFile.originalLines, param.file);
          editedLines.set(param.file, source.split(/\r?\n/));
        }
        const lines = editedLines.get(param.file);
        const indentation = lines[param.line]?.match(/^\s*/)?.[0] || "";
        const updated = { ...param, commented: !wanted, enabled: wanted && param.active, modified: true };
        lines[param.line] = indentation + renderLine(updated).trimStart();
        changes.push(name);
      }
    }
    for (const [file, lines] of editedLines) nextFiles[file] = lines.join("\n");
    if (changes.length) updateProject(parseProject({ ...currentProject, files: nextFiles, updatedDate: new Date().toISOString() }));
    if (changes.length) setMessage(`Options préparées : ${changes.join(", ")}. Enregistre-les sur le PC avant de compiler.`);
    else setMessage("Aucune directive compatible à modifier dans les fichiers chargés.");
    if (absent.length) setError(`Directives non trouvées, laissées intactes : ${absent.join(", ")}. Vérifie la version et les fichiers de configuration.`);
  };

  const copySnippet = async () => {
    try { await navigator.clipboard.writeText(snippet); setMessage("Exemple copié. Il reste à l’adapter à la carte et à la version Marlin."); }
    catch { setError("Le presse-papiers n’est pas disponible dans cette fenêtre."); }
  };

  const selectedMode = MODES.find((item) => item.id === mode) || MODES[0];
  const SelectedIcon = selectedMode.icon;

  return <div className="h-full overflow-auto p-5 md:p-7"><div className="max-w-7xl mx-auto space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold flex items-center gap-2"><Wifi className="w-6 h-6 text-primary" />Wi-Fi Studio</h1><p className="text-sm text-muted-foreground mt-1">Identifie la solution Wi-Fi adaptée à la carte, contrôle les directives Marlin et prépare la configuration locale.</p></div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border px-3 py-1.5">Marlin {version || "version inconnue"}</span><span className="rounded-full border px-3 py-1.5 font-mono">{board || "Carte non détectée"}</span></div>
    </header>

    {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm flex gap-2"><Check className="w-4 h-4 shrink-0" />{message}</div>}
    {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
    {!currentProject.localProjectPath && <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm flex flex-wrap items-center justify-between gap-2"><span>Le projet affiché n’est pas ouvert depuis le disque. Ouvre le projet local pour enregistrer les macros dans les fichiers Marlin.</span><button onClick={onOpenProjects} className="rounded-lg border px-3 py-1.5 text-xs">Ouvrir les projets</button></div>}

    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {MODES.map(({ id, title, subtitle, icon: Icon }) => <button key={id} onClick={() => { setMode(id); setMessage(""); setError(""); }} className={`rounded-xl border p-4 text-left transition-colors ${mode === id ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-card hover:bg-muted/30"}`}>
        <Icon className={`w-5 h-5 mb-3 ${mode === id ? "text-primary" : "text-muted-foreground"}`} /><div className="font-semibold text-sm">{title}</div><div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
      </button>)}
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className="xl:col-span-2 rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><SelectedIcon className="w-4 h-4 text-primary" />Parcours : {selectedMode.title}</h2>
        {mode === "native" && <div className="space-y-3 text-sm"><p>À choisir si le Wi-Fi est intégré à un ESP32 de la carte mère ou si la carte utilise le module ESP32 WiFi-101 pris en charge par Marlin. Active le réseau embarqué Marlin; le serveur Web et l’OTA sont des options distinctes.</p><div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" /><span>Les identifiants compilés dans le firmware sont des secrets. Marlin prévoit <code>Configuration_Secure.h</code> pour les garder hors du dépôt public. Ce studio ne demande ni ne stocke le SSID ou le mot de passe.</span></div></div>}
        {mode === "esp3d" && <div className="space-y-3 text-sm"><p>À choisir pour la bibliothèque ESP3D exécutée sur un ESP32 pris en charge. Le firmware Marlin et ESP3D doivent utiliser la liaison série définie par la carte.</p><div className="rounded-lg border bg-muted/30 p-3 text-xs flex gap-2"><Info className="w-4 h-4 shrink-0" /><span>Les macros Web/OTA d’ESP3D changent selon la version Marlin. Pour Marlin 2.1.2.3 à 2.1.2.8, cet assistant prépare les options exposées dans cette ancienne configuration; garde les identifiants dans <code>Configuration_Secure.h</code>. Sur les versions récentes, ESP3D a son propre serveur Web et configure le réseau depuis son interface ou ses commandes.</span></div>{isKnownBrokenEsp3d && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">Marlin 2.1.2.2 a un problème connu avec les options ESP3D. Mets à jour Marlin ou vérifie les correctifs avant le build.</div>}</div>}
        {mode === "serial" && <div className="space-y-3 text-sm"><p>À choisir si un module ESP8266 autonome avec son propre firmware Wi-Fi est relié à l’UART de la carte. Le module gère le réseau; Marlin échange avec lui sur le port série matériel choisi.</p><div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" /><span>Ne choisis pas le numéro de port au hasard : vérifie le schéma de la carte, les broches TX/RX, le niveau logique 3,3 V et le débit du module. Ne pas activer <code>ESP3D_WIFISUPPORT</code> pour un module externe sans vérifier la compatibilité du firmware. Le module ESP32 WiFi-101 prévu par Marlin est un cas matériel distinct.</span></div></div>}
        {mode === "mks" && <div className="space-y-3 text-sm"><p>Cette option concerne le module Wi-Fi associé à certaines interfaces tactiles MKS en mode TFT LVGL. Elle ne transforme pas une carte quelconque en serveur Wi-Fi Marlin.</p><div className="rounded-lg border bg-muted/30 p-3 text-xs flex gap-2"><CircleHelp className="w-4 h-4 shrink-0" /><span>Vérifie que l’écran utilise bien le firmware TFT LVGL MKS et que <code>TFT_LVGL_UI</code> est configuré. Le support dépend du modèle d’écran et de la carte.</span></div></div>}

        {(mode === "native" || mode === "esp3d") && !likelyEsp32 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" /><span>La carte détectée n’indique pas clairement un ESP32. Confirme son processeur et le support de cette option avant de compiler.</span></div>}
        {mode === "esp3d" && !version && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">Version Marlin inconnue : seules les macros ESP3D de base seront préparées; vérifie les options Web et OTA dans le fichier fourni avec ta version.</div>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={configureMode} disabled={mode === "esp3d" && isKnownBrokenEsp3d} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40">Préparer les macros présentes</button>
          <button onClick={saveToPc} disabled={busy || !currentProject.localProjectPath} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"><Save className="w-4 h-4 inline mr-2" />{busy ? "Enregistrement…" : "Enregistrer sur le PC"}</button>
          <button onClick={copySnippet} className="rounded-lg border px-4 py-2 text-sm"><Copy className="w-4 h-4 inline mr-2" />Copier l’exemple</button>
        </div>
        <p className="text-xs text-muted-foreground">Les macros absentes des fichiers chargés ne sont jamais ajoutées automatiquement. Les modifications utilisent les fichiers Marlin détectés et la sauvegarde protégée par empreinte SHA-256.</p>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">État du projet</h2>
        <div className="text-xs text-muted-foreground">Configuration : {Object.keys(currentProject.parsedFiles || {}).join(", ") || "aucun fichier chargé"}</div>
        <div className="space-y-2">
          {WIFI_MACROS.map((name) => {
            const param = findMacro(name);
            const defined = sourceDefined(param);
            const conditional = defined && param.active === false;
            return <div key={name} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0"><code className="text-xs break-all">{name}</code><div className="text-[10px] text-muted-foreground">{param ? `${param.file}${conditional ? " · bloc conditionnel inactif" : ""}` : "absent des fichiers chargés"}</div></div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${!param ? "text-muted-foreground" : defined && !conditional ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : defined ? "border-amber-500/40 text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{!param ? "absent" : conditional ? "conditionnel" : defined ? "défini" : "commenté"}</span>
            </div>;
          })}
        </div>
        {mode === "serial" && <div className="rounded-lg bg-muted/30 p-3 text-xs">Port série 2 détecté : <code>{findMacro("SERIAL_PORT_2")?.value ?? "non défini"}</code>. Il doit correspondre aux broches et au port réellement câblés.</div>}
        {mode === "mks" && !sourceDefined(findMacro("TFT_LVGL_UI")) && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">Prérequis <code>TFT_LVGL_UI</code> non activé dans la configuration chargée.</div>}
      </section>
    </div>

    <section className="rounded-xl border bg-card p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div><h2 className="font-semibold">Exemple adapté au parcours</h2><p className="text-xs text-muted-foreground mt-1">À comparer à la section réseau de <code>Configuration_adv.h</code>; les versions Marlin n’exposent pas toutes les mêmes options.</p></div>
      <pre className="overflow-auto rounded-lg bg-black/90 p-4 text-xs text-green-300"><code>{snippet}</code></pre>
      <div className="flex flex-wrap gap-3 text-xs lg:col-span-2"><a href="https://github.com/MarlinFirmware/Marlin/blob/2.1.2.8/Marlin/Configuration_adv.h" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Configuration Marlin 2.1.2.8 <ExternalLink className="w-3 h-3" /></a><a href="https://github.com/luc-github/ESP3DLib" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Guide ESP3D <ExternalLink className="w-3 h-3" /></a></div>
    </section>
  </div></div>;
}
