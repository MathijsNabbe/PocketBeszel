import config from "./config.js";

const cache = {
  devices: [],
  beszelStatus: "offline",
  lastUpdated: null,
};

let activeToken = config.apiKey;

export function getCache() {
  return { ...cache, devices: [...cache.devices] };
}

function setCache(devices, beszelStatus) {
  cache.devices = devices;
  cache.beszelStatus = beszelStatus;
  cache.lastUpdated = Date.now();
}

function roundMetric(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(Math.min(100, Math.max(0, value)));
}

function roundDecimal(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

function isRunningContainer(status) {
  if (typeof status !== "string") {
    return false;
  }
  const normalized = status.toLowerCase();
  return normalized.startsWith("up") || normalized === "running";
}

function countContainersBySystem(items) {
  const counts = {};
  for (const record of items) {
    if (!isRunningContainer(record.status)) {
      continue;
    }
    const systemId = record.system;
    if (!systemId) {
      continue;
    }
    counts[systemId] = (counts[systemId] ?? 0) + 1;
  }
  return counts;
}

export function normalizeDevice(record, containerCounts) {
  const info = record.info ?? {};
  return {
    id: record.id,
    name: record.name ?? "Unknown",
    cpu: roundMetric(info.cpu),
    ram: roundMetric(info.mp),
    temperature: roundDecimal(info.dt),
    network: roundDecimal(info.b),
    containers: containerCounts[record.id] ?? 0,
  };
}

async function authenticateWithPassword() {
  if (!config.email || !config.password) {
    return null;
  }

  const response = await fetch(
    `${config.beszelUrl}/api/collections/users/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: config.email,
        password: config.password,
      }),
      signal: AbortSignal.timeout(config.requestTimeout),
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.token ?? null;
}

async function ensureToken(forceRefresh = false) {
  if (forceRefresh) {
    activeToken = null;
  }

  if (!forceRefresh && activeToken) {
    return activeToken;
  }

  if (config.apiKey && !forceRefresh) {
    activeToken = config.apiKey;
    return activeToken;
  }

  const token = await authenticateWithPassword();
  if (token) {
    activeToken = token;
  }

  return activeToken;
}

async function beszelFetch(path, token, params = {}) {
  const url = new URL(`${config.beszelUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(config.requestTimeout),
  });
}

async function fetchWithAuth(path, params = {}) {
  let token = await ensureToken();
  if (!token) {
    return null;
  }

  let response = await beszelFetch(path, token, params);

  if (response.status === 401) {
    token = await ensureToken(true);
    if (!token) {
      return null;
    }
    response = await beszelFetch(path, token, params);
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function fetchDevices() {
  try {
    const [systemsData, containersData] = await Promise.all([
      fetchWithAuth("/api/collections/systems/records", {
        page: "1",
        perPage: "500",
      }),
      fetchWithAuth("/api/collections/containers/records", {
        page: "1",
        perPage: "2000",
        fields: "id,system,status",
      }),
    ]);

    if (!systemsData) {
      console.error("Beszel API error: failed to fetch systems");
      cache.beszelStatus = "offline";
      return {
        ok: false,
        devices: cache.devices,
        beszelStatus: "offline",
      };
    }

    const items = systemsData.items ?? [];
    const containerCounts = countContainersBySystem(containersData?.items ?? []);
    const devices = items.map((record) => normalizeDevice(record, containerCounts));

    setCache(devices, "ok");
    return { ok: true, devices, beszelStatus: "ok" };
  } catch (error) {
    console.error("Failed to fetch devices from Beszel:", error.message);
    cache.beszelStatus = "offline";
    return {
      ok: false,
      devices: cache.devices,
      beszelStatus: "offline",
    };
  }
}

export async function refreshCache() {
  return fetchDevices();
}
