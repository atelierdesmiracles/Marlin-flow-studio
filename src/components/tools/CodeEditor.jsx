import React, { useEffect, useMemo, useState } from "react";
import { useProject, parseProject } from "@/lib/projectStore";
import { cn } from "@/lib/utils";
import { agentApi } from "@/lib/localAgent";
import { FileCode2, Copy, Download, Save, RefreshCw, HardDrive, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const EDITABLE_DEFAULTS = ["Configuration.h", "Configuration_adv.h", "platformio.ini"];

export default function CodeEditor() {
  const { t } = useI18n();
  const { currentProject, updateProject } = useProject();
  const localFiles = currentProject ? Object.keys(currentProject.files || {}) : [];
  const files = Array.from(new Set([...EDITABLE_DEFAULTS, ...localFiles])).filter(Boolean);
  const [active, setActive] = useState(files[0]);
  const [content, setContent] = useState("");
  const [sha, setSha] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const fallbackContent = useMemo(() => {
    if (!currentProject || !active) return "";
    return currentProject.files?.[active] || "";
  }, [currentProject, active]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setStatus("");
      if (!currentProject || !active) return;
      try {
        setLoading(true);
        const data = await agentApi.readFile(active);
        if (!alive) return;
        setContent(data.content || "");
        setSha(data.sha256 || null);
        setStatus("pc");
      } catch {
        if (!alive) return;
        setContent(fallbackContent);
        setSha(null);
        setStatus("local");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [active, currentProject?.id, fallbackContent]);

  if (!currentProject) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t("editor.noneProject")}</div>;

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const result = active === "Configuration.h" || active === "Configuration_adv.h"
        ? await agentApi.writeConfiguration(active, content, sha)
        : await agentApi.writeFile(active, content, sha, true);
      setSha(result.sha256 || null);
      updateProject(parseProject({
        ...currentProject,
        files: { ...(currentProject.files || {}), [active]: content },
        localProjectPath: currentProject.localProjectPath,
        localHashes: { ...(currentProject.localHashes || {}), ...(result.sha256 ? { [active]: result.sha256 } : {}) },
        updatedDate: new Date().toISOString(),
      }));
      setStatus("pc");
    } catch (e) {
      setStatus(e.message || t("editor.conflict"));
    } finally {
      setSaving(false);
    }
  }

  async function reload() {
    setLoading(true);
    setStatus("");
    try {
      const data = await agentApi.readFile(active);
      setContent(data.content || "");
      setSha(data.sha256 || null);
      setStatus("pc");
    } catch (e) {
      setStatus(e.message || t("editor.reading"));
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = active.split("/").pop() || "marlin.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const lines = content.split("\n");

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center border-b border-border overflow-x-auto shrink-0">
        {files.map((f) => (
          <button key={f} onClick={() => setActive(f)} className={cn("flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border whitespace-nowrap", active === f ? "bg-background text-foreground font-medium" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
            <FileCode2 className="w-3.5 h-3.5" /> {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 px-2 shrink-0">
          <span className="hidden xl:inline text-[10px] text-muted-foreground mr-2">{status === "local" ? t("editor.statusLocal") : status === "pc" ? t("editor.statusPc") : (loading ? t("editor.reading") : status || "")}</span>
          <button onClick={reload} disabled={loading || saving} className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-40"><RefreshCw className="w-3.5 h-3.5" /> {t("editor.reload")}</button>
          <button onClick={save} disabled={saving || loading} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-40"><Save className="w-3.5 h-3.5" /> {saving ? t("editor.saving") : t("editor.save")}</button>
          <button onClick={copy} className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent"><Copy className="w-3.5 h-3.5" /> {copied ? t("editor.copied") : t("editor.copy")}</button>
          <button onClick={download} className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent"><Download className="w-3.5 h-3.5" /> {t("editor.download")}</button>
        </div>
      </div>

      <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex items-center gap-2 text-[11px] text-muted-foreground">
        <HardDrive className="w-3.5 h-3.5" />
        <span>{currentProject.localProjectPath || t("editor.noLocalPath")}</span>
        {status === "local" && <span className="inline-flex items-center gap-1 text-amber-600"><ShieldAlert className="w-3.5 h-3.5" /> {t("editor.offline")}</span>}
      </div>

      <div className="flex-1 overflow-auto bg-muted/30 min-h-0">
        <div className="flex min-w-max">
          <div className="select-none text-right text-muted-foreground py-2 px-3 bg-muted/50 border-r border-border shrink-0 font-mono text-xs">
            {lines.map((_, i) => <div key={i} className="leading-5">{i + 1}</div>)}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="min-w-[900px] w-[calc(100vw-300px)] min-h-full py-2 px-3 leading-5 font-mono text-xs bg-transparent outline-none resize-none whitespace-pre"
            aria-label={`${t("editor.title")} ${active}`}
          />
        </div>
      </div>
    </div>
  );
}
