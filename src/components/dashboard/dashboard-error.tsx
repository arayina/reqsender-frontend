"use client";

import { X } from "lucide-react";

export function DashboardError({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="mb-5 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded p-1 hover:bg-destructive/10" title="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
