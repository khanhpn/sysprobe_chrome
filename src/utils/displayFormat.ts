import type { DisplayMetrics, NetworkMetrics, StorageMetrics } from "../metrics/types.js";
import { formatBytes, formatSpeed } from "./format.js";

export const storageLabel = (storage: StorageMetrics): string => {
  if (storage.readMbps.supported || storage.writeMbps.supported) {
    const read = storage.readMbps.supported ? `R ${formatSpeed(storage.readMbps.value)}` : "R -";
    const write = storage.writeMbps.supported ? `W ${formatSpeed(storage.writeMbps.value)}` : "W -";
    return `${read} / ${write}`;
  }

  if (storage.availableBytes !== undefined) {
    return `${formatBytes(storage.availableBytes).replace(".0 ", " ")} free`;
  }

  if (storage.capacityBytes !== undefined) {
    return `${formatBytes(storage.capacityBytes).replace(".0 ", " ")} total`;
  }

  return "No data";
};

export const networkLabel = (network: NetworkMetrics): string => {
  if (!network.downMbps.supported && !network.upMbps.supported) return "No data";

  const down = network.downMbps.supported ? formatSpeed(network.downMbps.value).replace(" Mbps", "") : "-";
  const up = network.upMbps.supported ? formatSpeed(network.upMbps.value).replace(" Mbps", "") : "-";
  return `↓${down} ↑${up}`;
};

export const displayLabel = (display: DisplayMetrics): string => {
  if (!display.primary) return "No display";

  const resolution = `${display.primary.width}x${display.primary.height}`;
  return display.primary.refreshRate ? `${resolution} ${display.primary.refreshRate} Hz` : resolution;
};
