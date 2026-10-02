import React from "react";
import { LayoutDashboard, Settings, GitCompareArrows, History, Camera, Calculator, Terminal, BookOpen, FileCode2, Image, Monitor, Music2, Activity, Crosshair, ChevronLeft, ChevronRight, Cpu, Globe, FolderOpen, Thermometer, Hammer, Printer, ArrowRightLeft, GitBranch, Stethoscope, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { STUDIO_LIST } from "@/lib/studioOrder.js";

// Numéro d'étape (voir studioOrder.js) affiché à droite des 8 Studios
// épinglés en accès rapide, pour rester cohérent avec le catalogue complet.
const pinnedStudioNumber = (id) => STUDIO_LIST.find((s) => s.id === id)?.number;

const NAV = [
  { id: "projects", label: "Accueil / Projets", icon: FolderOpen },
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "studios", label: "Studios", icon: Cpu },
  { id: "config", label: "Configuration", icon: Settings },
  { id: "doctor", label: "Marlin Doctor", icon: Stethoscope },
  { id: "diff", label: "Comparateur", icon: GitCompareArrows },
  { id: "history", label: "Historique", icon: History },
  { id: "snapshots", label: "Snapshots", icon: Camera },
  { id: "printer", label: "Console imprimante", icon: Printer },
  { id: "gcode", label: "G-code", icon: Terminal },
  { id: "code", label: "Éditeur code", icon: FileCode2 },
  { id: "calculators", label: "Calculateurs", icon: Calculator },
  { id: "docs", label: "Documentation", icon: BookOpen },
  // Accès rapide, dans l'ordre logique de configuration (voir studioOrder.js) :
  // Machine (n°1) → Probe & Endstop (n°17) → PID (n°14) → Vibration (n°25)
  // → Display (n°26) → Bootscreen (n°27) → Speaker (n°28) → Wi-Fi.
  { id: "machine", label: "Machine Studio", icon: Cpu },
  { id: "probe-endstop", label: "Probe & Endstop Studio", icon: Crosshair },
  { id: "pid", label: "PID Studio", icon: Thermometer },
  { id: "vibration", label: "Vibration Studio", icon: Activity },
  { id: "display", label: "Display Studio", icon: Monitor },
  { id: "bootscreen", label: "Bootscreen Studio", icon: Image },
  { id: "mks-tft", label: "MKS TFT Studio", icon: Image },
  { id: "speaker", label: "Speaker Studio", icon: Music2 },
  { id: "wifi", label: "Wi-Fi Studio", icon: Wifi },
  { id: "migration", label: "Import / Migration", icon: ArrowRightLeft },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "agent-build", label: "Agent & Build", icon: Hammer },
  { id: "browser", label: "Navigateur", icon: Globe },
  { id: "settings", label: "Paramètres", icon: Settings },
]

export default function Sidebar({ view, setView, collapsed, setCollapsed, modifiedCount }) {
  const { t } = useI18n();
  const labels = {
    projects:t("nav.projects"), dashboard:t("nav.dashboard"), studios: "Studios", config:t("nav.config"), doctor:t("nav.doctor"), diff:t("nav.diff"),
    history:t("nav.history"), snapshots:t("nav.snapshots"), printer:t("nav.printer"), gcode:t("nav.gcode"), code:t("nav.code"), wifi: "Wi-Fi Studio", "mks-tft": "MKS TFT Studio",
    calculators:t("nav.calculators"), docs:t("nav.docs"), bootscreen:t("nav.bootscreen"), display: "Display Studio", speaker:t("nav.speaker"), vibration:t("nav.vibration"), "probe-endstop": "Probe & Endstop Studio", machine: "Machine Studio", pid: "PID Studio",
    migration:t("nav.migration"), git:t("nav.git"), "agent-build":t("nav.agentBuild"), browser:t("nav.browser"), settings:t("nav.settings")
  };
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
            <div className="text-[10px] text-muted-foreground truncate">{t("version")}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          const badge = item.id === "config" ? modifiedCount : null;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors group relative",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              title={collapsed ? (labels[item.id] || item.label) : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left truncate">{labels[item.id] || item.label}</span>}
              {!collapsed && pinnedStudioNumber(item.id) && (
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{pinnedStudioNumber(item.id)}</span>
              )}
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
