
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePayload } from "../src/contracts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure schemas dir & a test schema
const rootDir = path.resolve(__dirname, "..");
const schemasDir = path.join(rootDir, "schemas");
if (!fs.existsSync(schemasDir)) fs.mkdirSync(schemasDir, { recursive: true });

const schemaPath = path.join(schemasDir, "test.shape.json");
fs.writeFileSync(
  schemaPath,
  JSON.stringify({
    type: "object",
    properties: {
      name: { type: "string" },
      value: { type: "number" }
    },
    required: ["name", "value"],
    additionalProperties: false
  }),
  "utf-8"
);

test("validatePayload passes valid payloads", () => {
  const payload = { name: "ok", value: 42 };
  const ok = validatePayload("request", "test.shape", payload, "strict");
  assert.equal(ok, true);
});

test("validatePayload warns or throws on invalid payloads based on mode", () => {
  const bad = { name: "missing value" };

  // warn mode: should not throw, returns false or true but not crash
  const warnResult = validatePayload("request", "test.shape", bad, "warn");
  assert.equal(typeof warnResult, "boolean");

  // strict mode: should throw
  let threw = false;
  try {
    validatePayload("request", "test.shape", bad, "strict");
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, true);
});

test("validatePayload is a no-op when schema file missing", () => {
  const payload = { anything: "goes" };
  const ok = validatePayload("request", "nonexistent.schema", payload, "strict");
  assert.equal(ok, true);
});
