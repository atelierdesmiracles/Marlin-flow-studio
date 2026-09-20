import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, XCircle, Wrench } from "lucide-react";
import { agentApi, pingAgent } from "@/lib/localAgent";
import { useProject } from "@/lib/projectStore";

const statusMeta = {
  ok: { icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "OK" },
  warning: { icon: AlertTriangle, cls: "text-amber-700 bg-amber-50 border-amber-200", label: "ATTENTION" },
  error: { icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200", label: "BLOQUANT" },
};

export default function MarlinDoctor() {
  const { currentProject } = useProject();
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const localPath = currentProject?.localProjectPath;
      if (localPath) {
        await agentApi.selectProject(localPath);
      }
      await pingAgent();
      const result = await agentApi.doctor();
      setReport(result);
      if (result?.success === false) setError(result.error || "Le moteur de diagnostic a échoué");
    }
    catch (e) {
      setError(e?.message || "Diagnostic impossible : vérifiez que l’Agent local est démarré");
    }
    finally { setBusy(false); }
  }, [currentProject?.localProjectPath]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="h-full overflow-y-auto p-6 bg-slate-50/40">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2 text-slate-900"><ShieldCheck className="w-5 h-5 text-blue-600" /> Marlin Doctor</h1>
            <p className="text-sm text-slate-500 mt-1">Diagnostic non destructif avant migration ou compilation.</p>
          </div>
          <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /> Analyser</button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-medium">Marlin Doctor indisponible</div>
            <div className="mt-1">{error}</div>
            <div className="mt-2 text-xs text-red-600">Vérifiez que l'Agent local écoute sur 127.0.0.1:38765 puis cliquez sur « Analyser ».</div>
          </div>
        )}

        {report && <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Projet analysé :</span> {report.project || "non sélectionné"}
          </div>
          <div className={`rounded-2xl border p-5 ${report.ready ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-center gap-3">
              {report.ready ? <CheckCircle2 className="w-8 h-8 text-emerald-600" /> : <XCircle className="w-8 h-8 text-red-600" />}
              <div><div className="font-semibold text-slate-900">{report.ready ? "Projet prêt pour la suite" : "Projet à corriger avant compilation"}</div><div className="text-sm text-slate-600">{report.errors} erreur(s) · {report.warnings} avertissement(s)</div></div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Summary title="Marlin" value={report.marlin?.version || "Inconnue"} />
            <Summary title="MOTHERBOARD" value={report.marlin?.motherboard || "Absent"} danger={!report.marlin?.motherboard} />
            <Summary title="Environnement" value={report.selected_environment || "Non sélectionné"} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2 font-semibold"><Wrench className="w-4 h-4" /> Contrôles</div>
            <div className="divide-y divide-slate-100">
              {(report.checks || []).map((check) => {
                const meta = statusMeta[check.status] || statusMeta.warning;
                const Icon = meta.icon;
                return <div key={check.key} className="p-4 flex gap-3 items-start">
                  <div className={`mt-0.5 rounded-lg border p-1.5 ${meta.cls}`}><Icon className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1"><div className="font-medium text-slate-900">{check.label}</div><div className="text-sm text-slate-500 break-words">{check.detail}</div>{check.fix && check.status !== "ok" && <div className="text-xs text-slate-600 mt-1">Action : {check.fix}</div>}</div>
                  <span className="text-[10px] font-semibold shrink-0">{meta.label}</span>
                </div>;
              })}
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}

function Summary({ title, value, danger }) {
  return <div className={`rounded-xl border bg-white p-4 ${danger ? "border-red-200" : "border-slate-200"}`}><div className="text-xs text-slate-500">{title}</div><div className={`mt-1 font-mono text-sm break-all ${danger ? "text-red-700" : "text-slate-900"}`}>{value}</div></div>;
}
