import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { participationUrl } from "../app/lottery/participation.mjs";

test("production entry stays closed until the backend URL has been explicitly verified", async () => {
  const config = JSON.parse(await readFile(new URL("../data/lottery-public-config.json", import.meta.url), "utf8"));
  if (config.verified !== true) assert.equal(participationUrl(config), null);
  assert.equal(participationUrl({ participationUrl: "https://script.google.com/macros/s/example/exec", verified: false }), null);
  assert.equal(participationUrl({ verified: true }), null);
});

test("production entry accepts a verified stable Apps Script deployment URL only", () => {
  const good = "https://script.google.com/macros/s/AKfycbExample_123/exec";
  assert.equal(participationUrl({ participationUrl: good, verified: true }), good);
  for (const url of [
    "javascript:alert(1)", "http://script.google.com/macros/s/example/exec", "https://example.org/macros/s/example/exec",
    "https://script.google.com/macros/s/example/dev", "https://script.google.com/macros/s/example/exec?token=test",
    "https://script.google.com/macros/s/example/exec#part", "https://user:password@script.google.com/macros/s/example/exec",
  ]) assert.equal(participationUrl({ participationUrl: url, verified: true }), null);
});
