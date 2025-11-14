
import test from "node:test";
import assert from "node:assert/strict";
import { applyEnvOverrides, mulberry32, hash32, sleep, newId } from "../src/util.js";

test("applyEnvOverrides sets env-related fields and server.port", () => {
  const cfg = {};
  const out = applyEnvOverrides(cfg, {
    env: "test",
    seed: 123,
    testTag: "unit",
    port: 7777,
    useScenario: "demo",
  });

  assert.equal(out.env, "test");
  assert.equal(out.seed, 123);
  assert.equal(out.testTag, "unit");
  assert.equal(out.useScenario, "demo");
  assert.ok(out.server);
  assert.equal(out.server.port, 7777);
});

test("mulberry32 produces deterministic sequence per seed", () => {
  const r1a = mulberry32(42);
  const r1b = mulberry32(42);

  const seq1 = [r1a(), r1a(), r1a()];
  const seq2 = [r1b(), r1b(), r1b()];

  assert.deepEqual(seq1, seq2);
  for (const v of seq1) {
    assert.ok(v >= 0 && v <= 1);
  }
});

test("hash32 is stable for same input and differs for different input", () => {
  const a1 = hash32("hello");
  const a2 = hash32("hello");
  const b = hash32("world");

  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.ok(Number.isInteger(a1));
});

test("sleep resolves after at least given time", async () => {
  const start = Date.now();
  await sleep(10);
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 8); // allow some timing fuzz
});

test("newId prefixes and produces non-empty suffix", () => {
  const id1 = newId("test");
  const id2 = newId("test");

  assert.ok(id1.startsWith("test_"));
  assert.ok(id2.startsWith("test_"));
  assert.notEqual(id1, id2);
  assert.ok(id1.length > "test_".length);
});
