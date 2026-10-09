"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

import {
  createUrl,
  deleteUrl,
  executeBatchRequestStream,
  getProxies,
  getUrlSettings,
  getUrls,
  saveUrlSettings,
  type BatchMetrics,
  type BatchProgressEvent,
  type BrowserSettings,
  type ProxyItem,
  type ProxyStrategy,
  type RequestMode,
  type RequestResult,
  type TargetUrl,
} from "@/lib/api";

import { ProxyList } from "@/components/proxy-list";
import { AppHeader } from "@/components/dashboard/app-header";
import { WorkspaceNav } from "@/components/dashboard/workspace-nav";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { ExecutionAnalytics } from "@/components/dashboard/execution-analytics";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Activity,
  Check,
  ChevronRight,
  Circle,
  Globe,
  Loader2,
  Pause,
  Play,
  Plus,
  Server,
  Trash2,
  X,
} from "lucide-react";

type ExecutionStatus = "running" | "completed" | "cancelled" | "failed";

type ExecutionResult = {
  index: number;
  proxyId: string | null;
  result: RequestResult;
};

type Execution = {
  id: string;

  urlId: string;
  url: string;
  urlName: string;

  connection: "direct" | "proxy";

  proxyIds: string[];
  proxyStrategy: ProxyStrategy;

  mode: RequestMode;

  count: number;
  concurrency: number;
  browserSettings: BrowserSettings;

  status: ExecutionStatus;

  total: number;
  completed: number;
  success: number;
  failed: number;

  metrics: BatchMetrics;

  results: ExecutionResult[];
};

type TargetConfig = {
  mode: RequestMode;
  connection: "direct" | "proxy";
  proxyIds: string[];
  proxyStrategy: ProxyStrategy;
  count: number;
  concurrency: number;
  browserSettings: BrowserSettings;
};

const defaultBrowserSettings: BrowserSettings = {
  show_browser: false,
  delay_before_navigation_ms: 0,
  wait_after_load_ms: 3000,
  scroll_enabled: true,
  scroll_amount: 800,
  wait_after_scroll_ms: 2000,
  delay_after_navigation_ms: 0,
  navigation_timeout_ms: 30000,
};

const defaultTargetConfig: TargetConfig = {
  mode: "http",
  connection: "direct",
  proxyIds: [],
  proxyStrategy: "round_robin",
  count: 10,
  concurrency: 2,
  browserSettings: { ...defaultBrowserSettings },
};

const emptyMetrics: BatchMetrics = {
  elapsed_ms: 0,
  average_latency_ms: 0,
  requests_per_second: 0,
  success_rate: 0,
};

export function RequestDashboard() {
  const [urls, setUrls] = useState<TargetUrl[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);

  const [selectedUrlId, setSelectedUrlId] = useState("");

  const [activeView, setActiveView] = useState<"requests" | "analytics" | "proxies">(
    "requests",
  );

  /**
   * Each URL has its own execution configuration.
   *
   * Example:
   *
   * {
   *   googleId: {
   *     mode: "http",
   *     count: 100,
   *     concurrency: 10,
   *     ...
   *   },
   *
   *   githubId: {
   *     mode: "browser",
   *     count: 30,
   *     concurrency: 3,
   *     ...
   *   }
   * }
   */
  const [targetConfigs, setTargetConfigs] = useState<
    Record<string, TargetConfig>
  >({});

  /**
   * Every execution has its own state.
   *
   * This allows multiple URLs to run simultaneously.
   */
  const [executions, setExecutions] = useState<Execution[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlName, setUrlName] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [urlSaving, setUrlSaving] = useState(false);

  /**
   * Each running execution gets its own AbortController.
   */
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const enabledUrls = useMemo(
    () => urls.filter((item) => item.enabled),
    [urls],
  );

  const enabledProxies = useMemo(
    () => proxies.filter((item) => item.enabled),
    [proxies],
  );

  const selectedUrl = urls.find((item) => item.id === selectedUrlId);

  /**
   * Configuration belonging to the currently selected URL.
   *
   * If this URL has never been configured before,
   * use the default configuration.
   */
  const selectedConfig = targetConfigs[selectedUrlId] ?? defaultTargetConfig;

  /**
   * Update only the configuration of the selected URL.
   */
  function scheduleSaveConfig(urlId: string, config: TargetConfig) {
    const existingTimer = saveTimers.current.get(urlId);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      void saveUrlSettings(urlId, {
        mode: config.mode,
        connection: config.connection,
        proxy_strategy: config.proxyStrategy,
        proxy_ids: config.proxyIds,
        count: config.count,
        concurrency: config.concurrency,
        ...config.browserSettings,
      }).catch((error) => {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to save target settings",
        );
      });

      saveTimers.current.delete(urlId);
    }, 500);

    saveTimers.current.set(urlId, timer);
  }

  function updateSelectedConfig(patch: Partial<TargetConfig>) {
    if (!selectedUrlId) {
      return;
    }

    const currentConfig = targetConfigs[selectedUrlId] ?? defaultTargetConfig;

    const nextConfig: TargetConfig = {
      ...currentConfig,
      ...patch,
      browserSettings: {
        ...currentConfig.browserSettings,
        ...(patch.browserSettings ?? {}),
      },
    };

    setTargetConfigs((current) => ({
      ...current,
      [selectedUrlId]: nextConfig,
    }));

    scheduleSaveConfig(selectedUrlId, nextConfig);
  }

  useEffect(() => {
    const timers = saveTimers.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      timers.clear();
    };
  }, []);

  /**
   * Initial data load.
   */
  useEffect(() => {
    async function load() {
      setLoadingData(true);
      setError("");

      try {
        const [loadedUrls, loadedProxies, loadedSettings] = await Promise.all([
          getUrls(),
          getProxies(),
          getUrlSettings(),
        ]);

        const configs: Record<string, TargetConfig> = {};

        for (const item of loadedSettings) {
          configs[item.target_url_id] = {
            mode: item.mode,
            connection: item.connection,
            proxyIds: item.proxy_ids,
            proxyStrategy: item.proxy_strategy,
            count: item.count,
            concurrency: item.concurrency,
            browserSettings: {
              show_browser: item.show_browser,
              delay_before_navigation_ms: item.delay_before_navigation_ms,
              wait_after_load_ms: item.wait_after_load_ms,
              scroll_enabled: item.scroll_enabled,
              scroll_amount: item.scroll_amount,
              wait_after_scroll_ms: item.wait_after_scroll_ms,
              delay_after_navigation_ms: item.delay_after_navigation_ms,
              navigation_timeout_ms: item.navigation_timeout_ms,
            },
          };
        }

        setUrls(loadedUrls);
        setProxies(loadedProxies);
        setTargetConfigs(configs);

        const firstUrl = loadedUrls.find((item) => item.enabled);

        if (firstUrl) {
          setSelectedUrlId(firstUrl.id);
        }
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load dashboard",
        );
      } finally {
        setLoadingData(false);
      }
    }

    void load();
  }, []);

  /**
   * Update one execution without touching other executions.
   */
  function updateExecution(
    id: string,
    updater: (execution: Execution) => Execution,
  ) {
    setExecutions((current) =>
      current.map((execution) =>
        execution.id === id ? updater(execution) : execution,
      ),
    );
  }

  /**
   * Execute one batch and listen to SSE progress.
   */
  async function runExecution(
    executionId: string,
    urlId: string,
    config: {
      url: string;
      proxyIds: string[];
      proxyStrategy: ProxyStrategy;
      mode: RequestMode;
      count: number;
      concurrency: number;
      browserSettings: BrowserSettings;
    },
  ) {
    const controller = new AbortController();

    abortControllers.current.set(executionId, controller);

    try {
      await executeBatchRequestStream(
        {
          target_url_id: urlId,
          url: config.url,
          proxy_ids: config.proxyIds,
          proxy_strategy: config.proxyStrategy,
          mode: config.mode,
          count: config.count,
          concurrency: config.concurrency,
          browser_settings: config.browserSettings,
        },

        (event: BatchProgressEvent) => {
          if (event.type === "started") {
            updateExecution(executionId, (execution) => ({
              ...execution,
              status: "running",
              total: event.total,
              completed: event.completed,
              success: event.success,
              failed: event.failed,
              metrics: event.metrics,
            }));

            return;
          }

          if (event.type === "progress") {
            updateExecution(executionId, (execution) => ({
              ...execution,
              status: "running",
              total: event.total,
              completed: event.completed,
              success: event.success,
              failed: event.failed,
              metrics: event.metrics,

              results: [
                ...execution.results,
                {
                  index: event.index,
                  proxyId: event.proxy_id,
                  result: event.result,
                },
              ],
            }));

            return;
          }

          if (event.type === "completed") {
            updateExecution(executionId, (execution) => ({
              ...execution,
              status: "completed",
              total: event.total,
              completed: event.completed,
              success: event.success,
              failed: event.failed,
              metrics: event.metrics,
            }));

            return;
          }

          if (event.type === "error") {
            updateExecution(executionId, (execution) => ({
              ...execution,
              status: "failed",
            }));
          }
        },

        controller.signal,
      );

      /**
       * If SSE ended normally but the backend did not send
       * a final "completed" event for some reason, keep the
       * execution state sane.
       */
      updateExecution(executionId, (execution) => {
        if (execution.status === "running") {
          return {
            ...execution,
            status: "completed",
          };
        }

        return execution;
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        updateExecution(executionId, (execution) => ({
          ...execution,
          status: "cancelled",
        }));
      } else {
        updateExecution(executionId, (execution) => ({
          ...execution,
          status: "failed",
        }));
      }
    } finally {
      abortControllers.current.delete(executionId);
    }
  }

  /**
   * Start a new execution using the configuration
   * belonging to the currently selected URL.
   */
  function handleStartExecution() {
    setError("");

    if (!selectedUrl) {
      setError("Please select a URL.");
      return;
    }

    const config = targetConfigs[selectedUrlId] ?? defaultTargetConfig;

    if (config.connection === "proxy" && config.proxyIds.length === 0) {
      setError("Please select at least one proxy.");
      return;
    }

    if (config.count < 1 || config.count > 100) {
      setError("Count must be between 1 and 100.");
      return;
    }

    if (config.concurrency < 1 || config.concurrency > 20) {
      setError("Concurrency must be between 1 and 20.");
      return;
    }

    if (config.concurrency > config.count) {
      setError("Concurrency cannot be greater than count.");
      return;
    }

    const executionId = crypto.randomUUID();

    /**
     * Snapshot the selected URL configuration.
     *
     * This is important.
     *
     * If Google starts with:
     * HTTP / 100 / 10
     *
     * and then we switch to GitHub and change it to:
     * Browser / 30 / 3
     *
     * the Google execution must remain:
     * HTTP / 100 / 10
     */
    const execution: Execution = {
      id: executionId,

      urlId: selectedUrl.id,
      url: selectedUrl.url,
      urlName: selectedUrl.name || selectedUrl.url,

      connection: config.connection,

      proxyIds: config.connection === "proxy" ? [...config.proxyIds] : [],

      proxyStrategy:
        config.connection === "proxy" ? config.proxyStrategy : "fixed",

      mode: config.mode,

      count: config.count,
      concurrency: config.concurrency,
      browserSettings: { ...config.browserSettings },

      status: "running",

      total: config.count,
      completed: 0,
      success: 0,
      failed: 0,

      metrics: {
        ...emptyMetrics,
      },

      results: [],
    };

    setExecutions((current) => [execution, ...current]);

    /**
     * Start asynchronously.
     *
     * We intentionally do not await this here.
     * This allows another URL to be started immediately.
     */
    void runExecution(executionId, selectedUrl.id, {
      url: selectedUrl.url,

      proxyIds: config.connection === "proxy" ? [...config.proxyIds] : [],

      proxyStrategy:
        config.connection === "proxy" ? config.proxyStrategy : "fixed",

      mode: config.mode,

      count: config.count,

      concurrency: config.concurrency,

      browserSettings: {
        ...config.browserSettings,
      },
    });
  }

  /**
   * Cancel one specific execution.
   */
  function handleCancelExecution(id: string) {
    const controller = abortControllers.current.get(id);

    controller?.abort();

    updateExecution(id, (execution) => ({
      ...execution,
      status: "cancelled",
    }));
  }

  /**
   * Remove a completed/cancelled execution card.
   */
  function handleRemoveExecution(id: string) {
    const controller = abortControllers.current.get(id);

    controller?.abort();

    abortControllers.current.delete(id);

    setExecutions((current) =>
      current.filter((execution) => execution.id !== id),
    );
  }

  /**
   * Add/remove a proxy from the selected URL's
   * own proxy pool.
   */
  function toggleProxy(proxyId: string) {
    if (!selectedUrlId) {
      return;
    }

    const currentProxyIds = targetConfigs[selectedUrlId]?.proxyIds ?? [];

    const nextProxyIds = currentProxyIds.includes(proxyId)
      ? currentProxyIds.filter((id) => id !== proxyId)
      : [...currentProxyIds, proxyId];

    updateSelectedConfig({
      proxyIds: nextProxyIds,
    });
  }

  /**
   * Create a new target URL.
   */
  async function handleCreateUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!urlValue.trim()) {
      return;
    }

    setUrlSaving(true);
    setError("");

    try {
      const created = await createUrl({
        url: urlValue.trim(),
        name: urlName.trim() || undefined,
        enabled: true,
      });

      setUrls((current) => [...current, created]);

      /**
       * The new URL automatically gets
       * default configuration through
       * selectedConfig fallback.
       */
      setSelectedUrlId(created.id);

      setUrlName("");
      setUrlValue("");
      setShowUrlForm(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create URL");
    } finally {
      setUrlSaving(false);
    }
  }

  /**
   * Delete one target URL.
   */
  async function handleDeleteUrl(event: MouseEvent, urlId: string) {
    event.stopPropagation();

    const hasRunningExecution = executions.some(
      (execution) =>
        execution.urlId === urlId && execution.status === "running",
    );

    if (hasRunningExecution) {
      setError("Stop the running execution before deleting this URL.");
      return;
    }

    try {
      await deleteUrl(urlId);

      setUrls((current) => current.filter((item) => item.id !== urlId));

      /**
       * Also remove the URL's UI configuration.
       */
      setTargetConfigs((current) => {
        const next = {
          ...current,
        };

        delete next[urlId];

        return next;
      });

      if (selectedUrlId === urlId) {
        const next = urls.find((item) => item.id !== urlId && item.enabled);

        setSelectedUrlId(next?.id ?? "");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete URL");
    }
  }

  async function refreshData() {
    try {
      const [loadedUrls, loadedProxies] = await Promise.all([
        getUrls(),
        getProxies(),
      ]);

      setUrls(loadedUrls);
      setProxies(loadedProxies);

      if (
        !selectedUrlId ||
        !loadedUrls.some((item) => item.id === selectedUrlId && item.enabled)
      ) {
        const firstUrl = loadedUrls.find((item) => item.enabled);

        setSelectedUrlId(firstUrl?.id ?? "");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to refresh data",
      );
    }
  }

  if (loadingData) {
    return (
      <div className="flex min-h-125 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-frame flex min-h-screen flex-col px-4 py-4 md:px-6 md:py-5">
        <AppHeader
          runningCount={executions.filter((item) => item.status === "running").length}
          onRefresh={() => { void refreshData(); }}
        />

        <WorkspaceNav activeView={activeView} onViewChange={setActiveView} />

        <DashboardError message={error} onClose={() => setError("")} />

        {activeView === "analytics" ? (
          <ExecutionAnalytics urls={urls} proxies={proxies} />
        ) : activeView === "proxies" ? (
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Proxy Management</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add, edit, enable, disable, delete, and test proxy health.
              </p>
            </div>

            <ProxyList initialProxies={proxies} />
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Sidebar */}

            <aside className="rounded-2xl border bg-card">
              <div className="border-b p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Target URLs</p>

                    <p className="text-xs text-muted-foreground">
                      {enabledUrls.length} active targets
                    </p>
                  </div>

                  <Button
                    size="icon-sm"
                    onClick={() => setShowUrlForm(true)}
                    title="Add URL"
                  >
                    <Plus />
                  </Button>
                </div>
              </div>

              <div className="max-h-150 space-y-1 overflow-y-auto p-2">
                {enabledUrls.map((urlItem) => {
                  const selected = urlItem.id === selectedUrlId;

                  const running = executions.some(
                    (execution) =>
                      execution.urlId === urlItem.id &&
                      execution.status === "running",
                  );

                  return (
                    <div
                      key={urlItem.id}
                      className={`group flex items-center gap-2 rounded-xl p-2 transition ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedUrlId(urlItem.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div
                          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                            selected ? "bg-primary-foreground/15" : "bg-muted"
                          }`}
                        >
                          <Globe className="size-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {urlItem.name || "Unnamed URL"}
                            </p>

                            {running && (
                              <span
                                className={`size-1.5 rounded-full ${
                                  selected
                                    ? "bg-primary-foreground"
                                    : "bg-emerald-500"
                                }`}
                              />
                            )}
                          </div>

                          <p
                            className={`truncate text-xs ${
                              selected
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {urlItem.url}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(event) => handleDeleteUrl(event, urlItem.id)}
                        className={`hidden rounded p-1.5 group-hover:block ${
                          selected
                            ? "hover:bg-primary-foreground/10"
                            : "hover:bg-destructive/10"
                        }`}
                        title="Delete"
                      >
                        <Trash2
                          className={`size-3.5 ${
                            selected
                              ? "text-primary-foreground"
                              : "text-destructive"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}

                {enabledUrls.length === 0 && (
                  <div className="p-6 text-center">
                    <Globe className="mx-auto mb-3 size-8 text-muted-foreground" />

                    <p className="text-sm font-medium">No URLs</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Add your first target.
                    </p>

                    <Button
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowUrlForm(true)}
                    >
                      <Plus />
                      Add URL
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t p-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowUrlForm(true)}
                >
                  <Plus />
                  Add Target URL
                </Button>
              </div>
            </aside>

            {/* Main */}

            <main className="min-w-0 space-y-5">
              {/* Configuration */}

              <section className="rounded-2xl border bg-card">
                <div className="border-b p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">
                          {selectedUrl?.name || "Select a target"}
                        </h2>

                        {selectedUrl && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                            Target
                          </span>
                        )}
                      </div>

                      <p className="mt-1 max-w-2xl truncate text-sm text-muted-foreground">
                        {selectedUrl?.url || "Choose a URL from the sidebar"}
                      </p>
                    </div>

                    {selectedUrl && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="size-4" />
                        Ready
                      </div>
                    )}
                  </div>
                </div>

                {selectedUrl ? (
                  <div className="space-y-6 p-5">
                    {/* Connection */}

                    <div>
                      <Label className="mb-2">Connection</Label>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedConfig({
                              connection: "direct",
                            })
                          }
                          className={`rounded-xl border p-3 text-left transition ${
                            selectedConfig.connection === "direct"
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Globe className="size-4" />

                            <span className="text-sm font-medium">Direct</span>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Connect directly to target
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedConfig({
                              connection: "proxy",
                            })
                          }
                          className={`rounded-xl border p-3 text-left transition ${
                            selectedConfig.connection === "proxy"
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Server className="size-4" />

                            <span className="text-sm font-medium">Proxy</span>
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Use one or more proxies
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Proxy Pool */}

                    {selectedConfig.connection === "proxy" && (
                      <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Proxy Pool</p>

                            <p className="text-xs text-muted-foreground">
                              Select the proxies used by this target.
                            </p>
                          </div>

                          <span className="rounded-full bg-background px-2.5 py-1 text-xs">
                            {selectedConfig.proxyIds.length} selected
                          </span>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          {enabledProxies.map((proxy) => {
                            const checked = selectedConfig.proxyIds.includes(
                              proxy.id,
                            );

                            return (
                              <button
                                key={proxy.id}
                                type="button"
                                onClick={() => toggleProxy(proxy.id)}
                                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                                  checked
                                    ? "border-primary bg-background ring-1 ring-primary"
                                    : "bg-background hover:bg-muted"
                                }`}
                              >
                                <div
                                  className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                                    checked
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : ""
                                  }`}
                                >
                                  {checked && <Check className="size-3.5" />}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {proxy.host}:{proxy.port}
                                  </p>

                                  <p className="text-xs text-muted-foreground">
                                    {proxy.protocol.toUpperCase()}
                                    {proxy.username ? " • Authenticated" : ""}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {enabledProxies.length === 0 && (
                          <div className="rounded-lg border border-dashed p-6 text-center">
                            <Server className="mx-auto mb-2 size-7 text-muted-foreground" />

                            <p className="text-sm font-medium">
                              No active proxies
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Add a proxy before using proxy mode.
                            </p>
                          </div>
                        )}

                        {selectedConfig.proxyIds.length > 0 && (
                          <div className="border-t pt-4">
                            <Label htmlFor="proxy-strategy" className="mb-2">
                              Proxy Strategy
                            </Label>

                            <select
                              id="proxy-strategy"
                              value={selectedConfig.proxyStrategy}
                              onChange={(event) =>
                                updateSelectedConfig({
                                  proxyStrategy: event.target
                                    .value as ProxyStrategy,
                                })
                              }
                              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                            >
                              <option value="round_robin">Round Robin</option>

                              <option value="random">Random</option>

                              <option value="fixed">Fixed</option>
                            </select>

                            <p className="mt-2 text-xs text-muted-foreground">
                              {selectedConfig.proxyStrategy === "round_robin" &&
                                "Requests rotate through the selected proxies."}

                              {selectedConfig.proxyStrategy === "random" &&
                                "A proxy is randomly selected for each request."}

                              {selectedConfig.proxyStrategy === "fixed" &&
                                "All requests use the first selected proxy."}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Execution Mode */}

                    <div>
                      <Label className="mb-2">Execution Mode</Label>

                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["http", "HTTP", "Fast request"],
                            ["browser", "Browser", "Real browser"],
                            ["random", "Random", "HTTP or Browser"],
                          ] as const
                        ).map(([value, title, description]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              updateSelectedConfig({
                                mode: value,
                              })
                            }
                            className={`rounded-xl border p-3 text-left transition ${
                              selectedConfig.mode === value
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:bg-muted"
                            }`}
                          >
                            <p className="text-sm font-medium">{title}</p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Browser Settings */}

                    {(selectedConfig.mode === "browser" ||
                      selectedConfig.mode === "random") && (
                      <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                        <div>
                          <p className="text-sm font-semibold">
                            Browser Settings
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            These settings belong to this target. HTTP requests
                            ignore them.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedConfig({
                                browserSettings: {
                                  ...selectedConfig.browserSettings,
                                  show_browser:
                                    !selectedConfig.browserSettings
                                      .show_browser,
                                },
                              })
                            }
                            className={`rounded-xl border p-3 text-left transition ${
                              selectedConfig.browserSettings.show_browser
                                ? "border-primary bg-background ring-1 ring-primary"
                                : "bg-background hover:bg-muted"
                            }`}
                          >
                            <p className="text-sm font-medium">Show Browser</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Open a visible Chrome window on the machine
                              running the backend.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedConfig({
                                browserSettings: {
                                  ...selectedConfig.browserSettings,
                                  scroll_enabled:
                                    !selectedConfig.browserSettings
                                      .scroll_enabled,
                                },
                              })
                            }
                            className={`rounded-xl border p-3 text-left transition ${
                              selectedConfig.browserSettings.scroll_enabled
                                ? "border-primary bg-background ring-1 ring-primary"
                                : "bg-background hover:bg-muted"
                            }`}
                          >
                            <p className="text-sm font-medium">
                              Scroll after load
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Scroll the page after the initial wait.
                            </p>
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="delay-before-navigation">
                              Before navigation
                            </Label>

                            <Input
                              id="delay-before-navigation"
                              type="number"
                              min={0}
                              max={60000}
                              value={
                                selectedConfig.browserSettings
                                  .delay_before_navigation_ms
                              }
                              onChange={(event) => {
                                const value = Number(event.target.value);

                                updateSelectedConfig({
                                  browserSettings: {
                                    ...selectedConfig.browserSettings,
                                    delay_before_navigation_ms: Number.isFinite(
                                      value,
                                    )
                                      ? Math.min(60000, Math.max(0, value))
                                      : 0,
                                  },
                                });
                              }}
                            />

                            <p className="text-xs text-muted-foreground">
                              Milliseconds before opening the URL.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="wait-after-load">
                              Wait after load
                            </Label>

                            <Input
                              id="wait-after-load"
                              type="number"
                              min={0}
                              max={60000}
                              value={
                                selectedConfig.browserSettings
                                  .wait_after_load_ms
                              }
                              onChange={(event) => {
                                const value = Number(event.target.value);

                                updateSelectedConfig({
                                  browserSettings: {
                                    ...selectedConfig.browserSettings,
                                    wait_after_load_ms: Number.isFinite(value)
                                      ? Math.min(60000, Math.max(0, value))
                                      : 0,
                                  },
                                });
                              }}
                            />

                            <p className="text-xs text-muted-foreground">
                              Wait after DOMContentLoaded.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="scroll-amount">Scroll amount</Label>

                            <Input
                              id="scroll-amount"
                              type="number"
                              min={0}
                              max={10000}
                              value={
                                selectedConfig.browserSettings.scroll_amount
                              }
                              disabled={
                                !selectedConfig.browserSettings.scroll_enabled
                              }
                              onChange={(event) => {
                                const value = Number(event.target.value);

                                updateSelectedConfig({
                                  browserSettings: {
                                    ...selectedConfig.browserSettings,
                                    scroll_amount: Number.isFinite(value)
                                      ? Math.min(10000, Math.max(0, value))
                                      : 0,
                                  },
                                });
                              }}
                            />

                            <p className="text-xs text-muted-foreground">
                              Pixels to scroll vertically.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="wait-after-scroll">
                              Wait after scroll
                            </Label>

                            <Input
                              id="wait-after-scroll"
                              type="number"
                              min={0}
                              max={60000}
                              value={
                                selectedConfig.browserSettings
                                  .wait_after_scroll_ms
                              }
                              disabled={
                                !selectedConfig.browserSettings.scroll_enabled
                              }
                              onChange={(event) => {
                                const value = Number(event.target.value);

                                updateSelectedConfig({
                                  browserSettings: {
                                    ...selectedConfig.browserSettings,
                                    wait_after_scroll_ms: Number.isFinite(value)
                                      ? Math.min(60000, Math.max(0, value))
                                      : 0,
                                  },
                                });
                              }}
                            />

                            <p className="text-xs text-muted-foreground">
                              Wait after scrolling.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="delay-after-navigation">
                              After navigation
                            </Label>

                            <Input
                              id="delay-after-navigation"
                              type="number"
                              min={0}
                              max={60000}
                              value={
                                selectedConfig.browserSettings
                                  .delay_after_navigation_ms
                              }
                              onChange={(event) => {
                                const value = Number(event.target.value);

                                updateSelectedConfig({
                                  browserSettings: {
                                    ...selectedConfig.browserSettings,
                                    delay_after_navigation_ms: Number.isFinite(
                                      value,
                                    )
                                      ? Math.min(60000, Math.max(0, value))
                                      : 0,
                                  },
                                });
                              }}
                            />

                            <p className="text-xs text-muted-foreground">
                              Additional wait before closing the browser.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="navigation-timeout">
                              Navigation timeout
                            </Label>

                            <Input
                              id="navigation-timeout"
                              type="number"
                              min={1000}
                              max={120000}
                              value={
                                selectedConfig.browserSettings
                                  .navigation_timeout_ms
                              }
                              onChange={(event) => {
                                const value = Number(event.target.value);

                                updateSelectedConfig({
                                  browserSettings: {
                                    ...selectedConfig.browserSettings,
                                    navigation_timeout_ms: Number.isFinite(
                                      value,
                                    )
                                      ? Math.min(120000, Math.max(1000, value))
                                      : 30000,
                                  },
                                });
                              }}
                            />

                            <p className="text-xs text-muted-foreground">
                              Maximum time allowed for navigation.
                            </p>
                          </div>
                        </div>

                        {selectedConfig.browserSettings.show_browser &&
                          selectedConfig.concurrency > 3 && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                              Visible Browser with high concurrency can open
                              multiple Chrome windows and consume significant
                              CPU and RAM.
                            </div>
                          )}
                      </div>
                    )}

                    {/* Count / Concurrency */}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="count">Requests</Label>

                        <Input
                          id="count"
                          type="number"
                          min={1}
                          max={100}
                          value={selectedConfig.count}
                          onChange={(event) => {
                            const value = Number(event.target.value);

                            updateSelectedConfig({
                              count: Number.isFinite(value)
                                ? Math.min(100, Math.max(1, value))
                                : 1,
                            });
                          }}
                        />

                        <p className="text-xs text-muted-foreground">
                          Maximum 100 requests per execution.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="concurrency">Concurrency</Label>

                        <Input
                          id="concurrency"
                          type="number"
                          min={1}
                          max={20}
                          value={selectedConfig.concurrency}
                          onChange={(event) => {
                            const value = Number(event.target.value);

                            updateSelectedConfig({
                              concurrency: Number.isFinite(value)
                                ? Math.min(20, Math.max(1, value))
                                : 1,
                            });
                          }}
                        />

                        <p className="text-xs text-muted-foreground">
                          Maximum 20 simultaneous requests.
                        </p>
                      </div>
                    </div>

                    {/* Start */}

                    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Ready to execute</p>

                        <p className="text-xs text-muted-foreground">
                          {selectedConfig.count} requests •{" "}
                          {selectedConfig.concurrency} concurrent •{" "}
                          {selectedConfig.mode === "http"
                            ? "HTTP"
                            : selectedConfig.mode === "browser"
                              ? "Browser"
                              : "Random"}
                        </p>
                      </div>

                      <Button size="lg" onClick={handleStartExecution}>
                        <Play />
                        Start Execution
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-105 items-center justify-center p-8">
                    <div className="text-center">
                      <Globe className="mx-auto mb-4 size-10 text-muted-foreground" />

                      <h3 className="font-semibold">Select a target URL</h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Choose a URL from the sidebar to configure an execution.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Executions */}

              <section className="rounded-2xl border bg-card">
                <div className="flex items-center justify-between border-b p-5">
                  <div>
                    <h2 className="font-semibold">Executions</h2>

                    <p className="text-xs text-muted-foreground">
                      Run multiple targets at the same time.
                    </p>
                  </div>

                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {executions.length}
                  </span>
                </div>

                {executions.length === 0 ? (
                  <div className="p-12 text-center">
                    <Activity className="mx-auto mb-3 size-8 text-muted-foreground" />

                    <p className="font-medium">No executions yet</p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Start an execution above and its live progress will appear
                      here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 p-4 xl:grid-cols-2">
                    {executions.map((execution) => {
                      const progress =
                        execution.total > 0
                          ? Math.round(
                              (execution.completed / execution.total) * 100,
                            )
                          : 0;

                      const running = execution.status === "running";

                      return (
                        <div
                          key={execution.id}
                          className="rounded-2xl border bg-background p-4"
                        >
                          {/* Header */}

                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`size-2 rounded-full ${
                                    running
                                      ? "animate-pulse bg-emerald-500"
                                      : execution.status === "completed"
                                        ? "bg-blue-500"
                                        : execution.status === "cancelled"
                                          ? "bg-amber-500"
                                          : "bg-destructive"
                                  }`}
                                />

                                <h3 className="truncate font-semibold">
                                  {execution.urlName}
                                </h3>
                              </div>

                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {execution.url}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              {running ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleCancelExecution(execution.id)
                                  }
                                >
                                  <Pause />
                                  Cancel
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    handleRemoveExecution(execution.id)
                                  }
                                  title="Remove"
                                >
                                  <X />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Tags */}

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
                              {execution.mode.toUpperCase()}
                            </span>

                            <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
                              {execution.connection === "direct"
                                ? "DIRECT"
                                : `${execution.proxyIds.length} PROXY`}
                            </span>

                            {execution.connection === "proxy" && (
                              <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
                                {execution.proxyStrategy.replace("_", " ")}
                              </span>
                            )}

                            <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
                              {execution.count} req
                            </span>

                            <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
                              {execution.concurrency} concurrent
                            </span>
                          </div>

                          {/* Progress */}

                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Progress
                              </span>

                              <span className="font-semibold">
                                {execution.completed} / {execution.total}
                              </span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  running
                                    ? "bg-primary"
                                    : execution.status === "completed"
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground"
                                }`}
                                style={{
                                  width: `${progress}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Stats */}

                          <div className="mt-4 grid grid-cols-4 gap-2">
                            <div className="rounded-xl bg-muted/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground">
                                Success
                              </p>

                              <p className="mt-1 text-sm font-semibold">
                                {execution.success}
                              </p>
                            </div>

                            <div className="rounded-xl bg-muted/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground">
                                Failed
                              </p>

                              <p className="mt-1 text-sm font-semibold">
                                {execution.failed}
                              </p>
                            </div>

                            <div className="rounded-xl bg-muted/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground">
                                RPS
                              </p>

                              <p className="mt-1 text-sm font-semibold">
                                {execution.metrics.requests_per_second.toFixed(
                                  2,
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-muted/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground">
                                Success %
                              </p>

                              <p className="mt-1 text-sm font-semibold">
                                {execution.metrics.success_rate.toFixed(0)}%
                              </p>
                            </div>
                          </div>

                          {/* Footer */}

                          <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              {execution.status === "running" && (
                                <Loader2 className="size-3.5 animate-spin" />
                              )}

                              {execution.status === "completed" && (
                                <Check className="size-3.5 text-emerald-500" />
                              )}

                              {execution.status === "cancelled" && (
                                <Circle className="size-3.5 text-amber-500" />
                              )}

                              {execution.status === "failed" && (
                                <X className="size-3.5 text-destructive" />
                              )}

                              {execution.status.charAt(0).toUpperCase() +
                                execution.status.slice(1)}
                            </span>

                            <span>
                              {(execution.metrics.elapsed_ms / 1000).toFixed(2)}
                              s
                            </span>
                          </div>

                          {/* Results */}

                          {execution.results.length > 0 && (
                            <details className="mt-3">
                              <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                                <ChevronRight className="size-3" />
                                {execution.results.length} results
                              </summary>

                              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border p-2">
                                {[...execution.results]
                                  .reverse()
                                  .map(({ index, proxyId, result }) => {
                                    const proxy = proxyId
                                      ? proxies.find(
                                          (item) => item.id === proxyId,
                                        )
                                      : null;

                                    return (
                                      <div
                                        key={`${execution.id}-${index}`}
                                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span>#{index}</span>

                                          <span
                                            className={
                                              result.success
                                                ? "text-emerald-600"
                                                : "text-destructive"
                                            }
                                          >
                                            {result.status_code ?? "ERR"}
                                          </span>

                                          <span className="truncate text-muted-foreground">
                                            {proxy
                                              ? `${proxy.host}:${proxy.port}`
                                              : "Direct"}
                                          </span>
                                        </div>

                                        <span className="shrink-0 text-muted-foreground">
                                          {result.latency_ms}
                                          ms
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </main>
          </div>
        )}
      </div>

      {/* Add URL Modal */}

      {showUrlForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Add Target URL</h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Add another target to your workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUrlForm(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUrl} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-url-name">Name</Label>

                <Input
                  id="new-url-name"
                  value={urlName}
                  onChange={(event) => setUrlName(event.target.value)}
                  placeholder="GitHub"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-url">URL</Label>

                <Input
                  id="new-url"
                  type="url"
                  value={urlValue}
                  onChange={(event) => setUrlValue(event.target.value)}
                  placeholder="https://github.com"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUrlForm(false)}
                  disabled={urlSaving}
                >
                  Cancel
                </Button>

                <Button type="submit" disabled={urlSaving}>
                  {urlSaving ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus />
                      Add URL
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
