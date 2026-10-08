"use client";

import { useState } from "react";

import {
  executeRequest,
  type ProxyItem,
  type RequestResult,
  type TargetUrl,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  urls: TargetUrl[];
  proxies: ProxyItem[];
};

export function RequestPanel({ urls, proxies }: Props) {
  const [selectedUrl, setSelectedUrl] = useState(urls[0]?.id ?? "");

  const [connection, setConnection] = useState<"direct" | "proxy">("direct");

  const [selectedProxy, setSelectedProxy] = useState(
    proxies.find((proxy) => proxy.enabled)?.id ?? "",
  );

  const [mode, setMode] = useState<"http" | "browser" | "random">("http");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RequestResult | null>(null);
  const [error, setError] = useState("");

  async function handleExecute() {
    const target = urls.find((item) => item.id === selectedUrl);

    if (!target) {
      setError("Please select a URL");
      return;
    }

    if (connection === "proxy" && !selectedProxy) {
      setError("Please select a proxy");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await executeRequest({
        url: target.url,
        proxy_id: connection === "proxy" ? selectedProxy : null,
      });

      setResult(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Execute Request</h2>

        <p className="text-sm text-muted-foreground">
          Send a request using a direct connection or proxy.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="request-url">URL</Label>

        <select
          id="request-url"
          value={selectedUrl}
          onChange={(event) => setSelectedUrl(event.target.value)}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select URL</option>

          {urls
            .filter((item) => item.enabled)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.url}
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Connection</Label>

        <select
          value={connection}
          onChange={(event) =>
            setConnection(event.target.value as "direct" | "proxy")
          }
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="direct">Direct</option>

          <option value="proxy">Proxy</option>
        </select>
      </div>

      {connection === "proxy" && (
        <div className="space-y-2">
          <Label>Proxy</Label>

          <select
            value={selectedProxy}
            onChange={(event) => setSelectedProxy(event.target.value)}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select Proxy</option>

            {proxies
              .filter((proxy) => proxy.enabled)
              .map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.host}:{proxy.port} ({proxy.protocol.toUpperCase()})
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Execution Mode</Label>

        <select
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as "http" | "browser" | "random")
          }
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="http">HTTP</option>

          <option value="browser">Browser</option>

          <option value="random">Random</option>
        </select>

        {mode !== "http" && (
          <p className="text-xs text-muted-foreground">
            Browser execution will be enabled in the next step.
          </p>
        )}
      </div>

      <Button onClick={handleExecute} disabled={loading}>
        {loading ? "Sending..." : "Send Request"}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border p-4 space-y-2">
          <h3 className="font-semibold">Result</h3>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <span>Success</span>
            <span>{result.success ? "Yes" : "No"}</span>

            <span>Status</span>
            <span>{result.status_code ?? "-"}</span>

            <span>Latency</span>
            <span>{result.latency_ms} ms</span>

            <span>Final URL</span>
            <span className="break-all">{result.final_url ?? "-"}</span>
          </div>

          {result.error && (
            <p className="text-sm text-destructive">{result.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
