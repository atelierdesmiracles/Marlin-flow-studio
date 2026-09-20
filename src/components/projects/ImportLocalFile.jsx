import React, { useState, useRef, useEffect } from "react";
import { useProject, parseProject } from "@/lib/projectStore";
import { X, Upload, FileCode, FileJson, CheckCircle2, Trash2 } from "lucide-react";

export default function ImportLocalFile({ open, onClose }) {
  const { addProject, selectProject } = useProject();
  const [files, setFiles] = useState({});
  const [name, setName] = useState("");
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setFiles({});
      setName("");
      setMeta(null);
      setError("");
    }
  }, [open]);

  async function ingest(fileList) {
    setError("");
    const newFiles = {};
    let detectedMeta = null;
    for (const file of Array.from(fileList)) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".mcfproject") || lower.endsWith(".json")) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.files) {
            Object.assign(newFiles, data.files);
            detectedMeta = data.metadata || null;
          }
        } catch {
          setError(`Impossible de lire le fichier projet : ${file.name}`);
        }
      } else {
        const text = await file.text();
        newFiles[file.name] = text;
      }
    }
    setFiles((f) => ({ ...f, ...newFiles }));
    if (detectedMeta) {
      setMeta(detectedMeta);
      if (!name) setName(detectedMeta.name || "");
    } else if (!name && Object.keys(newFiles).length) {
      const first = Object.keys(newFiles)[0];
      setName(first.replace(/\.h$/, "").replace(/_/g, " "));
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) ingest(e.dataTransfer.files);
  }

  function removeFile(f) {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[f];
      return next;
    });
  }

  function create() {
    const fileNames = Object.keys(files);
    if (!fileNames.length) return;
    const proj = {
      id: `proj_${Date.now()}`,
      name: (name || "Import local").trim(),
      description: meta?.description || "",
      manufacturer: "",
      model: meta?.model || "",
      board: meta?.board || "",
      marlinVersion: meta?.marlinVersion || "2.1.x",
      configVersion: meta?.configVersion || "1.0.0",
      author: "Import local",
      tags: ["local"],
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      files,
    };
    addProject(proj);
    selectProject(proj.id);
    onClose();
  }

  if (!open) return null;
  const fileNames = Object.keys(files);
  const hasConfig = fileNames.some((f) => /Configuration\.h$/i.test(f));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-popover border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4" /> Importer depuis l'ordinateur</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
        >
          <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
          <div className="text-sm font-medium">Glissez vos fichiers ici ou cliquez pour parcourir</div>
          <div className="text-xs text-muted-foreground mt-1">Configuration.h, Configuration_adv.h, _Bootscreen.h ou projet .mcfproject</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".h,.hpp,.txt,.mcfproject,.json"
            className="hidden"
            onChange={(e) => { if (e.target.files.length) ingest(e.target.files); e.target.value = ""; }}
          />
        </div>

        {error && <div className="mt-3 text-sm text-destructive">{error}</div>}

        {fileNames.length > 0 && (
          <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">
            {fileNames.map((f) => (
              <div key={f} className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-card">
                {/\.h$/i.test(f) ? <FileCode className="w-4 h-4 text-muted-foreground" /> : <FileJson className="w-4 h-4 text-muted-foreground" />}
                <span className="font-mono text-sm flex-1 truncate">{f}</span>
                <span className="text-xs text-muted-foreground">{(files[f].length / 1024).toFixed(1)} Ko</span>
                <button onClick={(e) => { e.stopPropagation(); removeFile(f); }} className="p-1 rounded hover:bg-accent text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {hasConfig && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 px-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Configuration.h détectée
              </div>
            )}
          </div>
        )}

        {fileNames.length > 0 && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nom du projet</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-input bg-background" placeholder="Mon imprimante" />
            </div>
            <button onClick={create} disabled={!hasConfig && fileNames.length === 0} className="w-full py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
              Créer le projet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}