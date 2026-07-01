import type { MetricsProvider } from "./provider.js";
import type { CpuMetrics, DisplayMetrics, DisplayUnitMetrics, MemoryMetrics, MetricsSnapshot, StorageMetrics, StorageUnitMetrics, SupportValue } from "./types.js";

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
  processors?: Array<{ usage?: ChromeCpuUsage }>;
};

type ChromeCpuUsage = {
  user: number;
  kernel: number;
  idle: number;
  total: number;
};

type ChromeMemoryInfo = {
  capacity: number;
  availableCapacity: number;
};

type ChromeStorageUnit = {
  id?: string;
  name?: string;
  capacity?: number;
  availableCapacity?: number;
  type?: string;
};

type ChromeDisplayUnit = {
  id?: string;
  isPrimary?: boolean;
  name?: string;
  bounds?: { width: number; height: number };
  displayZoomFactor?: number;
  modes?: Array<{ isSelected?: boolean; refreshRate?: number }>;
};

const unavailable = <T>(reason: string): SupportValue<T> => ({ supported: false, reason });

export const createChromeSystemProvider = (globalChrome: ChromeSystem | undefined = globalThis.chrome as ChromeSystem | undefined): MetricsProvider => {
  let previousCpuUsages: ChromeCpuUsage[] | undefined;

  return {
    async getSnapshot(): Promise<MetricsSnapshot> {
      const [cpuInfo, memoryInfo, storageUnits, displayUnits] = await Promise.all([
        getOptional(globalChrome?.system?.cpu?.getInfo),
        getOptional(globalChrome?.system?.memory?.getInfo),
        getOptional(globalChrome?.system?.storage?.getInfo),
        getOptional(globalChrome?.system?.display?.getInfo)
      ]);

      const storageList = Array.isArray(storageUnits) ? storageUnits : [];
      const storage = storageList.find((unit) => unit.type === "fixed") ?? storageList[0];
      const currentCpuUsages = cpuUsages(cpuInfo);
      const cpu = toCpuMetrics(cpuInfo, previousCpuUsages);
      previousCpuUsages = currentCpuUsages;

      return {
        updatedAt: new Date(),
        cpu,
        memory: toMemoryMetrics(memoryInfo),
        storage: toStorageMetrics(storage, storageList),
        network: {
          label: "NET",
          downMbps: unavailable("Chrome extensions do not expose reliable raw network throughput."),
          upMbps: unavailable("Chrome extensions do not expose reliable raw network throughput."),
          latencyMs: unavailable("Network latency requires a real measured endpoint."),
          history: []
        },
        display: toDisplayMetrics(Array.isArray(displayUnits) ? displayUnits : undefined)
      };
    }
  };
};

const toCpuMetrics = (info?: ChromeCpuInfo, previousCpuUsages?: ChromeCpuUsage[]): CpuMetrics => {
  const metrics: CpuMetrics = {
    label: "CPU",
    temperatureC: unavailable("CPU temperature requires Native Messaging or a local companion agent."),
    history: []
  };
  const currentCpuUsages = cpuUsages(info);
  const perCoreUsagePercent = estimatePerCoreCpuUsage(currentCpuUsages, previousCpuUsages);
  const usagePercent = estimateCpuUsage(currentCpuUsages, previousCpuUsages);

  if (info?.modelName) metrics.modelName = info.modelName;
  if (currentCpuUsages.length > 0) metrics.logicalProcessors = currentCpuUsages.length;
  if (usagePercent !== undefined) metrics.usagePercent = usagePercent;
  if (perCoreUsagePercent.length > 0) metrics.perCoreUsagePercent = perCoreUsagePercent;

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

const toStorageMetrics = (unit?: ChromeStorageUnit, units: ChromeStorageUnit[] = []): StorageMetrics => {
  const metrics: StorageMetrics = {
    label: "SSD",
    units: units.map(toStorageUnitMetrics),
    readMbps: unavailable("Storage read throughput is not exposed by chrome.system.storage."),
    writeMbps: unavailable("Storage write throughput is not exposed by chrome.system.storage."),
    temperatureC: unavailable("SSD temperature requires Native Messaging or a local companion agent."),
    history: []
  };

  if (unit?.capacity !== undefined) metrics.capacityBytes = unit.capacity;
  if (unit?.availableCapacity !== undefined) metrics.availableBytes = unit.availableCapacity;

  return metrics;
};

const toStorageUnitMetrics = (unit: ChromeStorageUnit): StorageUnitMetrics => {
  const metrics: StorageUnitMetrics = { type: unit.type ?? "unknown" };
  if (unit.id) metrics.id = unit.id;
  if (unit.name) metrics.name = unit.name;
  if (unit.capacity !== undefined) metrics.capacityBytes = unit.capacity;
  if (unit.availableCapacity !== undefined) metrics.availableBytes = unit.availableCapacity;
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

const cpuUsages = (info?: ChromeCpuInfo): ChromeCpuUsage[] => {
  return (info?.processors ?? [])
    .map((processor) => processor.usage)
    .filter((usage): usage is ChromeCpuUsage => Boolean(usage));
};

const estimateCpuUsage = (current: ChromeCpuUsage[], previous?: ChromeCpuUsage[]): number | undefined => {
  if (current.length === 0) return undefined;

  const source = previous && previous.length === current.length ? deltaCpuUsages(current, previous) : current;
  const active = source.reduce((sum, usage) => sum + (usage.total - usage.idle), 0);
  const total = source.reduce((sum, usage) => sum + usage.total, 0);
  return total > 0 ? (active / total) * 100 : undefined;
};

const estimatePerCoreCpuUsage = (current: ChromeCpuUsage[], previous?: ChromeCpuUsage[]): number[] => {
  if (current.length === 0) return [];

  const source = previous && previous.length === current.length ? deltaCpuUsages(current, previous) : current;
  return source.map((usage) => {
    const total = usage.total;
    return total > 0 ? ((total - usage.idle) / total) * 100 : 0;
  });
};

const deltaCpuUsages = (current: ChromeCpuUsage[], previous: ChromeCpuUsage[]): ChromeCpuUsage[] => {
  return current.map((usage, index) => {
    const previousUsage = previous[index];
    if (!previousUsage) return usage;

    return {
      user: Math.max(0, usage.user - previousUsage.user),
      kernel: Math.max(0, usage.kernel - previousUsage.kernel),
      idle: Math.max(0, usage.idle - previousUsage.idle),
      total: Math.max(0, usage.total - previousUsage.total)
    };
  });
};

const toDisplayMetrics = (units?: ChromeDisplayUnit[]): DisplayMetrics => {
  const primary = units?.find((unit) => unit.isPrimary) ?? units?.[0];
  const selectedMode = primary?.modes?.find((mode) => mode.isSelected);
  const displays = (units ?? []).map(toDisplayUnitMetrics);
  const metrics: DisplayMetrics = { label: "DISP", count: displays.length, displays };

  if (!primary?.bounds) return metrics;

  metrics.primary = {
    width: primary.bounds.width,
    height: primary.bounds.height
  };
  if (selectedMode?.refreshRate !== undefined) metrics.primary.refreshRate = selectedMode.refreshRate;
  if (primary.name) metrics.primary.name = primary.name;

  return metrics;
};

const toDisplayUnitMetrics = (unit: ChromeDisplayUnit): DisplayUnitMetrics => {
  const selectedMode = unit.modes?.find((mode) => mode.isSelected);
  const metrics: DisplayUnitMetrics = {};
  if (unit.id) metrics.id = unit.id;
  if (unit.name) metrics.name = unit.name;
  if (unit.isPrimary !== undefined) metrics.isPrimary = unit.isPrimary;
  if (unit.bounds?.width !== undefined) metrics.width = unit.bounds.width;
  if (unit.bounds?.height !== undefined) metrics.height = unit.bounds.height;
  if (selectedMode?.refreshRate !== undefined) metrics.refreshRate = selectedMode.refreshRate;
  return metrics;
};
