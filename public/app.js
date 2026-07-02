const REFRESH_INTERVAL = 30000;

const METRICS = [
  { key: "cpu", label: "CPU", format: (v) => `${v}%` },
  { key: "ram", label: "RAM", format: (v) => `${v}%` },
];

const state = {
  devices: [],
  currentPageIndex: 0,
  viewMode: "loading",
  errorMessage: null,
  hasMultiplePages: false,
};

const app = document.getElementById("app");

function buildPages() {
  if (state.devices.length === 0) {
    return [];
  }
  if (state.devices.length === 1) {
    return [{ type: "device", device: state.devices[0] }];
  }
  return [
    { type: "overview" },
    ...state.devices.map((device) => ({ type: "device", device })),
  ];
}

function createProgressBar(value) {
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${value}%`;
  fill.dataset.value = String(value);
  bar.appendChild(fill);
  return { bar, fill };
}

function renderMetric(metric, device, existingEl) {
  const value = device[metric.key] ?? 0;

  if (existingEl) {
    const valueEl = existingEl.querySelector(".metric-value");
    const fillEl = existingEl.querySelector(".progress-fill");
    if (valueEl && valueEl.textContent !== metric.format(value)) {
      valueEl.textContent = metric.format(value);
    }
    if (fillEl && fillEl.dataset.value !== String(value)) {
      fillEl.style.width = `${value}%`;
      fillEl.dataset.value = String(value);
    }
    return existingEl;
  }

  const metricEl = document.createElement("div");
  metricEl.className = "metric";
  metricEl.dataset.metric = metric.key;

  const label = document.createElement("div");
  label.className = "metric-label";
  label.textContent = metric.label;

  const valueEl = document.createElement("div");
  valueEl.className = "metric-value";
  valueEl.textContent = metric.format(value);

  const { bar } = createProgressBar(value);

  metricEl.append(label, valueEl, bar);
  return metricEl;
}

function renderOverviewPage(card, existingCard) {
  if (existingCard) {
    const list = existingCard.querySelector(".overview-list");
    const items = list?.querySelectorAll(".overview-item") ?? [];

    state.devices.forEach((device, index) => {
      const item = items[index];
      if (!item) return;

      const cpuEl = item.querySelector('[data-stat="cpu"]');
      const ramEl = item.querySelector('[data-stat="ram"]');
      if (cpuEl) cpuEl.textContent = `${device.cpu}%`;
      if (ramEl) ramEl.textContent = `${device.ram}%`;
    });

    return existingCard;
  }

  card.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "card-title";
  title.textContent = "Overview";

  const list = document.createElement("div");
  list.className = "overview-list";

  for (const device of state.devices) {
    const item = document.createElement("div");
    item.className = "overview-item";

    const name = document.createElement("span");
    name.className = "overview-name";
    name.textContent = device.name;

    const stats = document.createElement("div");
    stats.className = "overview-stats";

    const cpuStat = document.createElement("span");
    cpuStat.className = "overview-stat";
    cpuStat.dataset.stat = "cpu";
    cpuStat.textContent = `${device.cpu}%`;

    const ramStat = document.createElement("span");
    ramStat.className = "overview-stat";
    ramStat.dataset.stat = "ram";
    ramStat.textContent = `${device.ram}%`;

    stats.append(cpuStat, ramStat);
    item.append(name, stats);
    list.appendChild(item);
  }

  card.append(title, list);
  return card;
}

function renderDevicePage(card, device, existingCard) {
  if (existingCard) {
    const nameEl = existingCard.querySelector(".device-name");
    if (nameEl) nameEl.textContent = device.name;

    const metricsEl = existingCard.querySelector(".metrics");
    if (metricsEl) {
      METRICS.forEach((metric) => {
        const existing = metricsEl.querySelector(`[data-metric="${metric.key}"]`);
        renderMetric(metric, device, existing);
      });
    }

    return existingCard;
  }

  card.innerHTML = "";

  const name = document.createElement("h1");
  name.className = "device-name";
  name.textContent = device.name;

  const metricsEl = document.createElement("div");
  metricsEl.className = "metrics";

  for (const metric of METRICS) {
    metricsEl.appendChild(renderMetric(metric, device));
  }

  card.append(name, metricsEl);
  return card;
}

function renderStatePage(message) {
  app.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card";

  const msg = document.createElement("div");
  msg.className = "state-message";
  msg.textContent = message;

  card.appendChild(msg);
  app.appendChild(card);
}

function renderNavigation() {
  const existingPrev = app.querySelector(".nav-btn--prev");
  const existingNext = app.querySelector(".nav-btn--next");

  if (!state.hasMultiplePages) {
    existingPrev?.remove();
    existingNext?.remove();
    return;
  }

  let prevBtn = existingPrev;
  let nextBtn = existingNext;

  if (!prevBtn) {
    prevBtn = document.createElement("button");
    prevBtn.className = "nav-btn nav-btn--prev";
    prevBtn.setAttribute("aria-label", "Previous page");
    prevBtn.textContent = "◀";
    prevBtn.addEventListener("click", () => navigate(-1));
    app.appendChild(prevBtn);
  }

  if (!nextBtn) {
    nextBtn = document.createElement("button");
    nextBtn.className = "nav-btn nav-btn--next";
    nextBtn.setAttribute("aria-label", "Next page");
    nextBtn.textContent = "▶";
    nextBtn.addEventListener("click", () => navigate(1));
    app.appendChild(nextBtn);
  }
}

function renderCurrentPage(isUpdate = false) {
  const pages = buildPages();

  if (pages.length === 0) {
    renderStatePage(state.errorMessage ?? "No devices found");
    return;
  }

  if (state.currentPageIndex >= pages.length) {
    state.currentPageIndex = 0;
  }

  state.hasMultiplePages = pages.length > 1;
  const page = pages[state.currentPageIndex];

  let card = app.querySelector(".card");

  if (!isUpdate || !card) {
    app.innerHTML = "";
    card = document.createElement("div");
    card.className = "card";
    app.appendChild(card);
  }

  if (page.type === "overview") {
    renderOverviewPage(card, isUpdate ? card : null);
  } else {
    renderDevicePage(card, page.device, isUpdate ? card : null);
  }

  renderNavigation();
}

function navigate(direction) {
  const pages = buildPages();
  if (pages.length <= 1) return;

  state.currentPageIndex =
    (state.currentPageIndex + direction + pages.length) % pages.length;
  renderCurrentPage(false);
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
    renderCurrentPage(isUpdate);
  } catch {
    state.viewMode = "error";
    state.errorMessage = "Backend Offline";
    state.devices = [];
    renderStatePage(state.errorMessage);
  }
}

fetchDevices();
setInterval(fetchDevices, REFRESH_INTERVAL);
