import React, { useEffect, useRef, useState } from "react";
import { useProject, parseProject } from "@/lib/projectStore";
import { X, FolderOpen, CheckCircle2, AlertCircle, FileCode2, FileArchive } from "lucide-react";

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Impossible de lire ${file.name}`));
    reader.readAsText(file);
  });
}

function buildProject(files) {
  const byName = new Map(files.map(f => [f.name, f]));
  const main = byName.get("Configuration.h");
  if (!main) throw new Error("Configuration.h est obligatoire.");
  return Promise.all([
    readText(main),
    byName.has("Configuration_adv.h") ? readText(byName.get("Configuration_adv.h")) : Promise.resolve("")
  ]).then(([configuration, advanced]) => {
    const now = new Date().toISOString();
    const path = main.webkitRelativePath || main.name;
    const folder = path.split("/").slice(0, -1).join("/");
    const project = {
      id: `proj_${Date.now()}`,
      name: folder.split("/").filter(Boolean).pop() || "Projet Marlin local",
      description: "Projet Marlin importé depuis le disque local",
      manufacturer: "",
      model: "",
      board: "",
      marlinVersion: "inconnue",
      configVersion: "1.0.0",
      author: "Moi",
      tags: ["local"],
      localProjectPath: folder,
      createdDate: now,
      updatedDate: now,
      files: {
        "Configuration.h": configuration,
        ...(advanced ? { "Configuration_adv.h": advanced } : {})
      }
    };
    return parseProject(project);
  });
}

export default function ImportMarlinModal({ open, onClose, onCreated }) {
  const { addProject, selectProject } = useProject();
  const inputRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedCount(0); setFiles([]); setError(null); setCreating(false);
    }
  }, [open]);

  async function create() {
    setCreating(true); setError(null);
    try {
      const project = await buildProject(files);
      addProject(project);
      selectProject(project.id);
      onCreated?.(project);
      onClose();
    } catch (e) {
      setError(e.message || "Import local impossible.");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-popover border border-border rounded-lg p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Importer un projet Marlin local</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Sélectionne le dossier du firmware Marlin. Le studio recherche Configuration.h et Configuration_adv.h sur le disque, sans serveur cloud.</p>
        <input ref={inputRef} type="file" webkitdirectory="true" directory="true" multiple className="hidden" onChange={e => { const list = Array.from(e.target.files || []); setFiles(list); setSelectedCount(list.length); setError(null); }} />
        <button onClick={() => inputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 rounded-md border border-dashed border-border hover:bg-accent text-sm"><FolderOpen className="w-4 h-4" /> Choisir le dossier Marlin</button>
        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><FileCode2 className="w-3.5 h-3.5" /> Configuration.h {files.some(f => f.name === "Configuration.h") ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : null}</div>
          <div className="flex items-center gap-2"><FileArchive className="w-3.5 h-3.5" /> Configuration_adv.h {files.some(f => f.name === "Configuration_adv.h") ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : null}</div>
          <div className="text-muted-foreground">{selectedCount ? `${selectedCount} fichiers sélectionnés` : "Aucun dossier sélectionné"}</div>
        </div>
        {error && <div className="mt-3 flex items-center gap-2 p-2 rounded bg-red-500/10 text-red-600 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded border border-border hover:bg-accent">Annuler</button>
          <button onClick={create} disabled={creating || !files.some(f => f.name === "Configuration.h")} className="flex-1 py-2 text-sm rounded bg-primary text-primary-foreground disabled:opacity-40">{creating ? "Import…" : "Importer localement"}</button>
        </div>
      </div>
    </div>
  );
}
