"use client";

import { useState } from "react";

import {
  executeBatchRequest,
  type BatchRequestResult,
  type ProxyItem,
  type RequestMode,
  type TargetUrl,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  urls: TargetUrl[];
  proxies: ProxyItem[];
};

export function RequestPanel({ urls, proxies }: Props) {
  const [selectedUrl, setSelectedUrl] = useState(
    urls[0]?.id ?? "",
  );

  const [mode, setMode] = useState<RequestMode>("http");

  const [connection, setConnection] = useState<
    "direct" | "proxy"
  >("direct");

  const [selectedProxy, setSelectedProxy] = useState(
    proxies.find((proxy) => proxy.enabled)?.id ?? "",
  );

  const [count, setCount] = useState(1);
  const [concurrency, setConcurrency] = useState(1);

  const [loading, setLoading] = useState(false);

  const [batchResult, setBatchResult] =
    useState<BatchRequestResult | null>(null);

  const [error, setError] = useState("");

  async function handleExecute() {
    const target = urls.find(
      (item) => item.id === selectedUrl,
    );

    if (!target) {
      setError("Please select a URL");
      return;
    }

    if (connection === "proxy" && !selectedProxy) {
      setError("Please select a proxy");
      return;
    }

    if (count < 1 || count > 100) {
      setError("Count must be between 1 and 100");
      return;
    }

    if (concurrency < 1 || concurrency > 20) {
      setError("Concurrency must be between 1 and 20");
      return;
    }

    if (concurrency > count) {
      setError("Concurrency cannot be greater than count");
      return;
    }

    setLoading(true);
    setError("");
    setBatchResult(null);

    try {
      const response = await executeBatchRequest({
        url: target.url,
        proxy_id:
          connection === "direct"
            ? null
            : selectedProxy,
        mode,
        count,
        concurrency,
      });

      setBatchResult(response);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Batch request failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6 rounded-lg border p-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">
          Execute Request
        </h2>

        <p className="text-sm text-muted-foreground">
          Send one or multiple requests using HTTP,
          Browser, or Random execution.
        </p>
      </div>

      {/* URL */}
      <div className="space-y-2">
        <Label htmlFor="request-url">
          URL
        </Label>

        <select
          id="request-url"
          value={selectedUrl}
          onChange={(event) =>
            setSelectedUrl(event.target.value)
          }
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">
            Select URL
          </option>

          {urls
            .filter((item) => item.enabled)
            .map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name || item.url}
              </option>
            ))}
        </select>
      </div>

      {/* Connection */}
      <div className="space-y-2">
        <Label htmlFor="request-connection">
          Connection
        </Label>

        <select
          id="request-connection"
          value={connection}
          onChange={(event) =>
            setConnection(
              event.target.value as
                | "direct"
                | "proxy",
            )
          }
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="direct">
            Direct
          </option>

          <option value="proxy">
            Proxy
          </option>
        </select>
      </div>

      {/* Proxy */}
      {connection === "proxy" && (
        <div className="space-y-2">
          <Label htmlFor="request-proxy">
            Proxy
          </Label>

          <select
            id="request-proxy"
            value={selectedProxy}
            onChange={(event) =>
              setSelectedProxy(event.target.value)
            }
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">
              Select Proxy
            </option>

            {proxies
              .filter((proxy) => proxy.enabled)
              .map((proxy) => (
                <option
                  key={proxy.id}
                  value={proxy.id}
                >
                  {proxy.host}:{proxy.port} (
                  {proxy.protocol.toUpperCase()}
                  )
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Execution Mode */}
      <div className="space-y-2">
        <Label htmlFor="request-mode">
          Execution Mode
        </Label>

        <select
          id="request-mode"
          value={mode}
          onChange={(event) =>
            setMode(
              event.target.value as RequestMode,
            )
          }
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="http">
            HTTP
          </option>

          <option value="browser">
            Browser
          </option>

          <option value="random">
            Random
          </option>
        </select>
      </div>

      {/* Count */}
      <div className="space-y-2">
        <Label htmlFor="request-count">
          Count
        </Label>

        <input
          id="request-count"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(event) =>
            setCount(Number(event.target.value))
          }
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />

        <p className="text-xs text-muted-foreground">
          Number of requests to execute. Maximum: 100.
        </p>
      </div>

      {/* Concurrency */}
      <div className="space-y-2">
        <Label htmlFor="request-concurrency">
          Concurrency
        </Label>

        <input
          id="request-concurrency"
          type="number"
          min={1}
          max={20}
          value={concurrency}
          onChange={(event) =>
            setConcurrency(
              Number(event.target.value),
            )
          }
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />

        <p className="text-xs text-muted-foreground">
          Maximum number of requests running at
          the same time. Maximum: 20.
        </p>
      </div>

      {/* Execute */}
      <Button
        onClick={handleExecute}
        disabled={loading}
      >
        {loading
          ? "Sending..."
          : "Send Requests"}
      </Button>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Result */}
      {batchResult && (
        <div className="space-y-4 rounded-md border p-4">
          <h3 className="font-semibold">
            Batch Result
          </h3>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <span>Total</span>
            <span>
              {batchResult.total}
            </span>

            <span>Success</span>
            <span>
              {batchResult.success}
            </span>

            <span>Failed</span>
            <span>
              {batchResult.failed}
            </span>
          </div>

          {/* Individual Results */}
          {batchResult.results.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                Requests
              </h4>

              <div className="max-h-80 space-y-2 overflow-y-auto">
                {batchResult.results.map(
                  (result, index) => (
                    <div
                      key={index}
                      className="rounded-md border p-3 text-sm"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <span>
                          Request
                        </span>

                        <span>
                          #{index + 1}
                        </span>

                        <span>
                          Success
                        </span>

                        <span>
                          {result.success
                            ? "Yes"
                            : "No"}
                        </span>

                        <span>
                          Status
                        </span>

                        <span>
                          {result.status_code ??
                            "-"}
                        </span>

                        <span>
                          Latency
                        </span>

                        <span>
                          {result.latency_ms} ms
                        </span>

                        <span>
                          Final URL
                        </span>

                        <span className="break-all">
                          {result.final_url ??
                            "-"}
                        </span>

                        {result.title && (
                          <>
                            <span>
                              Title
                            </span>

                            <span>
                              {result.title}
                            </span>
                          </>
                        )}
                      </div>

                      {result.error && (
                        <p className="mt-2 text-destructive">
                          {result.error}
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}