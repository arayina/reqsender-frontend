"use client";

import { FormEvent, useState } from "react";

import { createProxy, type ProxyItem } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onCreated: (proxy: ProxyItem) => void;
  onCancel: () => void;
};

export function ProxyForm({ onCreated, onCancel }: Props) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState("http");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const proxy = await createProxy({
        host,
        port: Number(port),
        protocol,
        username: username || undefined,
        password: password || undefined,
        enabled,
      });

      onCreated(proxy);
    } catch {
      setError("Failed to create proxy");
    } finally {
      setLoading(false);
    }
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
          placeholder="Optional"
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
          {loading ? "Creating..." : "Add Proxy"}
        </Button>
      </div>
    </form>
  );
}
