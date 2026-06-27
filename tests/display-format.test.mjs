import test from "node:test";
import assert from "node:assert/strict";
import { displayLabel, networkLabel, storageLabel } from "../dist/src/utils/displayFormat.js";

test("storageLabel falls back to free capacity when throughput is unavailable", () => {
  assert.equal(
    storageLabel({
      label: "SSD",
      capacityBytes: 512 * 1024 ** 3,
      availableBytes: 228 * 1024 ** 3,
      readMbps: { supported: false, reason: "not exposed" },
      writeMbps: { supported: false, reason: "not exposed" },
      temperatureC: { supported: false, reason: "not exposed" },
      history: []
    }),
    "228 GB free"
  );
});

test("networkLabel stays compact when throughput is unavailable", () => {
  assert.equal(
    networkLabel({
      label: "NET",
      downMbps: { supported: false, reason: "not exposed" },
      upMbps: { supported: false, reason: "not exposed" },
      latencyMs: { supported: false, reason: "not measured" },
      history: []
    }),
    "No data"
  );
});

test("displayLabel omits missing refresh rate", () => {
  assert.equal(
    displayLabel({
      label: "DISP",
      primary: { width: 1710, height: 1107 }
    }),
    "1710x1107"
  );
});
