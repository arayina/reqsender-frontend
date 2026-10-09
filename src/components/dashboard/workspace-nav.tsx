"use client";

import { Activity, BarChart3, Server } from "lucide-react";

type WorkspaceView = "requests" | "analytics" | "proxies";

type WorkspaceNavProps = {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
};

export function WorkspaceNav({
  activeView,
  onViewChange,
}: WorkspaceNavProps) {
  const buttonClass = (active: boolean) =>
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition " +
    (active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-muted hover:text-foreground");

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border bg-card/70 p-1.5">
      <button
        type="button"
        onClick={() => onViewChange("requests")}
        className={buttonClass(activeView === "requests")}
      >
        <Activity className="size-4" />
        Execution Console
      </button>

      <button
        type="button"
        onClick={() => onViewChange("analytics")}
        className={buttonClass(activeView === "analytics")}
      >
        <BarChart3 className="size-4" />
        Analytics
      </button>

      <button
        type="button"
        onClick={() => onViewChange("proxies")}
        className={buttonClass(activeView === "proxies")}
      >
        <Server className="size-4" />
        Proxies
      </button>

      <span className="ml-auto hidden px-3 text-[11px] text-muted-foreground md:block">
        Targets, execution analytics, and proxy infrastructure
      </span>
    </nav>
  );
}
