const REFRESH_INTERVAL = 60000;

const BAR_METRICS = [
  { key: "cpu", label: "CPU", className: "metric--cpu" },
  { key: "ram", label: "RAM", className: "metric--ram" },
];

const state = {
  devices: [],
  viewMode: "loading",
  errorMessage: null,
  secondsUntilRefresh: REFRESH_INTERVAL / 1000,
};

const app = document.getElementById("app");

function getUsageLevel(value) {
  if (value >= 85) return "critical";
  if (value >= 60) return "warning";
  return "normal";
}

function getTempLevel(value) {
  if (value >= 85) return "critical";
  if (value >= 70) return "warning";
  return "normal";
}

function formatBytesPerSecond(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 B/s";
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function getStatMetrics(device) {
  const metrics = [];

  if (device.cpuTemp !== null && device.cpuTemp > 0) {
    metrics.push({
      key: "cpuTemp",
      label: "CPU",
      className: "metric--temp",
      format: (v) => `${v}°C`,
      level: (v) => getTempLevel(v),
    });
  }

  if (device.gpuTemp !== null && device.gpuTemp > 0) {
    metrics.push({
      key: "gpuTemp",
      label: "GPU",
      className: "metric--gpu-temp",
      format: (v) => `${v}°C`,
      level: (v) => getTempLevel(v),
    });
  }

  metrics.push({
    key: "network",
    label: "NET",
    className: "metric--network",
    format: (_v, dev) => `↓${formatBytesPerSecond(dev.netDown)} ↑${formatBytesPerSecond(dev.netUp)}`,
    level: () => "normal",
    isNetwork: true,
  });

  if (device.containers !== null && device.containers > 0) {
    metrics.push({
      key: "containers",
      label: "DOCKER",
      className: "metric--containers",
      format: (v) => String(v),
      level: () => "normal",
    });
  }

  return metrics;
}

function createMetricRow(metric, device) {
  const value = device[metric.key] ?? 0;
  const level = getUsageLevel(value);

  const row = document.createElement("div");
  row.className = `metric-row ${metric.className}`;
  row.dataset.metric = metric.key;

  const header = document.createElement("div");
  header.className = "metric-row__header";

  const label = document.createElement("span");
  label.className = "metric-row__label";
  label.textContent = metric.label;

  const valueEl = document.createElement("span");
  valueEl.className = "metric-row__value";
  valueEl.textContent = `${value}%`;

  header.append(label, valueEl);

  const bar = document.createElement("div");
  bar.className = "progress-bar";

  const fill = document.createElement("div");
  fill.className = `progress-fill progress-fill--${level}`;
  fill.style.width = `${value}%`;
  fill.dataset.value = String(value);

  bar.appendChild(fill);
  row.append(header, bar);
  return row;
}

function updateMetricRow(row, metric, device) {
  const value = device[metric.key] ?? 0;
  const level = getUsageLevel(value);

  const valueEl = row.querySelector(".metric-row__value");
  if (valueEl) valueEl.textContent = `${value}%`;

  const fill = row.querySelector(".progress-fill");
  if (fill) {
    fill.className = `progress-fill progress-fill--${level}`;
    if (fill.dataset.value !== String(value)) {
      fill.style.width = `${value}%`;
      fill.dataset.value = String(value);
    }
  }
}

function createStatPill(metric, device) {
  const value = device[metric.key];
  const level = metric.level(metric.isNetwork ? 0 : value);

  const pill = document.createElement("div");
  pill.className = `stat-pill ${metric.className} stat-pill--${level}`;
  pill.dataset.metric = metric.key;
  if (metric.isNetwork) {
    pill.classList.add("stat-pill--wide");
  }

  const label = document.createElement("span");
  label.className = "stat-pill__label";
  label.textContent = metric.label;

  const valueEl = document.createElement("span");
  valueEl.className = "stat-pill__value";
  valueEl.textContent = metric.format(value, device);

  pill.append(label, valueEl);
  return pill;
}

function updateStatPill(pill, metric, device) {
  const value = device[metric.key];
  const level = metric.level(metric.isNetwork ? 0 : value);

  pill.className = `stat-pill ${metric.className} stat-pill--${level}`;
  pill.dataset.metric = metric.key;
  if (metric.isNetwork) {
    pill.classList.add("stat-pill--wide");
  }

  const valueEl = pill.querySelector(".stat-pill__value");
  if (valueEl) valueEl.textContent = metric.format(value, device);
}

function renderStatRow(statRow, device, isUpdate) {
  const metrics = getStatMetrics(device);
  statRow.dataset.columns = String(Math.min(metrics.length, 4));

  if (!isUpdate) {
    statRow.innerHTML = "";
    for (const metric of metrics) {
      statRow.appendChild(createStatPill(metric, device));
    }
    return;
  }

  const existing = [...statRow.querySelectorAll(".stat-pill")];
  const existingKeys = new Set(existing.map((pill) => pill.dataset.metric));

  for (const metric of metrics) {
    const pill = statRow.querySelector(`[data-metric="${metric.key}"]`);
    if (pill) {
      updateStatPill(pill, metric, device);
      existingKeys.delete(metric.key);
    } else {
      statRow.appendChild(createStatPill(metric, device));
    }
  }

  for (const key of existingKeys) {
    statRow.querySelector(`[data-metric="${key}"]`)?.remove();
  }
}

function createDeviceCard(device) {
  const card = document.createElement("article");
  card.className = "device-card";
  card.dataset.id = device.id;

  const name = document.createElement("h2");
  name.className = "device-card__name";
  name.textContent = device.name;

  const metrics = document.createElement("div");
  metrics.className = "device-card__metrics";

  for (const metric of BAR_METRICS) {
    metrics.appendChild(createMetricRow(metric, device));
  }

  const statRow = document.createElement("div");
  statRow.className = "stat-row";
  renderStatRow(statRow, device, false);

  metrics.appendChild(statRow);
  card.append(name, metrics);
  return card;
}

function updateDeviceCard(card, device) {
  const nameEl = card.querySelector(".device-card__name");
  if (nameEl) nameEl.textContent = device.name;

  for (const metric of BAR_METRICS) {
    const row = card.querySelector(`[data-metric="${metric.key}"]`);
    if (row) updateMetricRow(row, metric, device);
  }

  const statRow = card.querySelector(".stat-row");
  if (statRow) renderStatRow(statRow, device, true);
}

function updateRefreshTimerDisplay() {
  const timerEl = document.querySelector(".dashboard-header__timer");
  if (!timerEl) return;

  const minutes = Math.floor(state.secondsUntilRefresh / 60);
  const seconds = state.secondsUntilRefresh % 60;
  timerEl.textContent = `Refresh ${minutes}:${String(seconds).padStart(2, "0")}`;
}

function startRefreshCountdown() {
  state.secondsUntilRefresh = REFRESH_INTERVAL / 1000;
  updateRefreshTimerDisplay();

  setInterval(() => {
    state.secondsUntilRefresh -= 1;
    updateRefreshTimerDisplay();

    if (state.secondsUntilRefresh <= 0) {
      window.location.reload();
    }
  }, 1000);
}

function renderStatePage(message) {
  app.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "dashboard dashboard--state";

  const msg = document.createElement("div");
  msg.className = "state-message";
  msg.textContent = message;

  shell.appendChild(msg);
  app.appendChild(shell);
}

function renderDashboard(isUpdate = false) {
  if (state.devices.length === 0) {
    renderStatePage(state.errorMessage ?? "No devices found");
    return;
  }

  let shell = app.querySelector(".dashboard");
  let grid = app.querySelector(".device-grid");

  if (!isUpdate || !shell) {
    app.innerHTML = "";

    shell = document.createElement("div");
    shell.className = "dashboard";

    const header = document.createElement("header");
    header.className = "dashboard-header";

    const title = document.createElement("h1");
    title.className = "dashboard-header__title";
    title.textContent = "Beszel";

    const meta = document.createElement("div");
    meta.className = "dashboard-header__meta";

    const count = document.createElement("span");
    count.className = "dashboard-header__count";
    count.textContent = `${state.devices.length} server${state.devices.length === 1 ? "" : "s"}`;

    const timer = document.createElement("span");
    timer.className = "dashboard-header__timer";
    timer.textContent = "Refresh 1:00";

    meta.append(count, timer);
    header.append(title, meta);

    grid = document.createElement("div");
    grid.className = "device-grid";

    shell.append(header, grid);
    app.appendChild(shell);
  }

  grid.dataset.count = String(Math.min(state.devices.length, 6));

  const countEl = shell.querySelector(".dashboard-header__count");
  if (countEl) {
    countEl.textContent = `${state.devices.length} server${state.devices.length === 1 ? "" : "s"}`;
  }

  updateRefreshTimerDisplay();

  const existingCards = [...grid.querySelectorAll(".device-card")];
  const existingById = new Map(existingCards.map((card) => [card.dataset.id, card]));

  for (const device of state.devices) {
    const existing = existingById.get(device.id);
    if (existing) {
      updateDeviceCard(existing, device);
      existingById.delete(device.id);
    } else {
      grid.appendChild(createDeviceCard(device));
    }
  }

  for (const stale of existingById.values()) {
    stale.remove();
  }
}

async function fetchDevices() {
  try {
    const response = await fetch("/api/devices", { cache: "no-store" });

    if (!response.ok) {
      if (response.status === 503) {
        state.viewMode = "error";
        state.errorMessage = "Cannot connect to Beszel";
        state.devices = [];
        renderStatePage(state.errorMessage);
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const devices = await response.json();

    if (!Array.isArray(devices) || devices.length === 0) {
      state.viewMode = "empty";
      state.errorMessage = "No devices found";
      state.devices = [];
      renderStatePage(state.errorMessage);
      return;
    }

    const isUpdate = state.viewMode === "dashboard";
    state.viewMode = "dashboard";
    state.errorMessage = null;
    state.devices = devices;
    renderDashboard(isUpdate);
  } catch {
    state.viewMode = "error";
    state.errorMessage = "Backend Offline";
    state.devices = [];
    renderStatePage(state.errorMessage);
  }
}

fetchDevices();
setInterval(fetchDevices, REFRESH_INTERVAL);
startRefreshCountdown();

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    state.secondsUntilRefresh = REFRESH_INTERVAL / 1000;
    fetchDevices();
  }
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    state.secondsUntilRefresh = REFRESH_INTERVAL / 1000;
    fetchDevices();
  }
});
