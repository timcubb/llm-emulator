import { define, caseWhen, scenario } from "../src/dsl.js";

export default define({
  server: { port: 11434, stream: false },
  env: "local",
  seed: 42,
  matching: {
    order: [
      "pattern-regex",
      "semantic-minilm",
      "pattern",
      "fuzzy",
      "semantic-ngrams",
    ],
    minilm: { threshold: 0.72 },
    fuzzy: { threshold: 0.38 },
  },
  cases: [
    caseWhen(
      "what is the capital city of {{state}}",
      (state, ctx) => {
        if (!state) return "Mock Capital";
        const s = state.toLowerCase();
        if (s === "nj" || s === "new jersey") return "Trenton";
        if (s === "ny" || s === "new york") return "Albany";
        return "Mock Capital";
      },
      {
        id: "capital",
        latency: { distribution: "lognormal", meanMs: 120, p95Ms: 400 },
        faults: [
          {
            kind: "HTTP_429",
            ratio: 0.0,
            when: { env: "chaos" },
            retryAfterSec: 10,
          },
        ],
        validate: {
          request: "openai.chat.completions.request",
          response: "openai.chat.completions.response",
          mode: "warn",
        },
      }
    ),

    caseWhen(
      "explain the concept of {{topic}} in simple terms",
      (topic, ctx) => {
        return `This is a simple explanation of ${topic}.`;
      },
      { id: "explain" }
    ),

    caseWhen(
      "What is the square root of {{num}}",
      (num, ctx) => {
        const n = Number(num);
        const ans = isFinite(n) ? Math.sqrt(n) : NaN;
        return `square root of ${num} is ${ans}.`;
      },
      { id: "sqrt" }
    ),

    caseWhen(
      "summarize the events I have planned this weekend",
      () => "you have no plans this weekend.",
      {
        id: "weekend",
        faults: [{ kind: "HTTP_500", ratio: 0.0, when: { env: "chaos" } }],
      }
    ),

    caseWhen("generate code", () => "print 'test';", { id: "gen-code" }),
  ],

  scenarios: [
    scenario("checkout", {
      seed: 1337,
      steps: [
        {
          kind: "chat",
          user: "priming",
          reply: "You are a shopping assistant.",
        },
        {
          kind: "chat",
          user: "find me a red jacket under $100",
          reply: "I found 3 jackets under $100. Which size?",
        },
        {
          kind: "tools",
          call: {
            name: "search_catalog",
            arguments: { color: "red", max_price: 100 },
          },
          result: [{ sku: "RJ-001", price: 89.99 }],
        },
        {
          kind: "chat",
          user: "buy the medium one",
          error: { code: 502, body: { error: "gateway_unavailable" } },
        },
        {
          kind: "chat",
          user: "retry purchase",
          reply: "Order placed. Confirmation #MOCK123.",
        },
      ],
    }),
  ],

  contracts: { provider: "openai", version: "2025-06-01", mode: "warn" },
  vcr: {
    enabled: true,
    mode: "record",
    cassetteDir: "./.cassettes",
    redact: ["Authorization", "api_key"],
  },
  defaults: { fallback: "Sorry, I don't have a mock for that yet." },
});
