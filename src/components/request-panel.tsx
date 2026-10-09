"use client";

import { useRef, useState } from "react";

import {
  executeBatchRequestStream,
  ProxyStrategy,
  type BatchMetrics,
  type BatchProgressEvent,
  type ProxyItem,
  type RequestMode,
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

  const [mode, setMode] = useState<RequestMode>("http");

  const [connection, setConnection] = useState<"direct" | "proxy">("direct");

  const [selectedProxyIds, setSelectedProxyIds] = useState<string[]>([]);

  const [proxyStrategy, setProxyStrategy] =
    useState<ProxyStrategy>("round_robin");

  const [count, setCount] = useState(1);

  const [concurrency, setConcurrency] = useState(1);

  const [loading, setLoading] = useState(false);

  const [total, setTotal] = useState(0);

  const [completed, setCompleted] = useState(0);

  const [success, setSuccess] = useState(0);

  const [failed, setFailed] = useState(0);

  const [metrics, setMetrics] = useState<BatchMetrics>({
    elapsed_ms: 0,
    average_latency_ms: 0,
    requests_per_second: 0,
    success_rate: 0,
  });

  const [results, setResults] = useState<
    Array<{
      index: number;
      proxyId: string | null;
      result: RequestResult;
    }>
  >([]);

  const [error, setError] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  async function handleExecute() {
    const target = urls.find((item) => item.id === selectedUrl);

    if (!target) {
      setError("Please select a URL");
      return;
    }

    if (connection === "proxy" && selectedProxyIds.length === 0) {
      setError("Please select at least one proxy");

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

    setTotal(count);
    setCompleted(0);
    setSuccess(0);
    setFailed(0);
    setResults([]);

    setMetrics({
      elapsed_ms: 0,
      average_latency_ms: 0,
      requests_per_second: 0,
      success_rate: 0,
    });

    const controller = new AbortController();

    abortControllerRef.current = controller;

    try {
      await executeBatchRequestStream(
        {
          target_url_id: target.id,
          url: target.url,
          proxy_ids: connection === "direct" ? [] : selectedProxyIds,
          proxy_strategy: connection === "direct" ? "fixed" : proxyStrategy,
          mode,
          count,
          concurrency,
          browser_settings: {
            show_browser: false,
            delay_before_navigation_ms: 0,
            wait_after_load_ms: 3000,
            scroll_enabled: true,
            scroll_amount: 800,
            wait_after_scroll_ms: 2000,
            delay_after_navigation_ms: 0,
            navigation_timeout_ms: 30000,
          },
        },

        (event: BatchProgressEvent) => {
          if (event.type === "started") {
            setTotal(event.total);
            setCompleted(event.completed);
            setSuccess(event.success);
            setFailed(event.failed);
            setMetrics(event.metrics);

            return;
          }

          if (event.type === "progress") {
            setCompleted(event.completed);
            setSuccess(event.success);
            setFailed(event.failed);
            setMetrics(event.metrics);

            setResults((current) => [
              ...current,
              {
                index: event.index,
                proxyId: event.proxy_id,
                result: event.result,
              },
            ]);

            return;
          }

          if (event.type === "completed") {
            setTotal(event.total);
            setCompleted(event.completed);
            setSuccess(event.success);
            setFailed(event.failed);
            setMetrics(event.metrics);

            return;
          }

          if (event.type === "error") {
            setError(event.error);
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError("Execution cancelled");
      } else {
        setError(
          error instanceof Error ? error.message : "Batch execution failed",
        );
      }
    } finally {
      setLoading(false);

      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();

    setLoading(false);
  }

  return (
    <section className="space-y-6 rounded-lg border p-6">
      <div>
        <h2 className="text-xl font-semibold">Execute Request</h2>

        <p className="text-sm text-muted-foreground">
          Send one or multiple requests using HTTP, Browser, or Random
          execution.
        </p>
      </div>

      {/* URL */}

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

      {/* Connection */}

      <div className="space-y-2">
        <Label htmlFor="request-connection">Connection</Label>

        <select
          id="request-connection"
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

      {/* Proxy */}

      {connection === "proxy" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proxy-strategy">Proxy Strategy</Label>

            <select
              id="proxy-strategy"
              value={proxyStrategy}
              onChange={(event) =>
                setProxyStrategy(event.target.value as ProxyStrategy)
              }
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="round_robin">Round Robin</option>

              <option value="random">Random</option>

              <option value="fixed">Fixed</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Proxy Pool</Label>

            <div className="space-y-2 rounded-md border p-3">
              {proxies
                .filter((proxy) => proxy.enabled)
                .map((proxy) => {
                  const checked = selectedProxyIds.includes(proxy.id);

                  return (
                    <label
                      key={proxy.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedProxyIds((current) => [
                              ...current,
                              proxy.id,
                            ]);
                          } else {
                            setSelectedProxyIds((current) =>
                              current.filter((id) => id !== proxy.id),
                            );
                          }
                        }}
                      />

                      <span className="text-sm">
                        {proxy.host}:{proxy.port}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {proxy.protocol.toUpperCase()}
                      </span>
                    </label>
                  );
                })}

              {proxies.filter((proxy) => proxy.enabled).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No enabled proxies available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode */}

      <div className="space-y-2">
        <Label htmlFor="request-mode">Execution Mode</Label>

        <select
          id="request-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as RequestMode)}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="http">HTTP</option>

          <option value="browser">Browser</option>

          <option value="random">Random</option>
        </select>
      </div>

      {/* Count */}

      <div className="space-y-2">
        <Label htmlFor="request-count">Count</Label>

        <input
          id="request-count"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />

        <p className="text-xs text-muted-foreground">
          Number of requests to execute. Maximum: 100.
        </p>
      </div>

      {/* Concurrency */}

      <div className="space-y-2">
        <Label htmlFor="request-concurrency">Concurrency</Label>

        <input
          id="request-concurrency"
          type="number"
          min={1}
          max={20}
          value={concurrency}
          onChange={(event) => setConcurrency(Number(event.target.value))}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />

        <p className="text-xs text-muted-foreground">
          Maximum number of requests running at the same time. Maximum: 20.
        </p>
      </div>

      {/* Actions */}

      <div className="flex gap-2">
        <Button onClick={handleExecute} disabled={loading}>
          {loading ? "Executing..." : "Start Execution"}
        </Button>

        {loading && (
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </div>

      {/* Error */}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Progress */}

      {total > 0 && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Execution Progress</h3>

            <span className="text-sm font-medium">{progress}%</span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Completed</p>

              <p className="text-lg font-semibold">
                {completed} / {total}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground">Success</p>

              <p className="text-lg font-semibold">{success}</p>
            </div>

            <div>
              <p className="text-muted-foreground">Failed</p>

              <p className="text-lg font-semibold">{failed}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Elapsed</p>

                <p className="font-semibold">
                  {(metrics.elapsed_ms / 1000).toFixed(2)}s
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Avg Latency</p>

                <p className="font-semibold">
                  {metrics.average_latency_ms.toFixed(0)} ms
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Requests/sec</p>

                <p className="font-semibold">
                  {metrics.requests_per_second.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Success Rate</p>

                <p className="font-semibold">
                  {metrics.success_rate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Results */}

      {results.length > 0 && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Results</h3>

            <span className="text-sm text-muted-foreground">
              {results.length} completed
            </span>
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto">
            {[...results].reverse().map(({ index, proxyId, result }) => (
              <div key={index} className="rounded-md border p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span>Request</span>
                  <span>Proxy</span>

                  <span className="break-all">{proxyId ?? "Direct"}</span>
                  <span>#{index}</span>

                  <span>Success</span>

                  <span>{result.success ? "Yes" : "No"}</span>

                  <span>Status</span>

                  <span>{result.status_code ?? "-"}</span>

                  <span>Latency</span>

                  <span>{result.latency_ms} ms</span>

                  <span>Final URL</span>

                  <span className="break-all">{result.final_url ?? "-"}</span>

                  {result.title && (
                    <>
                      <span>Title</span>

                      <span>{result.title}</span>
                    </>
                  )}
                </div>

                {result.error && (
                  <p className="mt-2 text-destructive">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
