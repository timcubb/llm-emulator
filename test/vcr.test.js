
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, record } from "../src/vcr.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cassetteDir = path.join(__dirname, "cassettes-test");

test("ensureDir creates directory recursively", () => {
  const dir = path.join(cassetteDir, "nested/dir");
  ensureDir(dir);
  assert.ok(fs.existsSync(dir));
});

test("record appends entries to a cassette file", () => {
  const entry = {
    endpoint: "/v1/chat/completions",
    request: { a: 1 },
    response: { b: 2 }
  };
  record(cassetteDir, entry);

  const file = path.join(
    cassetteDir,
    "_v1_chat_completions.jsonl"
  );
  assert.ok(fs.existsSync(file));

  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  const last = JSON.parse(lines[lines.length - 1]);
  assert.equal(last.endpoint, entry.endpoint);
  assert.deepEqual(last.request, entry.request);
  assert.deepEqual(last.response, entry.response);
});
