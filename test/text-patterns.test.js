
import test from "node:test";
import assert from "node:assert/strict";
import { norm, tokens, jaroWinkler, tokOverlapScore } from "../src/text.js";
import { renderTemplate, extractVarsLoosely, compileTemplateRegex } from "../src/patterns.js";

test("norm lowercases, strips punctuation, and collapses spaces", () => {
  const input = "  Héllo,   WORLD!!!  ";
  const out = norm(input);
  assert.equal(out, "héllo world");
});

test("tokens splits normalized string", () => {
  const out = tokens("Hello, world!  foo");
  assert.deepEqual(out, ["hello", "world", "foo"]);
});

test("jaroWinkler is 1 for identical strings and lower for different", () => {
  const a = jaroWinkler("mock", "mock");
  const b = jaroWinkler("mock", "muck");
  const c = jaroWinkler("mock", "zebra");
  assert.equal(a, 1);
  assert.ok(b < 1);
  assert.ok(c < b);
});

test("tokOverlapScore is 1 for identical token sets and lower otherwise", () => {
  const a = tokOverlapScore("red blue", "blue red");
  const b = tokOverlapScore("red blue", "red green");
  const c = tokOverlapScore("red blue", "yellow");
  assert.equal(a, 1);
  assert.ok(b < 1);
  assert.ok(c < b);
});

test("renderTemplate replaces variables", () => {
  const tpl = "Hello {{name}}, welcome to {{place}}";
  const out = renderTemplate(tpl, { name: "Tim", place: "Mocktown" });
  assert.equal(out, "Hello Tim, welcome to Mocktown");
});

test("extractVarsLoosely extracts variables with flexible spacing", () => {
  const pattern = "what is the capital of {{state}}";
  const input1 = "What is   the capital of   New Jersey";
  const input2 = "what is the capital   of   NY";

  const vars1 = extractVarsLoosely(input1, pattern);
  const vars2 = extractVarsLoosely(input2, pattern);

  assert.equal(vars1.state.toLowerCase(), "new jersey");
  assert.equal(vars2.state.toLowerCase(), "ny");
});

test("compileTemplateRegex returns a matcher capturing vars", () => {
  const pattern = "explain {{topic}} simply";
  const match = compileTemplateRegex(pattern);

  const vars = match("  explain   monads   simply ");
  assert.ok(vars);
  assert.equal(vars.topic, "monads");
});
