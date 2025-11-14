import { define, caseWhen, scenario, httpWhen } from "../src/dsl.js";

export default define({
  server: {
    port: 11434,
    stream: false
  },
  env: "local",
  seed: 42,
  matching: {
    order: ["pattern-regex", "pattern", "fuzzy"],
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
  ],
  scenarios: [
    scenario("checkout-graph", {
      start: "collect-name",
      steps: {
        "collect-name": {
          branches: [
            {
              when: "my name is {{name}}",
              if: ({ names }) =>
                (names || "").toLowerCase().includes("declined"),
              kind: "chat",
              reply: "I'm sorry, your application has been declined (mock).",
              next: "end-declined",
            },
            {
              when: "my name is {{name}}",
              if: ({ names }) =>
                (names || "").toLowerCase().includes("approved"),
              kind: "chat",
              reply: "Great news, your application is approved (mock)!",
              next: "end-approved",
            },
            {
              when: "my name is {{name}}",
              kind: "chat",
              reply: ({ vars: { name } }) =>
                `Thanks ${name}, let's continue your application, what is your address?`,
              next: "collect-address",
            },
          ],
        },

        "collect-address": {
          branches: [
            {
              when: "my address is {{address}}",
              kind: "chat",
              reply: ({ vars: { address }}) => `Got it. Your application review is in progress, we will send a written response to ${address}`,
              next: "end-pending",
            },
          ],
        },
        "end-declined": { final: true },
        "end-approved": { final: true },
        "end-pending": { final: true },
      },
    }),
    scenario("checkout-linear", {
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

  httpMocks: [
    httpWhen(
      { method: "GET", path: "/test/endpoint/:testId" },
      (req, ctx) => {
        // req: normalized express-y object
        // ctx: { env, testTag, provider: "http", reqId, ... }
        const { testId } = req.params;
        return {
          id: `plan_${testId}`,
          price_cents: 5000,
          currency: "USD",
          name: "Mock Starter",
        };
      },
      {
        latencyMs: { min: 20, max: 120 },
        faults: [
          {
            kind: "HTTP_500",
            when: { env: "ci", headers: { "x-test-plan": "fail" } },
          },
        ],
      }
    ),

    httpWhen({ method: "POST", path: "/users" }, (req) => {
      const { email } = req.body;
      return {
        id: "user_mock_123",
        email,
        created_at: new Date().toISOString(),
      };
    }),

    httpWhen(
      { method: "POST", path: "/api/experiments" },
      async (req, ctx) => {
        const { name, metric, callbackUrl } = req.body || {};

        const id = "exp_mock_" + Date.now();

        // example to handle webhook
        if (callbackUrl) {
          fetch(callbackUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              experimentId: id,
              status: "created",
              source: "llm-emulator",
            }),
          }).catch((err) => {
            console.error("[httpWhen webhook] failed", err);
          });
        }

        return {
          id,
          name,
          metric,
          status: "CREATED",
        };
      },
      {
        latencyMs: { min: 50, max: 150 },
      }
    ),
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
