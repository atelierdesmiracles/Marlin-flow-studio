import React, { useState, useEffect } from "react";
import { Search, Command, Settings, LayoutDashboard, GitCompareArrows, History, Camera, Calculator, Terminal, BookOpen, ShieldCheck, FileCode2, Image, Music2, Activity, ChevronLeft, ChevronRight, Cpu, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "config", label: "Configuration", icon: Settings },
  { id: "agent", label: "Agent local", icon: Activity },
  { id: "doctor", label: "Marlin Doctor", icon: ShieldCheck },
  { id: "browser", label: "Navigateur", icon: Globe },
  { id: "diff", label: "Comparateur", icon: GitCompareArrows },
  { id: "validation", label: "Validation", icon: ShieldCheck },
  { id: "history", label: "Historique", icon: History },
  { id: "snapshots", label: "Snapshots", icon: Camera },
  { id: "code", label: "Éditeur code", icon: FileCode2 },
  { id: "calculators", label: "Calculateurs", icon: Calculator },
  { id: "gcode", label: "G-code", icon: Terminal },
  { id: "docs", label: "Documentation", icon: BookOpen },
  { id: "bootscreen", label: "Bootscreen Studio", icon: Image },
  { id: "speaker", label: "Speaker Studio", icon: Music2 },
  { id: "vibration", label: "Vibration Studio", icon: Activity },
];

export default function Sidebar({ view, setView, collapsed, setCollapsed, modifiedCount, warningCount, errorCount }) {
  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className="flex items-center gap-2 px-3 h-12 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <Cpu className="w-5 h-5" />
        </div>
        {!collapsed && (
          <div className="leading-tight overflow-hidden">
            <div className="text-sm font-semibold truncate">Marlin Flow Studio</div>
            <div className="text-[10px] text-muted-foreground truncate">NG · v2.8.0 · 100% Local</div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          const badge = item.id === "config" ? modifiedCount : item.id === "validation" ? warningCount + errorCount : null;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors group relative",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 rounded-full min-w-[18px] text-center">{badge}</span>
              )}
              {collapsed && badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}