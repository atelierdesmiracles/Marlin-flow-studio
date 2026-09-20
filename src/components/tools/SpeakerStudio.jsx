import React, { useEffect, useMemo, useRef, useState } from "react";
import { Music2, Play, Square, Plus, Trash2, Download, Save, Radio, Send as SendIcon, Volume2, AlertTriangle, CheckCircle2, RotateCcw, Power, Printer, TriangleAlert, Check, Copy } from "lucide-react";
import { agentApi } from "@/lib/localAgent";
import { useProject } from "@/lib/projectStore";
import { cn } from "@/lib/utils";

const NOTES = {
  C4: 261.63, "C#4": 277.18, D4: 293.66, "D#4": 311.13, E4: 329.63, F4: 349.23, "F#4": 369.99, G4: 392, "G#4": 415.30, A4: 440, "A#4": 466.16, B4: 493.88,
  C5: 523.25, "C#5": 554.37, D5: 587.33, "D#5": 622.25, E5: 659.25, F5: 698.46, "F#5": 739.99, G5: 783.99, "G#5": 830.61, A5: 880, "A#5": 932.33, B5: 987.77,
  C6: 1046.50, "C#6": 1108.73, D6: 1174.66, "D#6": 1244.51, E6: 1318.51, F6: 1396.91, "F#6": 1479.98, G6: 1567.98, "G#6": 1661.22, A6: 1760, "A#6": 1864.66, B6: 1975.53,
};
const NOTE_NAMES = Object.keys(NOTES);
const DURATIONS = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
const STARTER = [
  { note: "C5", duration: 120 }, { note: "E5", duration: 120 }, { note: "G5", duration: 180 }, { note: null, duration: 80 },
  { note: "C6", duration: 300 },
];

const EVENT_DEFS = [
  { id: "startup", label: "Démarrage", icon: Power, description: "Joué au démarrage du firmware via STARTUP_TUNE.", defaultRows: STARTER },
  { id: "print_start", label: "Début d'impression", icon: Printer, description: "À placer dans le Start G-code du slicer ou de l'hôte.", defaultRows: [{ note: "C5", duration: 100 }, { note: "G5", duration: 100 }, { note: "C6", duration: 220 }] },
  { id: "error", label: "Erreur", icon: TriangleAlert, description: "Déclenché par l'hôte ou une macro d'erreur ; Marlin n'offre pas un hook universel pour toutes les erreurs.", defaultRows: [{ note: "A5", duration: 180 }, { note: null, duration: 80 }, { note: "A5", duration: 180 }, { note: "A5", duration: 300 }] },
  { id: "print_finish", label: "Impression terminée", icon: Check, description: "À placer dans le End G-code du slicer. Pour une impression SD, peut aussi être associé à EVENT_GCODE_SD_STOP selon le besoin.", defaultRows: [{ note: "C6", duration: 120 }, { note: "E6", duration: 120 }, { note: "G6", duration: 120 }, { note: "C6", duration: 350 }] },
  { id: "shutdown", label: "Extinction", icon: Power, description: "Joué juste avant une extinction logicielle M81. Impossible après coupure physique de l'alimentation.", defaultRows: [{ note: "G5", duration: 140 }, { note: "E5", duration: 140 }, { note: "C5", duration: 280 }] },
];

function eventGcode(rows, label) { return [`; Marlin Flow Studio - ${label}`, ...rows.map(r => `M300 S${r.note ? Math.round(NOTES[r.note]) : 0} P${Math.max(1, Math.round(r.duration))}`), ""].join("\n"); }
function eventCommands(rows) { return rows.map(r => `M300 S${r.note ? Math.round(NOTES[r.note]) : 0} P${Math.max(1, Math.round(r.duration))}`).join("\n"); }
function eventMacroLine(slot, rows) { return `M${810 + slot} ${rows.map(r => `M300 S${r.note ? Math.round(NOTES[r.note]) : 0} P${Math.max(1, Math.round(r.duration))}`).join("|")}`; }
function eventBundle(events) {
  const lines = ["; Marlin Flow Studio - Event Sounds", "; MIDI/Speaker event pack", "; IMPORTANT: M810-M819 requires GCODE_MACROS. Direct snippets below work without macros.", ""];
  const slots = { print_start: 1, error: 2, print_finish: 3, shutdown: 4 };
  for (const e of EVENT_DEFS) { const rows = events[e.id] || e.defaultRows; lines.push(`; ===== ${e.label.toUpperCase()} =====`); lines.push(...eventGcode(rows, e.label).split("\n")); if (slots[e.id]) lines.push(`; Macro (optional): ${eventMacroLine(slots[e.id], rows)}`); lines.push(""); }
  lines.push("; START G-code (slicer):"); lines.push(eventCommands(events.print_start || EVENT_DEFS[1].defaultRows));
  lines.push("; END G-code (slicer):"); lines.push(eventCommands(events.print_finish || EVENT_DEFS[3].defaultRows));
  lines.push("; ERROR (host-side hook):"); lines.push(eventCommands(events.error || EVENT_DEFS[2].defaultRows));
  lines.push("; SOFTWARE SHUTDOWN: play sound, then M81:"); lines.push(eventCommands(events.shutdown || EVENT_DEFS[4].defaultRows)); lines.push("M81");
  return lines.join("\n");
}

function rowLabel(row, i) { return row.note ? `${row.note} · ${Math.round(NOTES[row.note])} Hz` : `Silence · ${row.duration} ms`; }
function tonePairs(rows) { return rows.flatMap(r => [r.note ? Math.round(NOTES[r.note]) : 0, Math.max(1, Math.round(r.duration))]); }
function gcode(rows) {
  const lines = ["; Marlin Flow Studio - Speaker Studio", "; Generated from musical sequence / MIDI", "; No G4 delays: M300 P controls each tone duration.", "M107"];
  for (const r of rows) lines.push(`M300 S${r.note ? Math.round(NOTES[r.note]) : 0} P${Math.max(1, Math.round(r.duration))}`);
  lines.push("; End melody", "");
  return lines.join("\n");
}
function startupTune(rows) { return `#define STARTUP_TUNE { ${tonePairs(rows).join(", ")} }`; }

function upsertDefine(content, name, value, enabled = true) {
  const re = new RegExp(`^\\s*#\\s*(?:define|undef)\\s+${name}.*$`, "m");
  const line = enabled ? `#define ${name}${value ? ` ${value}` : ""}` : `//#define ${name}`;
  if (re.test(content)) return content.replace(re, line);
  const marker = /#pragma once[^\n]*\n?/;
  if (marker.test(content)) return content.replace(marker, m => `${m}\n${line}\n`);
  return `${line}\n${content}`;
}


function readVarLen(data, pos) {
  let value = 0, b = 0, count = 0;
  do { if (pos >= data.length || count++ >= 4) throw new Error("MIDI VLQ invalide"); b = data[pos++]; value = (value << 7) | (b & 0x7f); } while (b & 0x80);
  return [value, pos];
}
function u16(d, p) { return (d[p] << 8) | d[p + 1]; }
function u32(d, p) { return ((d[p] << 24) >>> 0) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]; }
function midiNoteName(n) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  while (n < 60) n += 12;
  while (n > 95) n -= 12;
  const octave = Math.floor(n / 12) - 1;
  return `${names[n % 12]}${octave}`;
}
function parseMidi(arrayBuffer) {
  const d = new Uint8Array(arrayBuffer);
  const text4 = (p) => String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]);
  if (d.length < 14 || text4(0) !== "MThd") throw new Error("Fichier MIDI invalide : en-tête MThd absent.");
  const headerLength = u32(d, 4);
  if (headerLength < 6 || 8 + headerLength > d.length) throw new Error("En-tête MIDI tronqué.");
  const format = u16(d, 8), tracks = u16(d, 10), division = u16(d, 12);
  if (format > 1) throw new Error(`Format MIDI ${format} non pris en charge : utilisez un MIDI type 0 ou 1.`);
  if (!tracks) throw new Error("Le fichier MIDI ne contient aucune piste.");
  if (division & 0x8000) throw new Error("MIDI SMPTE non pris en charge : utilisez une résolution PPQN classique.");
  const ppqn = division || 480;
  let pos = 8 + headerLength;
  const noteEvents = [];
  const tempos = [{ tick: 0, usPerBeat: 500000 }];

  for (let t = 0; t < tracks; t++) {
    if (pos + 8 > d.length || text4(pos) !== "MTrk") throw new Error(`Piste MIDI ${t + 1} invalide ou tronquée.`);
    const len = u32(d, pos + 4);
    const trackStart = pos + 8;
    const end = trackStart + len;
    if (end > d.length) throw new Error(`Piste MIDI ${t + 1} tronquée.`);
    pos = trackStart;
    let tick = 0, running = null;
    const active = new Map();
    while (pos < end) {
      let delta; [delta, pos] = readVarLen(d, pos); tick += delta;
      if (pos >= end) break;
      let status = d[pos];
      if (status < 0x80) {
        if (running == null) throw new Error(`Running status MIDI invalide dans la piste ${t + 1}.`);
        status = running;
      } else {
        pos++;
      }
      if (status === 0xff) {
        if (pos >= end) break;
        const type = d[pos++]; let n; [n, pos] = readVarLen(d, pos);
        if (pos + n > end) throw new Error(`Événement MIDI tronqué dans la piste ${t + 1}.`);
        if (type === 0x51 && n === 3) {
          const us = (d[pos] << 16) | (d[pos + 1] << 8) | d[pos + 2];
          if (us > 0) tempos.push({ tick, usPerBeat: us });
        }
        pos += n; running = null;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        let n; [n, pos] = readVarLen(d, pos); pos += n; running = null; continue;
      }
      const type = status & 0xf0, channel = status & 0x0f;
      const dataLen = (type === 0xc0 || type === 0xd0) ? 1 : 2;
      if (pos + dataLen > end) throw new Error(`Événement MIDI tronqué dans la piste ${t + 1}.`);
      const a = d[pos++], b = dataLen === 2 ? d[pos++] : 0;
      running = status;
      const key = `${channel}:${a}`;
      if (type === 0x90 && b > 0) {
        active.set(key, { tick, note: a, velocity: b, channel });
      } else if (type === 0x80 || (type === 0x90 && b === 0)) {
        const on = active.get(key);
        if (on) {
          active.delete(key);
          if (tick > on.tick) noteEvents.push({ start: on.tick, end: tick, note: on.note, velocity: on.velocity, channel });
        }
      }
    }
    pos = end;
  }

  if (!noteEvents.length) throw new Error("Aucune note MIDI trouvée.");
  tempos.sort((a, b) => a.tick - b.tick);
  const tempoMap = [];
  let elapsedMs = 0, lastTick = tempos[0].tick, currentTempo = tempos[0].usPerBeat;
  for (const tempo of tempos) {
    if (tempo.tick < lastTick) continue;
    elapsedMs += (tempo.tick - lastTick) * currentTempo / ppqn / 1000;
    lastTick = tempo.tick;
    currentTempo = tempo.usPerBeat;
    tempoMap.push({ tick: tempo.tick, ms: elapsedMs, usPerBeat: currentTempo });
  }
  const tickToMs = (tick) => {
    let lo = 0;
    for (let i = 1; i < tempoMap.length; i++) {
      if (tempoMap[i].tick > tick) break;
      lo = i;
    }
    const base = tempoMap[lo];
    return base.ms + (tick - base.tick) * base.usPerBeat / ppqn / 1000;
  };

  noteEvents.sort((a, b) => a.start - b.start || b.note - a.note || a.end - b.end);
  const selected = [];
  let i = 0;
  while (i < noteEvents.length) {
    const startTick = noteEvents[i].start;
    let best = noteEvents[i];
    let j = i + 1;
    while (j < noteEvents.length && noteEvents[j].start === startTick) {
      if (noteEvents[j].note > best.note || (noteEvents[j].note === best.note && noteEvents[j].velocity > best.velocity)) best = noteEvents[j];
      j++;
    }
    selected.push(best);
    i = j;
  }

  const rows = [];
  let cursorMs = 0;
  for (const n of selected) {
    const startMs = tickToMs(n.start);
    const endMs = tickToMs(n.end);
    if (startMs > cursorMs + 2) rows.push({ note: null, duration: Math.max(25, Math.min(2000, Math.round(startMs - cursorMs))) });
    const duration = Math.max(25, Math.min(2000, Math.round(endMs - Math.max(startMs, cursorMs))));
    if (duration <= 0) continue;
    rows.push({ note: midiNoteName(n.note), duration });
    cursorMs = Math.max(cursorMs, endMs);
  }
  if (!rows.length) throw new Error("Aucune séquence musicale exploitable.");
  return { rows, format, tracks, ppqn, tempo: tempos[0].usPerBeat };
}

function writeVarLen(value) {
  let buffer = value & 0x7f; const out = [];
  while ((value >>= 7)) { buffer <<= 8; buffer |= ((value & 0x7f) | 0x80); }
  while (true) { out.push(buffer & 0xff); if (buffer & 0x80) buffer >>= 8; else break; }
  return out;
}
function makeMidi(rows, bpm = 120) {
  const ppqn = 480, usPerBeat = Math.round(60000000 / bpm), bytes = [];
  const push = (...a) => bytes.push(...a);
  const tempo = [0x00,0xff,0x51,0x03,(usPerBeat>>16)&255,(usPerBeat>>8)&255,usPerBeat&255];
  push(...tempo); let pending = 0;
  for (const r of rows) {
    const ticks = Math.max(1, Math.round((r.duration / 1000) * (60000000 / usPerBeat) * ppqn));
    if (r.note) {
      const midi = 60 + NOTE_NAMES.indexOf(r.note);
      push(...writeVarLen(pending),0x90,midi,90,...writeVarLen(ticks),0x80,midi,0);
      pending = 0;
    } else pending += ticks;
  }
  if (pending) push(...writeVarLen(pending),0xff,0x01,0x00);
  push(0x00,0xff,0x2f,0x00);
  const track = new Uint8Array(bytes), out = [];
  const u32w = n => [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
  out.push(0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,(ppqn>>8)&255,ppqn&255,0x4d,0x54,0x72,0x6b,...u32w(track.length),...track);
  return new Uint8Array(out);
}


export default function SpeakerStudio() {
  const { currentProject } = useProject();
  const [rows, setRows] = useState(STARTER);
  const [selected, setSelected] = useState(0);
  const [volume, setVolume] = useState(0.06);
  const [tempo, setTempo] = useState(1);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(null);
  const [configFile, setConfigFile] = useState("Config.h");
  const [midiName, setMidiName] = useState("");
  const [events, setEvents] = useState(() => Object.fromEntries(EVENT_DEFS.map(e => [e.id, e.defaultRows])));
  const [activeEvent, setActiveEvent] = useState("startup");
  const [eventEnabled, setEventEnabled] = useState(() => Object.fromEntries(EVENT_DEFS.map(e => [e.id, true])));
  const audioRef = useRef(null);
  const stopRef = useRef(false);

  const total = useMemo(() => rows.reduce((s, r) => s + r.duration, 0), [rows]);

  useEffect(() => {
    let dead = false;
    async function detect() {
      try {
        const candidates = ["Config.h", "Configuration.h"];
        for (const file of candidates) {
          try {
            const r = await agentApi.readConfiguration(file);
            if (!r?.content) continue;
            if (dead) return;
            setConfigFile(file);
            setSpeakerEnabled(/^\\s*#\\s*define\\s+SPEAKER\\b/m.test(r.content) && !/^\\s*#\\s*undef\\s+SPEAKER\\b/m.test(r.content));
            return;
          } catch {}
        }
        if (!dead) setSpeakerEnabled(null);
      } catch { if (!dead) setSpeakerEnabled(null); }
    }
    if (currentProject?.localProjectPath) detect();
    return () => { dead = true; };
  }, [currentProject?.localProjectPath, currentProject?.updatedDate]);

  function setRow(index, patch) { setRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r)); }
  function addRow(note = "C5") { setRows(prev => [...prev, { note, duration: 150 }]); setSelected(rows.length); }
  function removeRow(i) { setRows(prev => prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)); setSelected(Math.max(0, Math.min(i, rows.length - 2))); }
  function reset() { setRows(STARTER); setSelected(0); setStatus(""); }

  function stop() { stopRef.current = true; setPlaying(false); if (audioRef.current) { try { audioRef.current.close(); } catch {} audioRef.current = null; } }


  async function importMidi(file) {
    if (!file) return;
    setStatus("Lecture du fichier MIDI…");
    try {
      const parsed = parseMidi(await file.arrayBuffer());
      const usable = parsed.rows.filter(r => r.note || r.duration > 0);
      if (!usable.length) throw new Error("Aucune séquence exploitable");
      setRows(usable); setSelected(0); setMidiName(file.name);
      setStatus(`✓ MIDI importé : ${file.name} · ${usable.length} événements · ${parsed.tracks} piste(s). Les accords sont réduits en mélodie monophonique.`);
    } catch (e) { setStatus(`⚠ Import MIDI : ${e.message}`); }
  }
  function exportMidi() {
    download("melodie-marlin.mid", makeMidi(rows), "audio/midi");
  }

  async function preview() {
    stop(); stopRef.current = false; setPlaying(true);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { setStatus("⚠ Prévisualisation audio indisponible dans ce navigateur."); setPlaying(false); return; }
    const ctx = new AudioCtx(); audioRef.current = ctx;
    try {
      for (const r of rows) {
        if (stopRef.current) break;
        const duration = Math.max(0.02, r.duration / 1000 / tempo);
        if (r.note) {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.type = "square"; osc.frequency.value = NOTES[r.note]; gain.gain.value = volume;
          osc.connect(gain); gain.connect(ctx.destination); const now = ctx.currentTime;
          osc.start(now); osc.stop(now + duration); await new Promise(res => setTimeout(res, duration * 1000));
        } else await new Promise(res => setTimeout(res, duration * 1000));
      }
    } finally { try { await ctx.close(); } catch {} audioRef.current = null; setPlaying(false); }
  }

  function setEventRows(id, nextRows) { setEvents(prev => ({ ...prev, [id]: nextRows })); }
  function copyEvent(id) {
    const text = eventCommands(events[id] || []);
    navigator.clipboard?.writeText(text).then(() => setStatus(`✓ G-code ${EVENT_DEFS.find(e => e.id === id)?.label || id} copié.`)).catch(() => setStatus("⚠ Impossible de copier automatiquement."));
  }
  function applyCurrentToEvent() { setEventRows(activeEvent, rows.map(r => ({ ...r }))); setStatus(`✓ Mélodie actuelle affectée à « ${EVENT_DEFS.find(e => e.id === activeEvent)?.label} ».`); }
  function loadEvent(id) { setActiveEvent(id); setRows((events[id] || []).map(r => ({ ...r }))); setSelected(0); setStatus(`Édition de l'événement « ${EVENT_DEFS.find(e => e.id === id)?.label} ».`); }
  function resetEvents() { setEvents(Object.fromEntries(EVENT_DEFS.map(e => [e.id, e.defaultRows.map(r => ({ ...r }))]))); setActiveEvent("startup"); setStatus("✓ Sonneries d'événements réinitialisées."); }
  function downloadEvents() { download("marlin-event-sounds.gcode", eventBundle(events)); }

  async function testPrinter() {
    if (speakerEnabled === false) { setStatus("⚠ SPEAKER n'est pas activé dans la configuration."); return; }
    try {
      await agentApi.serialSend(`M300 S${Math.round(NOTES[rows[selected]?.note || "A4"])} P${Math.round(rows[selected]?.duration || 200)}`);
      setStatus("✓ Ton envoyé à l'imprimante.");
    } catch (e) { setStatus(`⚠ Test imprimante impossible : ${e.message}`); }
  }

  async function sendGeneratedGcode() {
    if (!rows.length) { setStatus("⚠ La séquence musicale est vide."); return; }
    try {
      const result = await agentApi.serialSendText(gcode(rows), 20);
      setStatus(`✓ G-code musical envoyé : ${result.lines_sent} lignes.`);
    } catch (e) { setStatus(`⚠ Envoi G-code musical : ${e.message}`); }
  }

  async function saveToProject() {
    if (!currentProject?.localProjectPath) { setStatus("⚠ Aucun projet Marlin local ouvert."); return; }
    setBusy(true); setStatus("");
    try {
      let target;
      let content;
      try { content = (await agentApi.readConfiguration("Config.h")).content; target = "Config.h"; }
      catch { content = (await agentApi.readConfiguration("Configuration.h")).content; target = "Configuration.h"; }
      content = upsertDefine(content, "SPEAKER", "", true);
      content = upsertDefine(content, "STARTUP_TUNE", `{ ${tonePairs(rows).join(", ")} }`, true);
      await agentApi.writeConfiguration(target, content, undefined);
      setConfigFile(target); setSpeakerEnabled(true); setStatus(`✓ SPEAKER + STARTUP_TUNE enregistrés dans ${target}.`);
    } catch (e) { setStatus(`⚠ ${e.message}`); } finally { setBusy(false); }
  }

  async function saveStartupAndEvents() {
    if (!currentProject?.localProjectPath) { setStatus("⚠ Aucun projet Marlin local ouvert."); return; }
    setBusy(true); setStatus("");
    try {
      let target, content;
      try { content = (await agentApi.readConfiguration("Config.h")).content; target = "Config.h"; }
      catch { content = (await agentApi.readConfiguration("Configuration.h")).content; target = "Configuration.h"; }
      content = upsertDefine(content, "SPEAKER", "", true);
      if (eventEnabled.startup) content = upsertDefine(content, "STARTUP_TUNE", `{ ${tonePairs(events.startup || STARTER).join(", ")} }`, true);
      await agentApi.writeConfiguration(target, content, undefined);
      setConfigFile(target); setSpeakerEnabled(true);
      setStatus(`✓ SPEAKER + ${eventEnabled.startup ? "STARTUP_TUNE" : "Speaker"} enregistrés dans ${target}. Les autres événements sont exportés en G-code pour le slicer / hôte.`);
    } catch (e) { setStatus(`⚠ ${e.message}`); } finally { setBusy(false); }
  }

  function download(name, content, type = "text/plain;charset=utf-8") {
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([content], { type }));
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return <div className="h-full overflow-auto p-4 md:p-6">
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-xl font-semibold flex items-center gap-2"><Music2 className="w-5 h-5 text-primary" /> Studio Sonnerie / Speaker</h1><p className="text-sm text-muted-foreground mt-1">Crée des mélodies pour le speaker Marlin, prévisualise-les et génère M300 ou STARTUP_TUNE.</p></div>
        <div className="flex gap-2"><button onClick={reset} className="px-3 py-2 border rounded-md text-sm flex gap-2 items-center"><RotateCcw className="w-4 h-4"/>Réinitialiser</button><button onClick={playing ? stop : preview} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm flex gap-2 items-center">{playing ? <Square className="w-4 h-4"/> : <Play className="w-4 h-4"/>}{playing ? "Arrêter" : "Écouter"}</button></div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <section className="border rounded-xl bg-card overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between"><div className="font-medium">Séquence · {rows.length} notes · {total} ms</div><button onClick={() => addRow()} className="px-2.5 py-1.5 rounded-md border text-sm flex items-center gap-1"><Plus className="w-4 h-4"/>Note</button></div>
          <div className="divide-y max-h-[55vh] overflow-auto">
            {rows.map((r, i) => <div key={i} className={cn("p-2.5 flex items-center gap-2", selected === i && "bg-primary/5")} onClick={() => setSelected(i)}>
              <span className="w-7 text-xs text-muted-foreground">{i + 1}</span>
              <select value={r.note || "REST"} onChange={e => setRow(i, { note: e.target.value === "REST" ? null : e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm flex-1"><option value="REST">Silence / pause</option>{NOTE_NAMES.map(n => <option key={n} value={n}>{n} · {Math.round(NOTES[n])} Hz</option>)}</select>
              <select value={r.duration} onChange={e => setRow(i, { duration: Number(e.target.value) })} className="h-9 rounded-md border bg-background px-2 text-sm w-28">{DURATIONS.map(d => <option key={d} value={d}>{d} ms</option>)}</select>
              <button onClick={() => removeRow(i)} className="p-2 text-muted-foreground hover:text-destructive" title="Supprimer"><Trash2 className="w-4 h-4"/></button>
            </div>)}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border rounded-xl bg-card p-4 space-y-3">
            <div className="font-medium flex items-center gap-2"><Music2 className="w-4 h-4"/>Fichier MIDI</div>
            <label className="w-full px-3 py-2 border rounded-md text-sm flex items-center justify-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4"/>Importer un .mid / .midi
              <input type="file" accept=".mid,.midi,audio/midi,audio/x-midi" className="hidden" onChange={e => { importMidi(e.target.files?.[0]); e.target.value = ""; }}/>
            </label>
            <button onClick={exportMidi} className="w-full px-3 py-2 border rounded-md text-sm flex items-center justify-center gap-2"><Download className="w-4 h-4"/>Générer un fichier MIDI</button>
            {midiName && <div className="text-xs text-muted-foreground truncate" title={midiName}>Source : {midiName}</div>}
            <div className="text-[11px] text-muted-foreground">Import : MIDI Standard Format 0/1. Les accords sont convertis en ligne mélodique (note la plus aiguë au démarrage).</div>
          </section>
          <section className="border rounded-xl bg-card p-4 space-y-3">
            <div className="font-medium flex items-center gap-2"><Volume2 className="w-4 h-4"/>Paramètres audio</div>
            <label className="text-sm block">Vitesse <input type="range" min="0.5" max="2" step="0.05" value={tempo} onChange={e => setTempo(Number(e.target.value))} className="w-full"/><span className="text-xs text-muted-foreground">{tempo.toFixed(2)}×</span></label>
            <label className="text-sm block">Volume aperçu <input type="range" min="0.01" max="0.15" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full"/></label>
          </section>
          <section className="border rounded-xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2"><div className="font-medium flex items-center gap-2"><Music2 className="w-4 h-4"/>Événements sonores</div><button onClick={resetEvents} className="text-xs underline">Réinitialiser</button></div>
            <p className="text-xs text-muted-foreground">Associe une mélodie à chaque événement de l'imprimante. Les événements de début/fin sont des snippets G-code ; l'erreur dépend de l'hôte, et l'extinction sonore n'est possible qu'avant une extinction logicielle.</p>
            <div className="space-y-1.5">
              {EVENT_DEFS.map(e => { const Icon=e.icon; return <div key={e.id} className="flex items-center gap-2">
                <button onClick={() => loadEvent(e.id)} className={cn("flex-1 text-left px-2.5 py-2 border rounded-md text-sm flex items-center gap-2", activeEvent === e.id && "border-primary bg-primary/5")}><Icon className="w-4 h-4"/><span>{e.label}</span><span className="ml-auto text-[11px] text-muted-foreground">{(events[e.id] || []).length} notes</span></button>
                <input type="checkbox" checked={!!eventEnabled[e.id]} onChange={ev => setEventEnabled(prev => ({...prev, [e.id]: ev.target.checked}))} title="Activer l'événement" />
              </div>; })}
            </div>
            <div className="flex gap-2"><button onClick={applyCurrentToEvent} className="flex-1 px-2.5 py-2 border rounded-md text-xs">Affecter la mélodie actuelle</button><button onClick={() => copyEvent(activeEvent)} className="px-2.5 py-2 border rounded-md text-xs flex items-center gap-1"><Copy className="w-3.5 h-3.5"/>Copier</button></div>
            <button onClick={downloadEvents} className="w-full px-3 py-2 border rounded-md text-sm flex items-center justify-center gap-2"><Download className="w-4 h-4"/>Exporter le pack d'événements</button>
          </section>
          <section className="border rounded-xl bg-card p-4 space-y-3">
            <div className="font-medium flex items-center gap-2"><Radio className="w-4 h-4"/>Marlin</div>
            {speakerEnabled === true && <div className="text-sm text-emerald-600 flex gap-2"><CheckCircle2 className="w-4 h-4"/>SPEAKER activé · {configFile}</div>}
            {speakerEnabled === false && <div className="text-sm text-amber-600 flex gap-2"><AlertTriangle className="w-4 h-4"/>SPEAKER non activé</div>}
            {speakerEnabled == null && <div className="text-sm text-muted-foreground">Projet local non détecté ou configuration indisponible.</div>}
            <button disabled={busy} onClick={saveStartupAndEvents} className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4"/>{busy ? "Enregistrement…" : "Activer + intégrer le son de démarrage"}</button>
            <button onClick={testPrinter} className="w-full px-3 py-2 border rounded-md text-sm flex items-center justify-center gap-2"><Radio className="w-4 h-4"/>Tester la note sur l'imprimante</button>
            <button onClick={sendGeneratedGcode} className="w-full px-3 py-2 border rounded-md text-sm flex items-center justify-center gap-2"><SendIcon/>Envoyer toute la musique en G-code</button>
          </section>
          <section className="border rounded-xl bg-card p-4 space-y-2">
            <div className="font-medium">Exports</div>
            <button onClick={() => download("marlin-sonnerie.gcode", gcode(rows))} className="w-full px-3 py-2 border rounded-md text-sm flex items-center gap-2"><Download className="w-4 h-4"/>Générer G-code M300</button>
            <button onClick={() => download("STARTUP_TUNE.txt", startupTune(rows))} className="w-full px-3 py-2 border rounded-md text-sm flex items-center gap-2"><Download className="w-4 h-4"/>Exporter STARTUP_TUNE</button>
            <button onClick={() => download("melodie-marlin.json", JSON.stringify({ version: 1, rows }, null, 2))} className="w-full px-3 py-2 border rounded-md text-sm flex items-center gap-2"><Download className="w-4 h-4"/>Exporter projet JSON</button>
          </section>
        </aside>
      </div>
      {status && <div className="border rounded-lg px-3 py-2 text-sm bg-card">{status}</div>}
      <div className="border rounded-lg p-3 bg-muted/30 text-xs text-muted-foreground space-y-1"><div><strong>Marlin :</strong> M300 utilise <code>S</code> pour la fréquence en Hz et <code>P</code> pour la durée en ms. <code>STARTUP_TUNE</code> encode des paires fréquence/durée et utilise 0 Hz pour les silences.</div><div><strong>Intégration :</strong> le démarrage est intégré au firmware. Le début et la fin d'impression sont prévus pour le Start/End G-code du slicer. L'erreur doit être déclenchée par l'hôte qui reçoit l'erreur Marlin. Pour l'extinction logicielle, jouer la mélodie puis envoyer <code>M81</code>. Une coupure physique ne peut pas jouer une musique après disparition de l'alimentation.</div></div>
    </div>
  </div>;
}
