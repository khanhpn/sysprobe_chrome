import type { MetricsSnapshot } from "./types.js";

export interface MetricsProvider {
  getSnapshot(): Promise<MetricsSnapshot>;
}
