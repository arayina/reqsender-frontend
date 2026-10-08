"use client";

import { useState } from "react";

import { deleteProxy, type ProxyItem } from "@/lib/api";

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
          <DialogTrigger asChild>
            <Button>+ Add Proxy</Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Proxy</DialogTitle>
            </DialogHeader>

            <ProxyForm
              onCreated={handleCreated}
              onCancel={() => setAddOpen(false)}
            />
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
              <TableHead className="text-right">Actions</TableHead>
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

                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletingId === proxy.id}
                    onClick={() => handleDelete(proxy.id)}
                  >
                    {deletingId === proxy.id ? "Deleting..." : "Delete"}
                  </Button>
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
