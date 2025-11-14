
import test from "node:test";
import assert from "node:assert/strict";
import { define, caseWhen, scenario } from "../src/dsl.js";

test("define returns config object as-is", () => {
  const cfg = { foo: "bar", nested: { a: 1 } };
  const out = define(cfg);
  assert.equal(out, cfg);
  assert.deepEqual(out, cfg);
});

test("caseWhen wraps pattern, handler, and options", async () => {
  const handler = (name) => `Hello ${name}`;
  const c = caseWhen("hello {{name}}", handler, { latencyMs: 10 });

  assert.equal(c.pattern, "hello {{name}}");
  assert.equal(c.handler, handler);
  assert.deepEqual(c.options, { latencyMs: 10 });
});

test("caseWhen defaults options to empty object", () => {
  const c = caseWhen("ping", () => "pong");
  assert.equal(c.pattern, "ping");
  assert.equal(typeof c.handler, "function");
  assert.deepEqual(c.options, {});
});

test("scenario merges id into spec", () => {
  const sc = scenario("my-scenario", { steps: [{ kind: "chat" }] });
  assert.equal(sc.id, "my-scenario");
  assert.deepEqual(sc.steps, [{ kind: "chat" }]);
});
