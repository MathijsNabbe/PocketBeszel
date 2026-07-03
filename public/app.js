const REFRESH_INTERVAL = 60000;

const BAR_METRICS = [
  { key: "cpu", label: "CPU", className: "metric--cpu" },
  { key: "ram", label: "RAM", className: "metric--ram" },
];

const STAT_METRICS = [
  {
    key: "temperature",
    label: "TEMP",
    className: "metric--temp",
    format: (v) => (v > 0 ? `${v}°C` : "—"),
  },
  {
    key: "network",
    label: "NET",
    className: "metric--network",
    format: (v) => (v > 0 ? `${v} MB/s` : "—"),
  },
  {
    key: "containers",
    label: "DOCKER",
    className: "metric--containers",
    format: (v) => String(v),
  },
];

const state = {
  devices: [],
  viewMode: "loading",
  errorMessage: null,
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
  const value = device[metric.key] ?? 0;
  const level = metric.key === "temperature" ? getTempLevel(value) : "normal";

  const pill = document.createElement("div");
  pill.className = `stat-pill ${metric.className} stat-pill--${level}`;
  pill.dataset.metric = metric.key;

  const label = document.createElement("span");
  label.className = "stat-pill__label";
  label.textContent = metric.label;

  const valueEl = document.createElement("span");
  valueEl.className = "stat-pill__value";
  valueEl.textContent = metric.format(value);

  pill.append(label, valueEl);
  return pill;
}

function updateStatPill(pill, metric, device) {
  const value = device[metric.key] ?? 0;
  const level = metric.key === "temperature" ? getTempLevel(value) : "normal";

  pill.className = `stat-pill ${metric.className} stat-pill--${level}`;

  const valueEl = pill.querySelector(".stat-pill__value");
  if (valueEl) valueEl.textContent = metric.format(value);
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

  for (const metric of STAT_METRICS) {
    statRow.appendChild(createStatPill(metric, device));
  }

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

  for (const metric of STAT_METRICS) {
    const pill = card.querySelector(`.stat-pill[data-metric="${metric.key}"]`);
    if (pill) updateStatPill(pill, metric, device);
  }
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

    const count = document.createElement("span");
    count.className = "dashboard-header__count";
    count.textContent = `${state.devices.length} server${state.devices.length === 1 ? "" : "s"}`;

    header.append(title, count);

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
    const response = await fetch("/api/devices");

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

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchDevices();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) fetchDevices();
});
