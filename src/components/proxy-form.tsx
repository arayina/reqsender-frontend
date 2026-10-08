"use client";

import { FormEvent, useState } from "react";

import { createProxy, updateProxy, type ProxyItem } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  proxy?: ProxyItem;
  onSaved: (proxy: ProxyItem) => void;
  onCancel: () => void;
};

export function ProxyForm({ proxy, onSaved, onCancel }: Props) {
  const isEdit = Boolean(proxy);

  const [host, setHost] = useState(proxy?.host ?? "");
  const [port, setPort] = useState(proxy?.port?.toString() ?? "");
  const [protocol, setProtocol] = useState(proxy?.protocol ?? "http");
  const [username, setUsername] = useState(proxy?.username ?? "");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(proxy?.enabled ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    let savedProxy: ProxyItem;

    try {
      if (isEdit && proxy) {
        savedProxy = await updateProxy(proxy.id, {
          host,
          port: Number(port),
          protocol,
          username: username || undefined,
          ...(password ? { password } : {}),
          enabled,
        });
      } else {
        savedProxy = await createProxy({
          host,
          port: Number(port),
          protocol,
          username: username || undefined,
          password: password || undefined,
          enabled,
        });
      }
    } catch (error) {
      console.error("Proxy API error:", error);

      setError(isEdit ? "Failed to update proxy" : "Failed to create proxy");

      setLoading(false);
      return;
    }

    onSaved(savedProxy);

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="host">Host</Label>

        <Input
          id="host"
          value={host}
          onChange={(event) => setHost(event.target.value)}
          placeholder="127.0.0.1"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="port">Port</Label>

        <Input
          id="port"
          type="number"
          min={1}
          max={65535}
          value={port}
          onChange={(event) => setPort(event.target.value)}
          placeholder="8080"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="protocol">Protocol</Label>

        <select
          id="protocol"
          value={protocol}
          onChange={(event) => setProtocol(event.target.value)}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="http">HTTP</option>
          <option value="https">HTTPS</option>
          <option value="socks5">SOCKS5</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>

        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>

        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={
            isEdit ? "Leave empty to keep current password" : "Optional"
          }
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Enabled
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Proxy"}
        </Button>
      </div>
    </form>
  );
}
