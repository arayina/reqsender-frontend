"use client";

import { useState } from "react";

import { deleteProxy, updateProxy, type ProxyItem } from "@/lib/api";

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

export function ProxyList({ initialProxies }: Props) {
  const [proxies, setProxies] = useState(initialProxies);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyItem | null>(null);
  async function handleDelete(id: string) {
    setDeletingId(id);

    try {
      await deleteProxy(id);

      setProxies((current) => current.filter((proxy) => proxy.id !== id));
    } finally {
      setDeletingId(null);
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
          <DialogTrigger>
            <Button>+ Add Proxy</Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
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
          <DialogContent className="sm:max-w-[500px]">
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
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {proxies.map((proxy) => (
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

                <TableCell className="text-center">
                  <div className="flex justify-end gap-2">
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
            ))}

            {proxies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
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
