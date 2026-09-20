import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, HardDrive, RefreshCw, Save, X } from "lucide-react";
import { agentApi } from "@/lib/localAgent";

function formatBytes(value = 0) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} Mo`;
  return `${(value / 1024).toFixed(1)} Ko`;
}

export default function FirmwareArtifactDialog({ open, artifact, onClose }) {
  const [drives, setDrives] = useState([]);
  const [mount, setMount] = useState("");
  const [filename, setFilename] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refreshDrives() {
    setError("");
    try {
      const result = await agentApi.removableStorage();
      const next = result.drives || [];
      setDrives(next);
      setMount((previous) => next.some((d) => d.mount === previous) ? previous : (next[0]?.mount || ""));
    } catch (e) {
      setError(e.message || "Impossible de détecter les cartes mémoire.");
    }
  }

  useEffect(() => {
    if (!open || !artifact) return;
    setFilename(artifact.name || "firmware.bin");
    setOverwrite(false);
    setSuccess("");
    refreshDrives();
  }, [open, artifact?.path]);

  async function saveToCard() {
    if (!artifact || !mount) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await agentApi.saveArtifactToRemovable(artifact.path, mount, filename.trim() || artifact.name, overwrite);
      setSuccess(`Firmware enregistré : ${result.result?.destination || filename}`);
    } catch (e) {
      if (e.status === 409 && !overwrite) {
        setError("Ce fichier existe déjà sur la carte. Activez « Remplacer le fichier » pour l'écraser.");
      } else {
        setError(e.message || "Impossible d'enregistrer le firmware.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open || !artifact) return null;
  const selected = drives.find((d) => d.mount === mount);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><HardDrive className="h-5 w-5 text-blue-600" /> Firmware</h2>
            <p className="mt-1 text-xs text-slate-500">Enregistrez le firmware compilé directement sur une carte mémoire amovible.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-mono text-sm font-medium text-slate-900 break-all">{artifact.name}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{formatBytes(artifact.size)}</span>
              {artifact.environment && <span>Environnement : {artifact.environment}</span>}
              {artifact.extension && <span>{artifact.extension.toUpperCase()}</span>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-800">Carte mémoire détectée</label>
              <button onClick={refreshDrives} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Actualiser</button>
            </div>
            {drives.length ? (
              <select value={mount} onChange={(e) => setMount(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                {drives.map((d) => <option key={d.mount} value={d.mount}>{d.label} — {d.mount}{d.free_bytes ? ` · ${formatBytes(d.free_bytes)} libres` : ""}</option>)}
              </select>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">Aucune carte mémoire amovible détectée. Insérez la carte puis cliquez sur « Actualiser ».</div>
            )}
            {selected && <div className="mt-2 text-xs text-slate-500">Destination : <span className="font-mono">{selected.mount}</span></div>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">Nom sur la carte</label>
            <input value={filename} onChange={(e) => setFilename(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Remplacer le fichier s’il existe déjà</label>
          </div>

          {error && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" /> <span>{error}</span></div>}
          {success && <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" /> <span>{success}</span></div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Fermer</button>
          <button onClick={saveToCard} disabled={busy || !mount || !filename.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "Enregistrement…" : "Enregistrer sur la carte"}</button>
        </div>
      </div>
    </div>
  );
}
