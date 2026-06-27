export type SupportValue<T> =
  | { supported: true; value: T }
  | { supported: false; reason: string };

export interface CpuMetrics {
  label: "CPU";
  modelName?: string;
  usagePercent?: number;
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
  capacityBytes?: number;
  availableBytes?: number;
  readMbps: SupportValue<number>;
  writeMbps: SupportValue<number>;
  temperatureC: SupportValue<number>;
  history: number[];
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
  primary?: {
    width: number;
    height: number;
    refreshRate?: number;
    name?: string;
  };
}

export interface MetricsSnapshot {
  updatedAt: Date;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  storage: StorageMetrics;
  network: NetworkMetrics;
  display: DisplayMetrics;
}
