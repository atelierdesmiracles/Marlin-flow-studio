import React, { useEffect, useRef, useState } from "react";
import { useProject, parseProject } from "@/lib/projectStore";
import { X, FolderOpen, FileCode2, FileText, CheckCircle2, AlertCircle } from "lucide-react";

function readText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error(`Impossible de lire ${file.name}`));
    r.readAsText(file);
  });
}

export default function ImportExampleConfig({ open, onClose, onCreated }) {
  const { addProject, selectProject } = useProject();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => { if (open) { setFiles([]); setError(null); setImporting(false); } }, [open]);

  async function doImport() {
    setImporting(true); setError(null);
    try {
      const main = files.find(f => f.name === "Configuration.h");
      if (!main) throw new Error("Configuration.h est obligatoire.");
      const adv = files.find(f => f.name === "Configuration_adv.h");
      const [configuration, advanced] = await Promise.all([readText(main), adv ? readText(adv) : Promise.resolve("")]);
      const now = new Date().toISOString();
      const name = main.webkitRelativePath?.split("/").slice(-2, -1)[0] || "Exemple Marlin local";
      const project = parseProject({
        id: `proj_${Date.now()}`, name,
        description: "Configuration Marlin locale importée depuis le disque",
        manufacturer: "", model: name, board: "", marlinVersion: "inconnue",
        configVersion: "1.0.0", author: "Moi", tags: ["example", "local"],
        createdDate: now, updatedDate: now,
        files: { "Configuration.h": configuration, ...(advanced ? { "Configuration_adv.h": advanced } : {}) }
      });
      addProject(project); selectProject(project.id); onCreated?.(project); onClose();
    } catch (e) { setError(e.message || "Import impossible."); }
    finally { setImporting(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-popover border border-border rounded-lg p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Exemple Marlin local</h2><button onClick={onClose}><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-muted-foreground mb-4">Sélectionne un dossier de configuration déjà présent sur ton PC. Le projet reste sur ce PC et aucune donnée n'est envoyée par cet import.</p>
        <input ref={inputRef} type="file" webkitdirectory="true" directory="true" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files || []))} />
        <button onClick={() => inputRef.current?.click()} className="w-full py-3 rounded-md border border-dashed hover:bg-accent text-sm">Choisir un dossier</button>
        <div className="mt-3 text-xs space-y-2">
          <div className="flex items-center gap-2"><FileCode2 className="w-3.5 h-3.5" /> Configuration.h {files.some(f => f.name === "Configuration.h") && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}</div>
          <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Configuration_adv.h {files.some(f => f.name === "Configuration_adv.h") && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}</div>
        </div>
        {error && <div className="mt-3 flex items-center gap-2 p-2 rounded bg-red-500/10 text-red-600 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="flex-1 py-2 text-sm rounded border">Annuler</button><button onClick={doImport} disabled={importing || !files.some(f => f.name === "Configuration.h")} className="flex-1 py-2 text-sm rounded bg-primary text-primary-foreground disabled:opacity-40">{importing ? "Import…" : "Importer"}</button></div>
      </div>
    </div>
  );
}
