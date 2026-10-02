import React, { useState } from "react";
import { useProject } from "@/lib/projectStore";
import { Camera, RotateCcw, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SnapshotsPanel() {
  const { state, currentProject, takeSnapshot, restoreSnapshot, deleteSnapshot } = useProject();
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const snaps = (state.snapshots[currentProject?.id] || []);

  if (!currentProject) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t("snapshot.noneProject")}</div>;

  function create() {
    if (!name.trim()) return;
    takeSnapshot(currentProject.id, name.trim());
    setName("");
    setMessage(t("snapshot.created"));
    window.setTimeout(() => setMessage(""), 2500);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Camera className="w-4 h-4" />
        <h2 className="text-sm font-semibold">{t("snapshot.title")}</h2>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder={t("snapshot.namePlaceholder")}
            className="flex-1 px-2 py-1.5 text-sm rounded border border-input bg-background"
          />
          <button onClick={create} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Créer
          </button>
        </div>
        <div className="text-xs text-muted-foreground">{t("snapshot.description")}</div>
        {message && <div className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />{message}</div>}
        <div className="space-y-2 pt-2">
          {snaps.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">{t("snapshot.empty")}</div>}
          {snaps.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded border border-border">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">{new Date(s.timestamp).toLocaleString()} · {s.parameters.length} {t("snapshot.parameters")}</div>
              </div>
              <button
                onClick={() => {
                  const ok = window.confirm(t("snapshot.confirmRestore").replace("{name}", s.name));
                  if (!ok) return;
                  restoreSnapshot(currentProject.id, s.id);
                  setMessage(t("snapshot.restored"));
                  window.setTimeout(() => setMessage(""), 5000);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                title={t("snapshot.restore")}
              >
                <RotateCcw className="w-3 h-3" /> {t("snapshot.restore")}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t("snapshot.confirmDelete").replace("{name}", s.name))) deleteSnapshot(currentProject.id, s.id);
                }}
                className="p-1.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-destructive"
                title={t("snapshot.delete")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}