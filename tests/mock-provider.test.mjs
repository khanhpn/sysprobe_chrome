import test from "node:test";
import assert from "node:assert/strict";
import { mockProvider } from "../dist/src/metrics/mockProvider.js";

test("mockProvider returns complete development metrics", async () => {
  const snapshot = await mockProvider.getSnapshot();

  assert.equal(snapshot.cpu.label, "CPU");
  assert.equal(typeof snapshot.memory.usedPercent, "number");
  assert.equal(snapshot.network.downMbps.supported, false);
  assert.ok(snapshot.display.primary?.width);
  assert.ok(snapshot.updatedAt instanceof Date);
});
