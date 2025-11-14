
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadJsConfig } from "../src/loadConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tmpDir = path.join(__dirname, "tmp-config");
fs.mkdirSync(tmpDir, { recursive: true });

const cfgPath = path.join(tmpDir, "config.mjs");
fs.writeFileSync(
  cfgPath,
  `
    export default {
      server: { port: 9999 },
      matching: { order: ["pattern"] },
      cases: [],
      scenarios: []
    };
  `,
  "utf-8"
);

test("loadJsConfig applies defaults and preserves explicit fields", async () => {
  const cfg = await loadJsConfig(cfgPath);

  assert.equal(cfg.server.port, 9999);
  assert.equal(cfg.server.stream, false);
  assert.deepEqual(cfg.matching.order, ["pattern"]);
  assert.ok(cfg.matching.minilm);
  assert.ok(cfg.matching.fuzzy);
  assert.ok(Array.isArray(cfg.cases));
  assert.ok(Array.isArray(cfg.scenarios));
  assert.ok(cfg.contracts);
  assert.ok(cfg.limits);
  assert.ok(cfg.vcr);
  assert.ok(cfg.defaults);
  assert.equal(cfg.env, "local");
  assert.equal(typeof cfg.seed, "number");
});
