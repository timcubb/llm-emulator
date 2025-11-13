# LLM Emulator

Enterprise-grade mock server for LLM APIs designed for **local development**, **integration tests**, and **CI/QA**.

- OpenAI-compatible chat/responses/embeddings
- Optional **Express middleware** mode
- Scenario-based flows
- Fault injection and latency profiles
- JSON Schema contracts (AJV)
- Deterministic embeddings (no network)
- VCR-style recording (JSONL cassettes)
- Early Gemini `generateContent` support

---

## 🚀 Quick Start (Standalone)

```bash
npm i
npm install
npm run dev
```

This runs `./examples/config.mjs` on **http://localhost:11434**.

Use with OpenAI SDK:

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "mock-llm",
  baseURL: "http://localhost:11434",
});

const res = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "what is the capital city of New York" }],
});

console.log(res.choices[0].message.content); // Albany
```

---

## ⚙️ CLI

```bash
npx llm-emulator ./examples/config.mjs --env local --port 11434 --seed 42
```

Flags:

- `--env local|ci|chaos` – profile/env
- `--seed` – deterministic randomness
- `--port` – override port
- `--testTag` – tag logs/scenarios

---

## 🧩 Express Middleware Mode

You can mount the mock as an Express router inside an existing app.

```js
// app.js
import express from "express";
import { createLlmMockRouter } from "llm-emulator-enterprise";
import config from "./mockllm.config.mjs";

const app = express();

// your own routes
app.get("/api/health", (req, res) => res.json({ ok: true }));

// mount mock under a prefix
app.use("/mock-llm", await createLlmMockRouter(config));

// or mount at root
// app.use(await createLlmMockRouter(config));

app.listen(3000, () => {
  console.log("App on http://localhost:3000");
});
```

Endpoints under `/mock-llm`:

- `GET  /mock-llm/health`
- `POST /mock-llm/v1/chat/completions`
- `POST /mock-llm/v1/responses` and `/mock-llm/responses`
- `POST /mock-llm/v1/embeddings`
- `POST /mock-llm/v1/models/:model:generateContent` (Gemini-style)

---

## 🔍 Matching

Matchers run in order (configurable):

1. `pattern-regex` – strict-ish template regex with `{{vars}}`
2. `semantic-minilm` – all-MiniLM-L6-v2 cosine similarity
3. `pattern` – exact & loose template matching with static token guard
4. `fuzzy` – Jaro-Winkler + token overlap
5. `semantic-ngrams` – char-level n-gram cosine

Define cases with the JS DSL:

```js
caseWhen("what is the capital city of {{state}}", (state, ctx) => {
  if (!state) return "Mock Capital";
  const s = state.toLowerCase();
  if (s === "new jersey" || s === "nj") return "Trenton";
  if (s === "new york" || s === "ny")   return "Albany";
  return "Mock Capital";
});
```

---

## ⚡ Faults & Latency

Per-case settings:

```js
caseWhen("summarize the events I have planned this weekend", () => {
  return "you have no plans this weekend.";
}, {
  id: "weekend",
  latency: { meanMs: 80, p95Ms: 250 },
  faults: [
    { kind: "HTTP_500", ratio: 0.05, when: { env: "chaos" } }
  ]
});
```

Supported fault kinds (non-exhaustive):

- `HTTP_400`, `HTTP_401`, `HTTP_403`, `HTTP_404`, `HTTP_409`, `HTTP_422`
- `HTTP_429` (with `retryAfterSec`)
- `HTTP_500`, `HTTP_502`, `HTTP_503`
- `TIMEOUT`
- `MALFORMED_JSON`
- Streaming-related placeholders: `STREAM_DROP_AFTER`, `STREAM_DUPLICATE_CHUNK` (for future SSE support).

---

## 🧠 Scenarios

Stateful, multi-step flows for integration tests and E2E:

```js
scenario("checkout-flow", {
  steps: [
    { kind: "chat", reply: "You are a shopping assistant." },
    { kind: "chat", reply: "I found 3 jackets under $100. Which size?" },
    { kind: "tools", result: [{ sku: "RJ-001", price: 89.99 }] },
    { kind: "chat", error: { code: 502, body: { error: "gateway_unavailable" } } },
    { kind: "chat", reply: "Order placed. Confirmation #MOCK123." }
  ]
});
```

Activate by sending header:

```text
x-sandbox-scenario: checkout-flow
```

Scenarios apply to both OpenAI-style and Gemini-style endpoints.

---

## 📄 Contracts

Validation uses AJV and minimal JSON Schemas under `./schemas`:

- `openai.chat.completions.request/response`
- `openai.responses.request/response`
- `openai.embeddings.request/response`
- `gemini.generateContent.request/response` (stubbed; extend as needed)

Mode (`config.contracts.mode`):

- `"warn"` – log schema violations, do not fail
- `"strict"` – throw on violation (great for CI)

Per-case overrides via `options.validate` are supported in the DSL.

---

## 🎞️ VCR

Recording only (for now) to `.jsonl` cassettes by endpoint.

```js
vcr: {
  enabled: true,
  mode: "record",
  cassetteDir: "./.cassettes",
  redact: ["Authorization", "api_key"]
}
```

You can inspect cassettes to promote flows into formal `scenario()` definitions later.

---

## 🧮 Deterministic Embeddings

`POST /v1/embeddings` produces deterministic vectors based on:

- text input(s)
- configured `seed`
- fixed dimension (1536)

Ideal for CI and integration tests: exact-match comparisons, no remote calls.

---

## 🌐 Gemini Support (High Level)

This build adds a basic handler for:

```http
POST /v1/models/:model:generateContent
POST /v1beta/models/:model:generateContent
```

- Extracts `text` from `contents[0].parts[].text`
- Routes through the same matching engine (`cases`)
- Wraps the matched output into a Gemini-style `candidates[0].content.parts[0].text` response
- Validates against `schemas/gemini.generateContent.*` (currently permissive stubs)

You can point a Gemini SDK / HTTP client at `http://localhost:11434` (or your middleware prefix) as long as it uses the `:generateContent` endpoint.

---

## 🧰 Profiles

Use `--env` or config:

- `local` – dev-friendly
- `ci` – deterministic, stricter contracts
- `chaos` – fault-injection and higher latency

---

## License

MIT
