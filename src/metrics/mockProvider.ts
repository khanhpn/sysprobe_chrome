import type { MetricsProvider } from "./provider.js";
import type { MetricsSnapshot, SupportValue } from "./types.js";

const unavailable = <T>(reason: string): SupportValue<T> => ({ supported: false, reason });

export const mockProvider: MetricsProvider = {
  async getSnapshot(): Promise<MetricsSnapshot> {
    const drift = Math.sin(Date.now() / 1800);
    const cpu = 24 + drift * 7;
    const ram = 38 + Math.cos(Date.now() / 2400) * 4;

    return {
      updatedAt: new Date(),
      cpu: {
        label: "CPU",
        modelName: "Development CPU",
        usagePercent: cpu,
        clockGhz: 3.9,
        temperatureC: unavailable("CPU temperature requires Native Messaging or a local companion agent."),
        history: makeWave(cpu, 18, 9)
      },
      memory: {
        label: "RAM",
        capacityBytes: 16 * 1024 ** 3,
        usedBytes: 6.1 * 1024 ** 3,
        availableBytes: 9.9 * 1024 ** 3,
        usedPercent: ram,
        history: makeWave(ram, 18, 6)
      },
      storage: {
        label: "SSD",
        capacityBytes: 512 * 1024 ** 3,
        availableBytes: 284 * 1024 ** 3,
        readMbps: { supported: true, value: 42 },
        writeMbps: { supported: true, value: 18 },
        temperatureC: unavailable("SSD temperature requires Native Messaging or a local companion agent."),
        history: makeBars(22)
      },
      network: {
        label: "NET",
        downMbps: unavailable("Chrome extensions do not expose reliable raw network throughput."),
        upMbps: unavailable("Chrome extensions do not expose reliable raw network throughput."),
        latencyMs: unavailable("Network latency requires a real measured endpoint."),
        history: makeBars(22)
      },
      display: {
        label: "DISP",
        primary: {
          width: 1920,
          height: 1080,
          refreshRate: 60,
          name: "Primary Display"
        }
      }
    };
  }
};

const makeWave = (center: number, count: number, spread: number): number[] => {
  return Array.from({ length: count }, (_, index) => {
    const signal = Math.sin((Date.now() / 900 + index) * 0.9) * spread;
    return Math.max(4, Math.min(96, center + signal));
  });
};

const makeBars = (count: number): number[] => {
  return Array.from({ length: count }, (_, index) => {
    const value = Math.abs(Math.sin(Date.now() / 700 + index * 1.7)) * 88;
    return Math.max(8, value);
  });
};
