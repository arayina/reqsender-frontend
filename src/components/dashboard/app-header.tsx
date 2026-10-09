"use client";

import { RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppHeaderProps = { runningCount: number; onRefresh: () => void };

export function AppHeader({ runningCount, onRefresh }: AppHeaderProps) {
  return (
    <header className="mb-4 flex flex-col gap-4 rounded-2xl border bg-card/80 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Zap className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Requester</h1>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">Console</span>
          </div>
          <p className="text-xs text-muted-foreground">HTTP and browser execution workspace</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
          <span>System Online</span><span className="text-border">•</span>
          <span className="font-medium text-foreground">{runningCount} running</span>
        </div>
        <Button variant="outline" size="sm" className="border-border/80 bg-background/50" onClick={onRefresh}>
          <RefreshCw /> Refresh
        </Button>
      </div>
    </header>
  );
}
