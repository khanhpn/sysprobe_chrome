export const formatBytes = (bytes?: number): string => {
  if (!Number.isFinite(bytes)) return "No data";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes ?? 0);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const formatPercent = (percent?: number): string => {
  if (!Number.isFinite(percent)) return "No data";
  return `${Math.round(Math.max(0, Math.min(100, percent ?? 0)))}%`;
};

export const formatSpeed = (mbps?: number | null): string => {
  if (!Number.isFinite(mbps)) return "No data";
  const value = Math.max(0, mbps ?? 0);
  return value >= 100 ? `${Math.round(value)} Mbps` : `${value.toFixed(1)} Mbps`;
};

export const formatTimestamp = (date: Date): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
};
