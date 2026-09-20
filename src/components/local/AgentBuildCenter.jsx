import React, { useState } from "react";
import { Activity, Hammer } from "lucide-react";
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

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="shrink-0 border-b border-border bg-card px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Espace système</div>
            <h1 className="text-xl font-semibold">Agent &amp; Build</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Un seul espace pour l’Agent local, PlatformIO, Build, Firmware, Upload et la console système.
            </p>
          </div>
        </div>
        <div className="flex gap-1 mt-4 -mb-px" role="tablist" aria-label="Agent et Build">
          <TabButton active={tab === "build"} onClick={() => setTab("build")} icon={Hammer}>
            Build &amp; Firmware
          </TabButton>
          <TabButton active={tab === "agent"} onClick={() => setTab("agent")} icon={Activity}>
            Agent local
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
