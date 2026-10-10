"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getExecutionProxySummary,
  getExecutionSummary,
  type ExecutionSummary,
  type ProxyExecutionSummary,
  type ProxyItem,
  type TargetUrl,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Server, TrendingUp } from "lucide-react";

type ExecutionAnalyticsProps = {
  urls: TargetUrl[];
  proxies: ProxyItem[];
};

type TargetAnalytics = {
  url: TargetUrl;
  summary: ExecutionSummary;
  proxySummary: ProxyExecutionSummary[];
};

type AnalyticsRow = {
  target: TargetUrl;
  proxy: ProxyItem | null;
  mode: ProxyExecutionSummary["execution_mode"];
  total: number;
  success: number;
  failed: number;
  successRate: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function proxyLabel(proxy: ProxyItem | null, proxyId: string | null = null) {
  if (proxy) {
    return `${proxy.host}:${proxy.port}`;
  }

  return proxyId ? `Proxy unavailable · ${proxyId.slice(0, 8)}` : "Direct connection";
}

export function ExecutionAnalytics({
  urls,
  proxies,
}: ExecutionAnalyticsProps) {
  const [items, setItems] = useState<TargetAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const proxyMap = useMemo(
    () => new Map(proxies.map((proxy) => [proxy.id, proxy])),
    [proxies],
  );

  const loadAnalytics = useCallback(async (silent = false) => {
    if (urls.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const results = await Promise.all(
        urls.map(async (url) => {
          const [summary, proxySummary] = await Promise.all([
            getExecutionSummary(url.id),
            getExecutionProxySummary(url.id),
          ]);

          return {
            url,
            summary,
            proxySummary,
          };
        }),
      );

      setItems(results);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load execution analytics",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [urls]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const rows = useMemo<AnalyticsRow[]>(() => {
    return items.flatMap((item) =>
      item.proxySummary.map((summary) => {
        const proxy = summary.proxy_id
          ? proxyMap.get(summary.proxy_id) ?? null
          : null;

        return {
          target: item.url,
          proxy,
          proxyId: summary.proxy_id,
          mode: summary.execution_mode,
          total: summary.total,
          success: summary.success,
          failed: summary.failed,
          successRate: summary.total
            ? (summary.success / summary.total) * 100
            : 0,
        };
      }),
    );
  }, [items, proxyMap]);

  const targetChart = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        total: item.summary.total,
        successWidth: item.summary.total
          ? (item.summary.success / item.summary.total) * 100
          : 0,
        failedWidth: item.summary.total
          ? (item.summary.failed / item.summary.total) * 100
          : 0,
      })),
    [items],
  );

  const serverChart = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        label: string;
        total: number;
        success: number;
        failed: number;
      }
    >();

    for (const row of rows) {
      const key = row.proxy?.id ?? "direct";
      const current = grouped.get(key) ?? {
        key,
        label: proxyLabel(row.proxy, row.proxyId),
        total: 0,
        success: 0,
        failed: 0,
      };

      current.total += row.total;
      current.success += row.success;
      current.failed += row.failed;
      grouped.set(key, current);
    }

    return [...grouped.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => ({
          total: acc.total + item.summary.total,
          success: acc.success + item.summary.success,
          failed: acc.failed + item.summary.failed,
        }),
        { total: 0, success: 0, failed: 0 },
      ),
    [items],
  );

  const overallSuccessRate = totals.total
    ? (totals.success / totals.total) * 100
    : 0;

  const maxServerTotal = Math.max(
    ...serverChart.map((server) => server.total),
    1,
  );

  if (loading) {
    return (
      <section className="rounded-2xl border bg-card p-8">
        <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading execution analytics...
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Execution Analytics</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            See which proxy server handled each target, how many requests were
            sent, and how many succeeded or failed.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadAnalytics(true)}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total requests", totals.total, "text-foreground"],
          ["Successful", totals.success, "text-emerald-400"],
          ["Failed", totals.failed, "text-red-400"],
          ["Success rate", `${overallSuccessRate.toFixed(1)}%`, "text-primary"],
        ].map(([label, value, valueClass]) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>
              {typeof value === "number" ? formatNumber(value) : value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border bg-card p-5">
          <div className="mb-5">
            <h3 className="font-semibold">Target performance</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Success and failure distribution for every target URL.
            </p>
          </div>

          <div className="min-w-0 space-y-5">
            {targetChart.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No target URLs found.
              </div>
            )}

            {targetChart.map((item) => (
              <div key={item.url.id} className="min-w-0 space-y-2">
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p dir="auto" className="truncate text-sm font-medium" title={item.url.name || item.url.url}>
                      {item.url.name || item.url.url}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={item.url.url}>
                      {item.url.url}
                    </p>
                  </div>

                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatNumber(item.total)}
                    </span>{" "}
                    requests
                  </div>
                </div>

                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {item.successWidth > 0 && (
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{ width: `${item.successWidth}%` }}
                    />
                  )}
                  {item.failedWidth > 0 && (
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${item.failedWidth}%` }}
                    />
                  )}
                </div>

                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span>
                    <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-500" />
                    {formatNumber(item.summary.success)} successful
                  </span>
                  <span>
                    <span className="mr-1.5 inline-block size-2 rounded-full bg-red-500" />
                    {formatNumber(item.summary.failed)} failed
                  </span>
                  <span className="ml-auto">
                    {item.summary.success_rate.toFixed(1)}% success
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-5">
            <h3 className="font-semibold">Server traffic</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Total requests handled by each proxy server.
            </p>
          </div>

          <div className="space-y-5">
            {serverChart.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No execution data yet.
              </div>
            )}

            {serverChart.map((server) => {
              const successRate = server.total
                ? (server.success / server.total) * 100
                : 0;

              return (
                <div key={server.key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Server className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {server.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(server.total)} requests ·{" "}
                        {successRate.toFixed(1)}% success
                      </p>
                    </div>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${(server.total / maxServerTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h3 className="font-semibold">Requests by target and server</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            One row per target/server/mode combination.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Target URL</th>
                <th className="px-5 py-3 font-medium">Server</th>
                <th className="px-5 py-3 font-medium">Mode</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Success</th>
                <th className="px-5 py-3 text-right font-medium">Failed</th>
                <th className="px-5 py-3 text-right font-medium">Success rate</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    No execution records yet.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={`${row.target.id}-${row.proxy?.id ?? "direct"}-${row.mode}`} className="hover:bg-muted/20">
                  <td className="max-w-[280px] px-5 py-3">
                    <p dir="auto" className="truncate font-medium">
                      {row.target.name || row.target.url}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.target.url}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs">
                      {proxyLabel(row.proxy, row.proxyId)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium uppercase">
                      {row.mode}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {formatNumber(row.total)}
                  </td>
                  <td className="px-5 py-3 text-right text-emerald-400">
                    {formatNumber(row.success)}
                  </td>
                  <td className="px-5 py-3 text-right text-red-400">
                    {formatNumber(row.failed)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {row.successRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
