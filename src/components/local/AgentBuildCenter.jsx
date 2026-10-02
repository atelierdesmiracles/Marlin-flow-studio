import React, { useState } from "react";
import { Activity, Hammer } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LocalAgentPanel from "./LocalAgentPanel";
import BuildCenter from "./BuildCenter";

/**
 * Unified local operations workspace.
 *
 * Agent local and Build Center remain isolated internally so each keeps its
 * existing API/state logic, while the user sees one single navigation entry.
 */
export default function AgentBuildCenter({ ensureSaved }) {
  const [tab, setTab] = useState("build");
  const { t } = useI18n();

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="shrink-0 border-b border-border bg-card px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("agentBuild.kicker")}</div>
            <h1 className="text-xl font-semibold">{t("agentBuild.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("agentBuild.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex gap-1 mt-4 -mb-px" role="tablist" aria-label={t("agentBuild.title")}>
          <TabButton active={tab === "build"} onClick={() => setTab("build")} icon={Hammer}>
            {t("agentBuild.buildFirmware")}
          </TabButton>
          <TabButton active={tab === "agent"} onClick={() => setTab("agent")} icon={Activity}>
            {t("agentBuild.agent")}
          </TabButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "build" ? (
          <BuildCenter ensureSaved={ensureSaved} />
        ) : (
          <LocalAgentPanel />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors " +
        (active
          ? "border-primary text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40")
      }
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}
