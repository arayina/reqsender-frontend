"use client";

import { useState } from "react";

import {
  checkProxyHealth,
  deleteProxy,
  updateProxy,
  type ProxyHealthResponse,
  type ProxyItem,
} from "@/lib/api";

import { ProxyForm } from "@/components/proxy-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

type Props = {
  initialProxies: ProxyItem[];
};

type HealthState = {
  status: "idle" | "testing" | "healthy" | "unhealthy";
  result?: ProxyHealthResponse;
};

export function ProxyList({ initialProxies }: Props) {
  const [proxies, setProxies] = useState(initialProxies);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);

  const [editingProxy, setEditingProxy] = useState<ProxyItem | null>(null);

  const [healthStates, setHealthStates] = useState<Record<string, HealthState>>(
    {},
  );

  async function handleDelete(id: string) {
    setDeletingId(id);

    try {
      await deleteProxy(id);

      setProxies((current) => current.filter((proxy) => proxy.id !== id));

      setHealthStates((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleHealthCheck(proxy: ProxyItem) {
    setHealthStates((current) => ({
      ...current,
      [proxy.id]: {
        status: "testing",
      },
    }));

    try {
      const result = await checkProxyHealth(proxy.id);

      setHealthStates((current) => ({
        ...current,
        [proxy.id]: {
          status: result.healthy ? "healthy" : "unhealthy",
          result,
        },
      }));
    } catch (error) {
      setHealthStates((current) => ({
        ...current,
        [proxy.id]: {
          status: "unhealthy",
          result: {
            healthy: false,
            status_code: null,
            latency_ms: 0,
            error:
              error instanceof Error ? error.message : "Health check failed",
          },
        },
      }));
    }
  }

  function handleCreated(proxy: ProxyItem) {
    setProxies((current) => [...current, proxy]);
    setAddOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            + Add Proxy
          </DialogTrigger>

          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle>Add Proxy</DialogTitle>
            </DialogHeader>

            <ProxyForm
              onSaved={handleCreated}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(editingProxy)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingProxy(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle>Edit Proxy</DialogTitle>
            </DialogHeader>

            {editingProxy && (
              <ProxyForm
                proxy={editingProxy}
                onSaved={(updatedProxy) => {
                  setProxies((current) =>
                    current.map((item) =>
                      item.id === updatedProxy.id ? updatedProxy : item,
                    ),
                  );

                  setEditingProxy(null);
                }}
                onCancel={() => {
                  setEditingProxy(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Host</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {proxies.map((proxy) => {
              const health = healthStates[proxy.id];

              return (
                <TableRow key={proxy.id}>
                  <TableCell>{proxy.host}</TableCell>

                  <TableCell>{proxy.port}</TableCell>

                  <TableCell className="uppercase">{proxy.protocol}</TableCell>

                  <TableCell>{proxy.username || "-"}</TableCell>

                  <TableCell>
                    <Badge variant={proxy.enabled ? "default" : "secondary"}>
                      {proxy.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {!health || health.status === "idle" ? (
                      <span className="text-muted-foreground">Not tested</span>
                    ) : health.status === "testing" ? (
                      <Badge variant="secondary">Checking...</Badge>
                    ) : health.status === "healthy" ? (
                      <div className="flex items-center gap-2">
                        <Badge>Healthy</Badge>

                        <span className="text-xs text-muted-foreground">
                          {health.result?.latency_ms} ms
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="destructive">Unhealthy</Badge>

                        {health.result?.error && (
                          <div className="max-w-62.5 truncate text-xs text-muted-foreground">
                            {health.result.error}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={health?.status === "testing"}
                        onClick={() => handleHealthCheck(proxy)}
                      >
                        {health?.status === "testing" ? "Checking..." : "Test"}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingProxy(proxy);
                        }}
                      >
                        Edit
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const updated = await updateProxy(proxy.id, {
                            enabled: !proxy.enabled,
                          });

                          setProxies((current) =>
                            current.map((item) =>
                              item.id === updated.id ? updated : item,
                            ),
                          );
                        }}
                      >
                        {proxy.enabled ? "Disable" : "Enable"}
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === proxy.id}
                        onClick={() => handleDelete(proxy.id)}
                      >
                        {deletingId === proxy.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {proxies.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No proxies found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
