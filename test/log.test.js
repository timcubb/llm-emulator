
import test from "node:test";
import assert from "node:assert/strict";
import { log, withReqId } from "../src/log.js";

test("log writes a JSON line with event and data", () => {
  // Monkey-patch console.log
  const messages = [];
  const orig = console.log;
  console.log = (msg) => messages.push(msg);

  try {
    log("unit.test", { foo: "bar" });
  } finally {
    console.log = orig;
  }

  assert.equal(messages.length, 1);
  const parsed = JSON.parse(messages[0]);
  assert.equal(parsed.evt, "unit.test");
  assert.equal(parsed.foo, "bar");
  assert.ok(parsed.t);
});

test("withReqId attaches a request id and header", () => {
  const req = {};
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    }
  };

  let nextCalled = false;
  const next = () => { nextCalled = true; };

  withReqId(req, res, next);

  assert.ok(req._reqId);
  assert.equal(headers["x-request-id"], req._reqId);
  assert.equal(nextCalled, true);
});
