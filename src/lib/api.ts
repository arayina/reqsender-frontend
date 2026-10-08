const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not configured");
}

export type ProxyItem = {
  id: string;
  host: string;
  port: number;
  protocol: string;
  username: string | null;
  enabled: boolean;
};

export type ProxyCreate = {
  host: string;
  port: number;
  protocol: string;
  username?: string;
  password?: string;
  enabled: boolean;
};

export type ProxyUpdate = {
  host?: string;
  port?: number;
  protocol?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
};

export type TargetUrl = {
  id: string;
  url: string;
  name: string | null;
  enabled: boolean;
};

export type TargetUrlCreate = {
  url: string;
  name?: string;
  enabled: boolean;
};

export type TargetUrlUpdate = {
  url?: string;
  name?: string;
  enabled?: boolean;
};

export type RequestMode = "http" | "browser" | "random";

export type RequestExecution = {
  url: string;
  proxy_id: string | null;
  mode: RequestMode;
};

export type BatchRequestResult = {
  total: number;
  success: number;
  failed: number;
  results: RequestResult[];
};

export type BatchRequestExecution = {
  url: string;
  proxy_id: string | null;
  mode: RequestMode;
  count: number;
  concurrency: number;
};

export type RequestResult = {
  success: boolean;
  status_code: number | null;
  latency_ms: number;
  final_url: string | null;
  title: string | null;
  error: string | null;
};

export async function getProxies(): Promise<ProxyItem[]> {
  const response = await fetch(`${API_URL}/api/v1/proxies`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch proxies");
  }

  return response.json();
}

export async function createProxy(data: ProxyCreate): Promise<ProxyItem> {
  const response = await fetch(`${API_URL}/api/v1/proxies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  console.log("CREATE PROXY STATUS:", response.status);

  const responseText = await response.text();

  console.log("CREATE PROXY RESPONSE:", responseText);

  if (!response.ok) {
    throw new Error("Failed to create proxy");
  }

  return JSON.parse(responseText);
}
export async function deleteProxy(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/proxies/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete proxy");
  }
}

export async function updateProxy(
  id: string,
  data: ProxyUpdate,
): Promise<ProxyItem> {
  const response = await fetch(`${API_URL}/api/v1/proxies/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update proxy");
  }

  return response.json();
}

export async function getUrls(): Promise<TargetUrl[]> {
  const response = await fetch(`${API_URL}/api/v1/urls`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch URLs");
  }

  return response.json();
}

export async function createUrl(data: TargetUrlCreate): Promise<TargetUrl> {
  const response = await fetch(`${API_URL}/api/v1/urls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create URL");
  }

  return response.json();
}

export async function updateUrl(
  id: string,
  data: TargetUrlUpdate,
): Promise<TargetUrl> {
  const response = await fetch(`${API_URL}/api/v1/urls/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update URL");
  }

  return response.json();
}

export async function deleteUrl(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/urls/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete URL");
  }
}

export async function executeRequest(
  data: RequestExecution,
): Promise<RequestResult> {
  const response = await fetch(`${API_URL}/api/v1/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Request failed");
  }

  return result;
}

export async function executeBatchRequest(
  data: BatchRequestExecution,
): Promise<BatchRequestResult> {
  const response = await fetch(`${API_URL}/api/v1/requests/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Batch request failed");
  }

  return result;
}
export type BatchMetrics = {
  elapsed_ms: number;
  average_latency_ms: number;
  requests_per_second: number;
  success_rate: number;
};

export type BatchProgressEvent =
  | {
      type: "started";
      total: number;
      success: number;
      failed: number;
      completed: number;
      metrics: BatchMetrics;
    }
  | {
      type: "progress";
      index: number;
      completed: number;
      total: number;
      success: number;
      failed: number;
      result: RequestResult;
      metrics: BatchMetrics;
    }
  | {
      type: "completed";
      total: number;
      success: number;
      failed: number;
      completed: number;
      metrics: BatchMetrics;
    }
  | {
      type: "error";
      error: string;
    };

export async function executeBatchRequestStream(
  data: BatchRequestExecution,
  onEvent: (event: BatchProgressEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/requests/batch/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal,
  });

  if (!response.ok) {
    const result = await response.json();

    throw new Error(result.detail || "Batch stream failed");
  }

  if (!response.body) {
    throw new Error("Response body is not available");
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");

      buffer = events.pop() ?? "";

      for (const event of events) {
        const line = event.split("\n").find((line) => line.startsWith("data:"));

        if (!line) {
          continue;
        }

        const json = line.slice(5).trim();

        if (!json) {
          continue;
        }

        const parsed = JSON.parse(json) as BatchProgressEvent;

        onEvent(parsed);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
