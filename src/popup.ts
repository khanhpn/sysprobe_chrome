import { createChromeSystemProvider } from "./metrics/chromeSystemProvider.js";
import { mockProvider } from "./metrics/mockProvider.js";
import type { MetricsProvider } from "./metrics/provider.js";
import type { MetricsSnapshot, SupportValue } from "./metrics/types.js";
import { formatBytes, formatPercent, formatSpeed, formatTimestamp } from "./utils/format.js";

const REFRESH_INTERVAL_MS = 2000;
const isExtensionRuntime = typeof globalThis.chrome?.system !== "undefined";
const provider: MetricsProvider = isExtensionRuntime ? createChromeSystemProvider() : mockProvider;

const shell = document.querySelector<HTMLElement>(".popup-shell");
const lastUpdated = document.querySelector<HTMLElement>("#last-updated");
const tickerContent = document.querySelector<HTMLElement>("#ticker-content");
const detailsPanel = document.querySelector<HTMLElement>("#details-panel");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button");
const detailsButton = document.querySelector<HTMLButtonElement>("#details-button");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button");

let expanded = false;
let timerId: number | undefined;
let latestSnapshot: MetricsSnapshot | undefined;

refreshButton?.addEventListener("click", () => void refresh());
detailsButton?.addEventListener("click", () => {
  expanded = !expanded;
  render(latestSnapshot);
});
settingsButton?.addEventListener("click", () => {
  settingsButton.title = "Settings will be added after the first stable UI version.";
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") startPolling();
  else stopPolling();
});

window.addEventListener("pagehide", () => stopPolling());

const startPolling = (): void => {
  stopPolling();
  void refresh();
  timerId = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
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
  if (!snapshot || !shell || !lastUpdated || !tickerContent || !detailsPanel || !detailsButton) return;

  shell.dataset.expanded = String(expanded);
  lastUpdated.textContent = `Last updated ${formatTimestamp(snapshot.updatedAt)}`;
  tickerContent.innerHTML = tickerItems(snapshot).join("");
  detailsPanel.hidden = !expanded;
  detailsButton.setAttribute("aria-expanded", String(expanded));
  detailsButton.querySelector("span")!.textContent = expanded ? "Compact" : "Details";

  if (expanded) {
    detailsPanel.innerHTML = detailCards(snapshot).join("");
  }
};

const tickerItems = (snapshot: MetricsSnapshot): string[] => {
  const display = snapshot.display.primary;

  return [
    metric("cpu", "◫", "CPU", snapshot.cpu.clockGhz ? `${snapshot.cpu.clockGhz.toFixed(2)} GHz` : formatPercent(snapshot.cpu.usagePercent)),
    metric("ram", "▥", "RAM", formatPercent(snapshot.memory.usedPercent)),
    metric("ssd", "▤", "SSD", storageTicker(snapshot)),
    metric("net", "↕", "NET", `↓${formatSupportSpeed(snapshot.network.downMbps)} ↑${formatSupportSpeed(snapshot.network.upMbps)}`),
    metric("disp", "▭", "DISP", display ? `${display.width}x${display.height} ${display.refreshRate ?? "N/A"} Hz` : "N/A")
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
  const display = snapshot.display.primary;
  return [
    card("cpu", "◫", "CPU", snapshot.cpu.history, `${formatPercent(snapshot.cpu.usagePercent)} · ${snapshot.cpu.clockGhz?.toFixed(2) ?? "N/A"} GHz`),
    card("ram", "▥", "RAM", snapshot.memory.history, `${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.capacityBytes)}`),
    card("ssd", "▤", "SSD", snapshot.storage.history, storageTicker(snapshot)),
    card("net", "↕", "NET", snapshot.network.history, "unsupported"),
    card("disp", "▭", "DISP", [65, 65, 65, 65, 65], display ? `${display.width}x${display.height}<br>${display.refreshRate ?? "N/A"} Hz` : "N/A")
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

const storageTicker = (snapshot: MetricsSnapshot): string => {
  const read = snapshot.storage.readMbps.supported ? `R ${formatSpeed(snapshot.storage.readMbps.value)}` : "R N/A";
  const write = snapshot.storage.writeMbps.supported ? `W ${formatSpeed(snapshot.storage.writeMbps.value)}` : "W N/A";
  return `${read} / ${write}`;
};

const formatSupportSpeed = (value: SupportValue<number>): string => {
  return value.supported ? formatSpeed(value.value).replace(" Mbps", "") : "N/A";
};

startPolling();
