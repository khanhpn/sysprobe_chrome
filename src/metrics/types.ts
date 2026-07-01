export type SupportValue<T> =
  | { supported: true; value: T }
  | { supported: false; reason: string };

export interface CpuMetrics {
  label: "CPU";
  modelName?: string;
  logicalProcessors?: number;
  usagePercent?: number;
  perCoreUsagePercent?: number[];
  clockGhz?: number;
  temperatureC: SupportValue<number>;
  history: number[];
}

export interface MemoryMetrics {
  label: "RAM";
  capacityBytes?: number;
  availableBytes?: number;
  usedBytes?: number;
  usedPercent?: number;
  history: number[];
}

export interface StorageMetrics {
  label: "SSD";
  units: StorageUnitMetrics[];
  capacityBytes?: number;
  availableBytes?: number;
  readMbps: SupportValue<number>;
  writeMbps: SupportValue<number>;
  temperatureC: SupportValue<number>;
  history: number[];
}

export interface StorageUnitMetrics {
  id?: string;
  name?: string;
  type?: string;
  capacityBytes?: number;
  availableBytes?: number;
}

export interface NetworkMetrics {
  label: "NET";
  downMbps: SupportValue<number>;
  upMbps: SupportValue<number>;
  latencyMs: SupportValue<number>;
  history: number[];
}

export interface DisplayMetrics {
  label: "DISP";
  count?: number;
  primary?: {
    width: number;
    height: number;
    refreshRate?: number;
    name?: string;
  };
  displays: DisplayUnitMetrics[];
}

export interface DisplayUnitMetrics {
  id?: string;
  name?: string;
  isPrimary?: boolean;
  width?: number;
  height?: number;
  refreshRate?: number;
}

export interface MetricsSnapshot {
  updatedAt: Date;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  storage: StorageMetrics;
  network: NetworkMetrics;
  display: DisplayMetrics;
}
