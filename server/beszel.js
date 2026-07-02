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

export function normalizeDevice(record) {
  const info = record.info ?? {};
  return {
    id: record.id,
    name: record.name ?? "Unknown",
    cpu: roundMetric(info.cpu),
    ram: roundMetric(info.mp),
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

async function fetchSystems(token) {
  const url = new URL(`${config.beszelUrl}/api/collections/systems/records`);
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", "500");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(config.requestTimeout),
  });

  return response;
}

export async function fetchDevices() {
  try {
    let token = await ensureToken();
    if (!token) {
      setCache([], "offline");
      return { ok: false, devices: [], beszelStatus: "offline" };
    }

    let response = await fetchSystems(token);

    if (response.status === 401) {
      token = await ensureToken(true);
      if (!token) {
        setCache([], "offline");
        return { ok: false, devices: [], beszelStatus: "offline" };
      }
      response = await fetchSystems(token);
    }

    if (!response.ok) {
      console.error(`Beszel API error: ${response.status} ${response.statusText}`);
      cache.beszelStatus = "offline";
      return {
        ok: false,
        devices: cache.devices,
        beszelStatus: "offline",
      };
    }

    const data = await response.json();
    const items = data.items ?? [];
    const devices = items.map(normalizeDevice);

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
