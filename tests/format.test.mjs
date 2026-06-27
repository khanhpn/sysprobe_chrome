import test from "node:test";
import assert from "node:assert/strict";
import { formatBytes, formatPercent, formatSpeed, formatTimestamp } from "../dist/src/utils/format.js";

test("formatBytes renders binary units compactly", () => {
  assert.equal(formatBytes(16 * 1024 ** 3), "16.0 GB");
  assert.equal(formatBytes(undefined), "N/A");
});

test("formatPercent clamps invalid values and rounds valid values", () => {
  assert.equal(formatPercent(38.4), "38%");
  assert.equal(formatPercent(undefined), "N/A");
});

test("formatSpeed renders unsupported data truthfully", () => {
  assert.equal(formatSpeed(null), "unsupported");
  assert.equal(formatSpeed(120), "120 Mbps");
});

test("formatTimestamp uses HH:mm:ss", () => {
  assert.match(formatTimestamp(new Date("2026-06-27T12:03:21")), /^\d{2}:03:21$/);
});
