import { createChromeSystemProvider } from "./metrics/chromeSystemProvider.js";
import { mockProvider } from "./metrics/mockProvider.js";
import type { MetricsProvider } from "./metrics/provider.js";
import type { MetricsSnapshot } from "./metrics/types.js";
import { displayLabel, storageLabel } from "./utils/displayFormat.js";
import { formatBytes, formatPercent, formatTimestamp } from "./utils/format.js";
import type { StorageUnitMetrics } from "./metrics/types.js";

const DEFAULT_REFRESH_INTERVAL_MS = 1000;
const DEFAULT_EXPANDED = true;
const SETTINGS_KEY = "system-monitor-settings";
const isExtensionRuntime = typeof globalThis.chrome?.system !== "undefined";
const provider: MetricsProvider = isExtensionRuntime ? createChromeSystemProvider() : mockProvider;

const shell = document.querySelector<HTMLElement>(".popup-shell");
const lastUpdated = document.querySelector<HTMLElement>("#last-updated");
const tickerContent = document.querySelector<HTMLElement>("#ticker-content");
const detailsPanel = document.querySelector<HTMLElement>("#details-panel");
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button");
const detailsButton = document.querySelector<HTMLButtonElement>("#details-button");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button");
const refreshIntervalSelect = document.querySelector<HTMLSelectElement>("#refresh-interval");
const openExpandedInput = document.querySelector<HTMLInputElement>("#open-expanded");

let expanded = DEFAULT_EXPANDED;
let settingsOpen = false;
let refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS;
let timerId: number | undefined;
let latestSnapshot: MetricsSnapshot | undefined;

refreshButton?.addEventListener("click", () => void refresh());
detailsButton?.addEventListener("click", () => {
  expanded = !expanded;
  saveSettings();
  render(latestSnapshot);
});
settingsButton?.addEventListener("click", () => {
  settingsOpen = !settingsOpen;
  render(latestSnapshot);
});
refreshIntervalSelect?.addEventListener("change", () => {
  refreshIntervalMs = Number(refreshIntervalSelect.value) || DEFAULT_REFRESH_INTERVAL_MS;
  saveSettings();
  startPolling();
});
openExpandedInput?.addEventListener("change", () => {
  expanded = Boolean(openExpandedInput.checked);
  saveSettings();
  render(latestSnapshot);
});

window.addEventListener("pagehide", () => stopPolling());

const startPolling = (): void => {
  stopPolling();
  void refresh();
  timerId = window.setInterval(() => void refresh(), refreshIntervalMs);
};

const stopPolling = (): void => {
  if (timerId) window.clearInterval(timerId);
  timerId = undefined;
};

const refresh = async (): Promise<void> => {
  latestSnapshot = await provider.getSnapshot();
  render(latestSnapshot);
};

const render = (snapshot: MetricsSnapshot | undefined): void => {
  if (!snapshot || !shell || !lastUpdated || !tickerContent || !detailsPanel || !settingsPanel || !detailsButton || !settingsButton) return;

  shell.dataset.expanded = String(expanded);
  lastUpdated.textContent = `Last updated ${formatTimestamp(snapshot.updatedAt)}`;
  tickerContent.innerHTML = tickerItems(snapshot).join("");
  detailsPanel.hidden = !expanded;
  settingsPanel.hidden = !settingsOpen;
  detailsButton.setAttribute("aria-expanded", String(expanded));
  settingsButton.setAttribute("aria-expanded", String(settingsOpen));
  detailsButton.querySelector("span")!.textContent = expanded ? "Compact" : "Details";
  settingsButton.querySelector("span")!.textContent = settingsOpen ? "Close" : "Settings";

  if (expanded) {
    detailsPanel.innerHTML = detailCards(snapshot).join("");
  }
};

const tickerItems = (snapshot: MetricsSnapshot): string[] => {
  return [
    metric("cpu", "◫", "CPU", snapshot.cpu.clockGhz ? `${snapshot.cpu.clockGhz.toFixed(2)} GHz` : formatPercent(snapshot.cpu.usagePercent)),
    metric("ram", "▥", "RAM", formatPercent(snapshot.memory.usedPercent)),
    metric("ssd", "▤", "SSD", storageLabel(snapshot.storage)),
    metric("disp", "▭", "DISP", displayLabel(snapshot.display))
  ];
};

const metric = (kind: string, icon: string, name: string, value: string): string => {
  return `
    <div class="ticker-item ${kind}" style="--accent: var(--${kind})">
      <span class="metric-icon">${icon}</span>
      <span class="metric-copy">
        <span class="metric-name">${name}</span>
        <span class="metric-value">${value}</span>
      </span>
    </div>`;
};

const detailCards = (snapshot: MetricsSnapshot): string[] => {
  return [
    card("cpu", "◫", "CPU", snapshot.cpu.history, cpuDetail(snapshot)),
    card("ram", "▥", "RAM", snapshot.memory.history, memoryDetail(snapshot)),
    card("ssd", "▤", "SSD", snapshot.storage.history, storageDetail(snapshot)),
    card("disp", "▭", "DISP", [65, 65, 65, 65, 65], displayDetail(snapshot))
  ];
};

const card = (kind: string, icon: string, title: string, history: number[], meta: string): string => {
  const bars = (history.length ? history : [10, 30, 20, 45, 35])
    .slice(-22)
    .map((value) => `<span style="--h:${Math.max(8, Math.min(100, value))}"></span>`)
    .join("");

  return `
    <article class="detail-card ${kind}" style="--accent: var(--${kind})">
      <div class="detail-title"><span class="metric-icon">${icon}</span>${title}</div>
      <div class="spark" aria-hidden="true">${bars}</div>
      <div class="detail-meta">${meta}</div>
    </article>`;
};

const cpuDetail = (snapshot: MetricsSnapshot): string => {
  const usage = formatPercent(snapshot.cpu.usagePercent);
  const cores = snapshot.cpu.perCoreUsagePercent ?? [];
  const coreBars = cores
    .slice(0, 16)
    .map((value, index) => `<span title="Core ${index + 1}: ${formatPercent(value)}" style="--h:${Math.max(6, Math.min(100, value))}"></span>`)
    .join("");
  const model = snapshot.cpu.modelName ?? "Unknown CPU";
  const processorCount = snapshot.cpu.logicalProcessors ? `${snapshot.cpu.logicalProcessors} logical` : "No core data";

  return `
    <div class="stat-primary">${usage}</div>
    <div class="stat-subtitle">${model}</div>
    <div class="stat-grid">
      <span>Total</span><strong>${usage}</strong>
      <span>Cores</span><strong>${processorCount}</strong>
    </div>
    <div class="core-grid" aria-label="Per-core CPU usage">${coreBars || "<em>No per-core data</em>"}</div>`;
};

const memoryDetail = (snapshot: MetricsSnapshot): string => {
  if (snapshot.memory.usedBytes === undefined || snapshot.memory.capacityBytes === undefined) return "No data";
  return `
    <div class="stat-primary">${formatPercent(snapshot.memory.usedPercent)}</div>
    <div class="stat-subtitle">${formatBytes(snapshot.memory.usedBytes)} used</div>
    <div class="meter"><span style="--w:${Math.max(0, Math.min(100, snapshot.memory.usedPercent ?? 0))}"></span></div>
    <div class="stat-grid">
      <span>Total</span><strong>${formatBytes(snapshot.memory.capacityBytes)}</strong>
      <span>Available</span><strong>${formatBytes(snapshot.memory.availableBytes)}</strong>
      <span>Used</span><strong>${formatBytes(snapshot.memory.usedBytes)}</strong>
    </div>`;
};

const storageDetail = (snapshot: MetricsSnapshot): string => {
  const units: StorageUnitMetrics[] = snapshot.storage.units.length
    ? snapshot.storage.units
    : [fallbackStorageUnit(snapshot)];
  const rows = units
    .slice(0, 3)
    .map((unit, index) => {
      const name = escapeHtml(unit.name ?? unit.id ?? `Drive ${index + 1}`);
      const type = escapeHtml(unit.type ?? "unknown");
      const capacity = formatBytes(unit.capacityBytes).replace(".0 ", " ");
      const available = formatBytes(unit.availableBytes).replace(".0 ", " ");
      return `<li><span><strong>${name}</strong><small>${type}</small></span><b>${available} free</b><small>${capacity} total</small></li>`;
    })
    .join("");

  return `
    <div class="stat-primary">${storageLabel(snapshot.storage)}</div>
    <ul class="mini-list">${rows}</ul>`;
};

const displayDetail = (snapshot: MetricsSnapshot): string => {
  const displays = snapshot.display.displays.length
    ? snapshot.display.displays
    : snapshot.display.primary
      ? [{ ...snapshot.display.primary, isPrimary: true }]
      : [];
  const rows = displays
    .slice(0, 3)
    .map((display, index) => {
      const name = escapeHtml(display.name ?? `Display ${index + 1}`);
      const resolution = display.width && display.height ? `${display.width}x${display.height}` : "No resolution";
      const refreshRate = display.refreshRate ? `${display.refreshRate} Hz` : "";
      return `<li><span><strong>${name}</strong><small>${display.isPrimary ? "Primary" : "External"}</small></span><b>${resolution}</b><small>${refreshRate}</small></li>`;
    })
    .join("");

  return `
    <div class="stat-primary">${snapshot.display.count ?? displays.length} display${(snapshot.display.count ?? displays.length) === 1 ? "" : "s"}</div>
    <div class="stat-subtitle">${displayLabel(snapshot.display)}</div>
    <ul class="mini-list">${rows}</ul>`;
};

const fallbackStorageUnit = (snapshot: MetricsSnapshot): StorageUnitMetrics => {
  const unit: StorageUnitMetrics = { type: "unknown" };
  if (snapshot.storage.capacityBytes !== undefined) unit.capacityBytes = snapshot.storage.capacityBytes;
  if (snapshot.storage.availableBytes !== undefined) unit.availableBytes = snapshot.storage.availableBytes;
  return unit;
};

const escapeHtml = (value: string): string => {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[char] ?? char;
  });
};

const loadSettings = (): void => {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { refreshIntervalMs?: number; expanded?: boolean };
    refreshIntervalMs = stored.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    expanded = stored.expanded ?? DEFAULT_EXPANDED;
  } catch {
    refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS;
    expanded = DEFAULT_EXPANDED;
  }

  if (refreshIntervalSelect) refreshIntervalSelect.value = String(refreshIntervalMs);
  if (openExpandedInput) openExpandedInput.checked = expanded;
};

const saveSettings = (): void => {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      refreshIntervalMs,
      expanded
    })
  );

  if (refreshIntervalSelect) refreshIntervalSelect.value = String(refreshIntervalMs);
  if (openExpandedInput) openExpandedInput.checked = expanded;
};

loadSettings();
startPolling();
