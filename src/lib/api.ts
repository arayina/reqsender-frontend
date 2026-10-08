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
