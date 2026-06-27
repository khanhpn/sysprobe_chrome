import type { MetricsProvider } from "./provider.js";
import type { CpuMetrics, DisplayMetrics, MemoryMetrics, MetricsSnapshot, StorageMetrics, SupportValue } from "./types.js";

type ChromeSystem = {
  system?: {
    cpu?: { getInfo(callback: (info: ChromeCpuInfo) => void): void };
    memory?: { getInfo(callback: (info: ChromeMemoryInfo) => void): void };
    storage?: { getInfo(callback: (info: ChromeStorageUnit[]) => void): void };
    display?: { getInfo(callback: (info: ChromeDisplayUnit[]) => void): void };
  };
  runtime?: { lastError?: { message?: string } };
};

type ChromeCpuInfo = {
  modelName?: string;
  processors?: Array<{ usage?: { user: number; kernel: number; idle: number; total: number } }>;
};

type ChromeMemoryInfo = {
  capacity: number;
  availableCapacity: number;
};

type ChromeStorageUnit = {
  capacity?: number;
  availableCapacity?: number;
  type?: string;
};

type ChromeDisplayUnit = {
  isPrimary?: boolean;
  name?: string;
  bounds?: { width: number; height: number };
  displayZoomFactor?: number;
  modes?: Array<{ isSelected?: boolean; refreshRate?: number }>;
};

const unsupported = <T>(reason: string): SupportValue<T> => ({ supported: false, reason });

export const createChromeSystemProvider = (globalChrome: ChromeSystem | undefined = globalThis.chrome as ChromeSystem | undefined): MetricsProvider => {
  return {
    async getSnapshot(): Promise<MetricsSnapshot> {
      const [cpuInfo, memoryInfo, storageUnits, displayUnits] = await Promise.all([
        getOptional(globalChrome?.system?.cpu?.getInfo),
        getOptional(globalChrome?.system?.memory?.getInfo),
        getOptional(globalChrome?.system?.storage?.getInfo),
        getOptional(globalChrome?.system?.display?.getInfo)
      ]);

      const storage = Array.isArray(storageUnits) ? storageUnits.find((unit) => unit.type === "fixed") ?? storageUnits[0] : undefined;

      return {
        updatedAt: new Date(),
        cpu: toCpuMetrics(cpuInfo),
        memory: toMemoryMetrics(memoryInfo),
        storage: toStorageMetrics(storage),
        network: {
          label: "NET",
          downMbps: unsupported("Chrome extensions do not expose reliable raw network throughput."),
          upMbps: unsupported("Chrome extensions do not expose reliable raw network throughput."),
          latencyMs: unsupported("Network latency requires a real measured endpoint."),
          history: []
        },
        display: toDisplayMetrics(Array.isArray(displayUnits) ? displayUnits : undefined)
      };
    }
  };
};

const toCpuMetrics = (info?: ChromeCpuInfo): CpuMetrics => {
  const metrics: CpuMetrics = {
    label: "CPU",
    temperatureC: unsupported("CPU temperature requires Native Messaging or a local companion agent."),
    history: []
  };
  const usagePercent = estimateCpuUsage(info);

  if (info?.modelName) metrics.modelName = info.modelName;
  if (usagePercent !== undefined) metrics.usagePercent = usagePercent;

  return metrics;
};

const toMemoryMetrics = (info?: ChromeMemoryInfo): MemoryMetrics => {
  const metrics: MemoryMetrics = {
    label: "RAM",
    history: []
  };

  if (!info) return metrics;

  metrics.capacityBytes = info.capacity;
  metrics.availableBytes = info.availableCapacity;
  metrics.usedBytes = info.capacity - info.availableCapacity;
  metrics.usedPercent = ((info.capacity - info.availableCapacity) / info.capacity) * 100;

  return metrics;
};

const toStorageMetrics = (unit?: ChromeStorageUnit): StorageMetrics => {
  const metrics: StorageMetrics = {
    label: "SSD",
    readMbps: unsupported("Storage read throughput is not exposed by chrome.system.storage."),
    writeMbps: unsupported("Storage write throughput is not exposed by chrome.system.storage."),
    temperatureC: unsupported("SSD temperature requires Native Messaging or a local companion agent."),
    history: []
  };

  if (unit?.capacity !== undefined) metrics.capacityBytes = unit.capacity;
  if (unit?.availableCapacity !== undefined) metrics.availableBytes = unit.availableCapacity;

  return metrics;
};

const getOptional = <T>(api: ((callback: (value: T) => void) => void) | undefined): Promise<T | undefined> => {
  if (!api) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    try {
      api((value) => resolve(value));
    } catch {
      resolve(undefined);
    }
  });
};

const estimateCpuUsage = (info?: ChromeCpuInfo): number | undefined => {
  const processors = info?.processors ?? [];
  const totals = processors
    .map((processor) => processor.usage)
    .filter((usage): usage is NonNullable<typeof usage> => Boolean(usage));

  if (totals.length === 0) return undefined;

  const active = totals.reduce((sum, usage) => sum + (usage.total - usage.idle), 0);
  const total = totals.reduce((sum, usage) => sum + usage.total, 0);
  return total > 0 ? (active / total) * 100 : undefined;
};

const toDisplayMetrics = (units?: ChromeDisplayUnit[]): DisplayMetrics => {
  const primary = units?.find((unit) => unit.isPrimary) ?? units?.[0];
  const selectedMode = primary?.modes?.find((mode) => mode.isSelected);
  const metrics: DisplayMetrics = { label: "DISP" };

  if (!primary?.bounds) return metrics;

  metrics.primary = {
    width: primary.bounds.width,
    height: primary.bounds.height
  };
  if (selectedMode?.refreshRate !== undefined) metrics.primary.refreshRate = selectedMode.refreshRate;
  if (primary.name) metrics.primary.name = primary.name;

  return metrics;
};
