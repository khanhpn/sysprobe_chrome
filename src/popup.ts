import { createChromeSystemProvider } from "./metrics/chromeSystemProvider.js";
import { mockProvider } from "./metrics/mockProvider.js";
import type { MetricsProvider } from "./metrics/provider.js";
import type { MetricsSnapshot } from "./metrics/types.js";
import { displayLabel, networkLabel, storageLabel } from "./utils/displayFormat.js";
import { formatBytes, formatPercent, formatTimestamp } from "./utils/format.js";

const DEFAULT_REFRESH_INTERVAL_MS = 1000;
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

let expanded = false;
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
    metric("net", "↕", "NET", networkLabel(snapshot.network)),
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
    card("ssd", "▤", "SSD", snapshot.storage.history, storageLabel(snapshot.storage)),
    card("net", "↕", "NET", snapshot.network.history, networkLabel(snapshot.network)),
    card("disp", "▭", "DISP", [65, 65, 65, 65, 65], displayLabel(snapshot.display))
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
  return snapshot.cpu.clockGhz ? `${usage} · ${snapshot.cpu.clockGhz.toFixed(2)} GHz` : usage;
};

const memoryDetail = (snapshot: MetricsSnapshot): string => {
  if (snapshot.memory.usedBytes === undefined || snapshot.memory.capacityBytes === undefined) return "No data";
  return `${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.capacityBytes)}`;
};

const loadSettings = (): void => {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { refreshIntervalMs?: number; expanded?: boolean };
    refreshIntervalMs = stored.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    expanded = stored.expanded ?? false;
  } catch {
    refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS;
    expanded = false;
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
