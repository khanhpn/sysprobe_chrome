import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("popup build output does not include stale unavailable labels", async () => {
  const files = await Promise.all([
    readFile(new URL("../dist/src/popup.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/src/utils/displayFormat.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/src/utils/format.js", import.meta.url), "utf8")
  ]);
  const bundleText = files.join("\n");

  assert.equal(bundleText.includes("unsupported"), false);
  assert.equal(bundleText.includes("N/A Hz"), false);
  assert.equal(bundleText.includes("R N/A"), false);
  assert.equal(bundleText.includes("W N/A"), false);
});
