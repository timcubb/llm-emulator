# llm-emulator

> Enterprise-grade **LLM API emulator** for local dev, integration tests, and CI.

`llm-emulator` runs a local HTTP server that looks like real LLM providers
(OpenAI-style, Gemini-style, etc.), but returns **deterministic, scripted responses**.

Use it to:

- Develop and run your app locally without real API keys
- Write fast, reliable integration tests for multi-agent / tools workflows
- Simulate happy paths, error paths, timeouts, and bad JSON
- Run **scenarios**: multi-step conversations + tool calls, in a fixed order

---

## ✨ Features

- **OpenAI-compatible endpoints**
  - `POST /v1/chat/completions`
  - `POST /chat/completions` (alias)
  - `POST /v1/responses`
  - `POST /responses` (alias)
  - `POST /v1/embeddings` (deterministic fake vectors)
- **Gemini-compatible endpoints**
  - `POST /v1/models/:model:generateContent`
  - `POST /v1alpha/models/:model:generateContent`
  - `POST /v1beta/models/:model:generateContent`
- **Configurable matching engine**
  - Exact pattern
  - Template regex (`{{var}}` placeholders)
  - MiniLM semantic similarity (optional, via `@xenova/transformers`)
  - Fuzzy string similarity
  - Cheap n-gram semantic-ish matching
- **Scenarios**
  - Scripted multi-step flows (`chat`, `tools`, `wait`)
  - Triggered via CLI flag (`--scenario`) or config
- **Fault injection**
  - Latency, timeouts
  - HTTP 4xx / 5xx
  - Malformed JSON
  - Stream glitches (drop/duplicate chunks)
- **Contract validation**
  - Uses JSON Schemas + Ajv (optional)
- **VCR-style recording**
  - Record incoming requests + responses to `.jsonl` files for later inspection
- **Express middleware**
  - Mount `llm-emulator` into an existing Express app

---

## 🚀 Install

```bash
npm install --save-dev llm-emulator
```

Or with pnpm:

```bash
pnpm add -D llm-emulator
```

---

## 🏃 Quick start

1. Create a config file, e.g. `examples/config.mjs`:

   ```js
   import { define, caseWhen } from "../src/dsl.js";

   export default define({
     server: { port: 11434, stream: false },
     env: "local",
     matching: {
       order: ["pattern-regex", "semantic-minilm", "pattern", "fuzzy", "semantic-ngrams"],
       minilm: { threshold: 0.72 },
       fuzzy: { threshold: 0.38 },
     },
     cases: [
       caseWhen("what is the capital city of {{state}}", (state) => {
         const value = (state || "").toLowerCase();
         if (["nj", "new jersey"].includes(value)) return "Trenton";
         if (["ny", "new york"].includes(value)) return "Albany";
         return "Mock Capital";
       }),
     ],
     defaults: {
       fallback: "Sorry, I don't have a mock for that yet.",
     },
   });
   ```

2. Start the emulator:

   ```bash
   npx llm-emulator ./examples/config.mjs
   ```

3. Point your client at it.

   **OpenAI SDK example:**

   ```ts
   import OpenAI from "openai";

   const client = new OpenAI({
     apiKey: "llm-emulator", // any non-empty string
     baseURL: "http://localhost:11434/v1",
   });

   const resp = await client.chat.completions.create({
     model: "gpt-4o",
     messages: [
       { role: "user", content: "what is the capital city of New Jersey" },
     ],
   });

   console.log(resp.choices[0].message.content);
   // → "Trenton"
   ```

   **Gemini SDK example:**

   ```ts
   import { GoogleGenerativeAI } from "@google/generative-ai";

   const genAI = new GoogleGenerativeAI("llm-emulator", {
     // key is ignored; baseUrl is what matters
     baseUrl: "http://localhost:11434",
   });

   const model = genAI.getGenerativeModel({
     model: "models/gemini-2.5-flash",
   });

   const resp = await model.generateContent({
     contents: [{ role: "user", parts: [{ text: "what is the capital city of New York" }] }],
   });

   console.log(resp.response.text());
   // → "Albany"
   ```

---

## 📦 DSL Overview

The config and DSL live in plain JS/TS and are imported from `src/dsl.js`:

```js
import { define, caseWhen, scenario } from "llm-emulator/src/dsl.js";
```

### `define(config)`

Top-level wrapper. Returns the config as-is, but gives you a nice place to add type hints in TS projects.

```ts
export default define({
  server: { port: 11434, stream: false },
  // ...
});
```

### `caseWhen(pattern, handler, options?)`

Defines a **mock route**: when user text matches `pattern`, run `handler`.

```ts
caseWhen("what is the capital city of {{state}}", (state, ctx) => {
  // state → "new jersey" / "nj" etc
  // ctx   → { text, model, provider, messages, score, matchedPattern, vars }
  return "Trenton";
}, {
  latencyMs: { min: 50, max: 120 },   // optional
  faults: [
    {
      kind: "HTTP_429",
      when: { env: "ci" },
      body: { error: { message: "rate limited in CI" } },
    },
  ],
});
```

**Arguments:**

- `pattern: string`  
  A natural language pattern with optional `{{variables}}`.

  Examples:

  - `"what is the capital city of {{state}}"`
  - `"explain {{topic}} simply"`
  - `"summarize the events I have planned this weekend."`

- `handler: (varOrCtx, ctx?) => string | Promise<string>`  
  - If the pattern has **exactly one `{{var}}`**, you get:
    - `handler(varValue, ctx)`
  - If it has 0 or >1 vars, you get:
    - `handler(ctx)`

  Where `ctx` has:

  ```ts
  interface HandlerContext {
    text: string;          // extracted user text
    model: string;         // requested model name
    provider: string;      // e.g. "openai.chat", "gemini.generateContent", "openai.responses"
    messages?: any[];      // OpenAI-style messages (if applicable)
    vars: Record<string, string>;  // extracted {{var}} -> value
    score?: number;        // similarity score from matcher
    matchedPattern?: string;
  }
  ```

- `options?: { latencyMs?, faults? }`  
  Extra per-case behavior, used by the fault/latency layer:

  ```ts
  interface CaseOptions {
    latencyMs?: number | { min: number; max: number };
    faults?: FaultDefinition[];
  }

  interface FaultDefinition {
    kind:
      | "TIMEOUT"
      | "HTTP_400" | "HTTP_401" | "HTTP_403" | "HTTP_404"
      | "HTTP_409" | "HTTP_422" | "HTTP_500" | "HTTP_502" | "HTTP_503"
      | "HTTP_429"
      | "MALFORMED_JSON"
      | "STREAM_DROP_AFTER"
      | "STREAM_DUPLICATE_CHUNK";

    when?: {
      env?: string;                // matches cfg.env
      testTag?: string;            // matches cfg.testTag
      provider?: string;           // "openai.chat", "gemini.generateContent", etc
      model?: string;              // model name
      stream?: boolean;            // only in streaming mode / non-streaming mode
      headers?: Record<string,string>; // match on request headers
      params?: Record<string,string>;  // match on query params
    };

    body?: any;         // optional HTTP response body override for HTTP_* faults
    afterChunks?: number; // used for stream faults like STREAM_DROP_AFTER, STREAM_DUPLICATE_CHUNK
  }
  ```

---

### `scenario(id, spec)`

Defines a **scripted multi-step flow** that overrides normal `caseWhen` matching
while it is active.

```ts
scenario("shopping-happy-path", {
  seed: 1337,       // optional, for deterministic randomness if you use it
  steps: [
    { kind: "chat", user: "priming", reply: "You are a shopping assistant." },
    {
      kind: "chat",
      user: "find me a red jacket under $100",
      reply: "I found 3 jackets under $100. Which size?",
    },
    {
      kind: "tools",
      call: { name: "search_catalog", arguments: { color: "red", max_price: 100 } },
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
});
```

#### Scenario spec

```ts
interface ScenarioSpec {
  seed?: number;
  steps: ScenarioStep[];
}

type ScenarioStep =
  | ChatStep
  | ToolStep
  | WaitStep;

interface ChatStep {
  kind: "chat";
  user?: string;                // optional, for docs/logging only
  reply?: string;               // if present, normal success reply
  error?: { code: number; body: any }; // if present, send this HTTP error instead
}

interface ToolStep {
  kind: "tools";
  call: { name: string; arguments?: any }; // what tool would have been called
  result: any;                             // what to return as the "tool result"
}

interface WaitStep {
  kind: "wait";
  ms: number;                  // sleep duration before advancing
}
```

At runtime, `llm-emulator`:

- Keeps global scenario state (scenario id + step index).
- For each request (OpenAI chat, OpenAI responses, Gemini generateContent):
  1. Checks if a scenario is active
  2. If yes, returns the next step as:
     - `chat` → a normal provider-shaped chat response (`openAIResponse`/`geminiResponseShape`)
     - `tools` → a “tool result” encoded as text (for now; can be extended)
     - `wait` → internal; consumes the step and waits before continuing
  3. If no step remains, falls back to normal `caseWhen` routing.

You enable a scenario via CLI:

```bash
npx llm-emulator ./examples/config.mjs --scenario shopping-happy-path
```

or via config:

```ts
export default define({
  // ...
  useScenario: "shopping-happy-path",
  scenarios: [
    scenario("shopping-happy-path", { /* ... */ }),
  ],
});
```

---

## 🧩 Full config reference

A config file is any JS/TS module exporting a `define(...)` call:

```ts
import { define, caseWhen, scenario } from "llm-emulator/src/dsl.js";

export default define({
  server: { /* ... */ },
  env: "local",
  seed: 42,
  matching: { /* ... */ },
  cases: [ /* caseWhen(...) */ ],
  scenarios: [ /* scenario(...) */ ],
  contracts: { /* ... */ },
  limits: { /* reserved */ },
  vcr: { /* record / replay */ },
  defaults: { /* fallback behavior */ },
  testTag: "dev",            // optional
  useScenario: "shopping-happy-path", // optional
});
```

### `server`

```ts
server: {
  port?: number;     // default: 11434
  stream?: boolean;  // default: false (future streaming behavior)
}
```

### `env`

```ts
env?: string; // default: "local"
```

Used by fault conditions (`when.env`) and for logging.

### `seed`

```ts
seed?: number; // default: 42
```

Used for deterministic embeddings and any other seeded behavior.

### `matching`

```ts
matching?: {
  order?: string[]; // default: ["pattern-regex","semantic-minilm","pattern","fuzzy","semantic-ngrams"]
  minilm?: { threshold?: number }; // default: { threshold: 0.72 }
  fuzzy?:  { threshold?: number }; // default: { threshold: 0.38 }
  ngrams?: { threshold?: number }; // default: { threshold: 0.3 } (if omitted)
}
```

- `order` controls which matchers run, and in what sequence.
- `minilm.threshold`: minimum cosine similarity for MiniLM matches.
- `fuzzy.threshold`: minimum score for fuzzy string similarity.
- `ngrams.threshold`: minimum score for the cheap n-gram semantic-ish matcher.

### `cases`

```ts
cases?: ReturnType<typeof caseWhen>[];
```

Each `caseWhen(pattern, handler, options)` describes:

- What user text looks like
- How to respond
- Optional latency and faults

See the **DSL** section above.

### `scenarios`

```ts
scenarios?: ReturnType<typeof scenario>[];
```

Scenario definitions, as described in the **Scenarios** section.
You activate one via `useScenario` or `--scenario` CLI flag.

### `contracts`

```ts
contracts?: {
  provider?: "openai" | "gemini" | string;  // for your own reference
  version?: string;                         // e.g. "2025-06-01"
  mode?: "warn" | "strict" | "off";         // default: "warn"
};
```

Behavior:

- If a matching JSON Schema exists in `./schemas/<name>.json`, `llm-emulator`
  validates requests/responses at runtime:
  - `name` is things like:
    - `"openai.chat.completions.request"`
    - `"openai.chat.completions.response"`
    - `"gemini.generateContent.request"`
    - `"gemini.generateContent.response"`
- When `mode: "warn"` (default):
  - logs schema violations but doesn’t throw
- When `mode: "strict"`:
  - throws on violations and fails the request

If a schema file is missing, validation is skipped for that shape.

### `limits`

Reserved for future rate-limiting. Currently initialized as:

```ts
limits?: {
  tokensPerMinute?: number;      // default: 120000
  requestsPerMinute?: number;    // default: 1000
};
```

You can set these for documentation, but they are not yet enforced.

### `vcr`

```ts
vcr?: {
  enabled?: boolean;       // default: false
  mode?: "record" | "replay"; // current main mode is "record"
  cassetteDir?: string;    // default: "./.cassettes"
  redact?: string[];       // header keys to redact (e.g. ["Authorization","api_key"])
};
```

When `enabled: true` and `mode: "record"`, requests + responses are appended to
`cassetteDir/<endpoint>.jsonl` as JSON lines:

```json
{"endpoint":"/v1/chat/completions","request":{...},"response":{...}, ...}
```

Useful for capturing traffic to replay or inspect later.

### `defaults`

```ts
defaults?: {
  fallback?: string; // default: "Sorry, I don't have a mock for that yet."
}
```

If no `caseWhen` matches and no scenario is active, the emulator returns a
provider-shaped response with `fallback` as the assistant text.

### `testTag`

```ts
testTag?: string;
```

Free-form string used in fault conditions (`when.testTag`) to distinguish
different test runs, test suites, etc.

### `useScenario`

```ts
useScenario?: string; // scenario id, must match one defined via scenario(...)
```

If set, that scenario is used for all incoming requests until its steps are
exhausted. Equivalent to running:

```bash
npx llm-emulator ./config.mjs --scenario <id>
```

---

## 🧪 Simple scenario example

A single-step “always say hi” scenario:

```ts
import { define, caseWhen, scenario } from "llm-emulator/src/dsl.js";

export default define({
  server: { port: 11434 },
  env: "local",
  cases: [
    caseWhen("what is your name", () => "I am mock-bot."),
  ],
  scenarios: [
    scenario("say-hi-once", {
      steps: [
        {
          kind: "chat",
          user: "anything",
          reply: "Hi from scenario!",
        },
      ],
    }),
  ],
});
```

Run:

```bash
npx llm-emulator ./config.mjs --scenario say-hi-once
```

- First request: `"hello?"` → `"Hi from scenario!"`  
- Second request: `"hello?"` → normal `caseWhen` fallback or default fallback.

---

## 🧪 Advanced scenario example: multi-agent experiment setup

Imagine you have an app that:

1. Asks the LLM to **create an experiment**
2. The LLM asks the user questions
3. The LLM calls a `create_experiment` tool
4. Returns a success message

You can emulate that with:

```ts
import { define, caseWhen, scenario } from "llm-emulator/src/dsl.js";

export default define({
  server: { port: 11434 },
  env: "local",
  cases: [
    caseWhen("create an experiment", () =>
      "In real mode this would create an experiment, but in mock mode there's no scenario."
    ),
  ],

  scenarios: [
    scenario("create-experiment-happy-path", {
      seed: 999,
      steps: [
        {
          kind: "chat",
          user: "create an experiment",
          reply: "Sure, let's set up an experiment. What should we call it?",
        },
        {
          kind: "chat",
          user: "my landing page test",
          reply: "Got it. What's the primary metric you care about?",
        },
        {
          kind: "chat",
          user: "signup conversion",
          reply: "Great. Which user segment are we targeting?",
        },
        {
          kind: "tools",
          call: {
            name: "create_experiment",
            arguments: {
              name: "my landing page test",
              metric: "signup_conversion",
              segment: "all_visitors",
            },
          },
          result: {
            id: "exp_mock_123",
            status: "CREATED",
          },
        },
        {
          kind: "chat",
          user: "thanks",
          reply: "All set! I created experiment exp_mock_123 in mock mode.",
        },
      ],
    }),
  ],

  defaults: {
    fallback: "Sorry, no mock for that yet.",
  },
});
```

Run:

```bash
npx llm-emulator ./config.mjs --scenario create-experiment-happy-path
```

Then run your real app (pointed at `http://localhost:11434`) and walk through
the flow; you’ll see exactly the scripted interaction every time.

---

## 🔌 Express middleware usage

If you already have an Express server and want to mount the emulator under a path:

```ts
import express from "express";
import { createLlmMockRouter } from "llm-emulator/src/middleware.js";
import config from "./config.mjs";

const app = express();
const router = await createLlmMockRouter(config);

app.use("/llm-emulator", router);

app.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
  console.log("LLM emulator at http://localhost:3000/llm-emulator");
});
```

Then point your OpenAI / Gemini clients to:

- `http://localhost:3000/llm-emulator/v1/chat/completions`
- `http://localhost:3000/llm-emulator/v1/models/:model:generateContent`
- etc.

---

## 📝 Notes

- This README assumes you’ve renamed the project / binary to **`llm-emulator`**.  
  If your actual package name / bin name is still `llm-mock` or `llm-emulator`, just
  replace the CLI examples accordingly.
- MiniLM semantic matching requires `@xenova/transformers` and will be lazily
  loaded on first use. If you don’t want it, remove `"semantic-minilm"` from
  `matching.order`.

---
