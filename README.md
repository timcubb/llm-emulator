
# LLM Emulator

**LLM Emulator** is an enterprise-grade, deterministic, fully offline emulator for LLM providers such as OpenAI, Gemini, and Ollama.  
It enables full-stack automated testing—CI, integration tests, E2E flows, multi-agent orchestration flows, and local development—*without hitting real LLM APIs, without API keys, and without nondeterministic model drift.*

The star of the system is **Scenario Graphs**: branching, stateful, multi-step scripted interactions that emulate how your LLM-powered agents and workflows behave in production.

Other features include:

- Linear scenarios  
- Case-based prompt → response mocking  
- HTTP downstream API mocks (for your REST dependencies)  
- Fault injection  
- Delays  
- JSON-schema contract validation  
- VCR request recording  
- Express middleware integration  

---

# 📌 Table of Contents

1. [Overview](#overview)  
2. [Installation](#installation)  
3. [Quick Start](#quick-start)  
4. [Scenario Graphs](#scenario-graphs)  
5. [Linear Scenarios](#linear-scenarios)  
6. [Case-Based Prompt Mocks](#case-based-prompt-mocks)  
7. [HTTP Mocking](#http-mocking)  
8. [Provider Compatibility](#provider-compatibility)  
9. [Fault Injection](#fault-injection)  
10. [Delays](#delays)  
11. [Contract Validation](#contract-validation)  
12. [VCR Recording](#vcr-recording)  
13. [Express Middleware](#express-middleware)  
14. [CLI Reference](#cli-reference)  
15. [Full DSL & Config Documentation](#full-dsl--config-documentation)
16. [License](#license)  

---

# Overview

Applications today rely on LLM outputs for:

- multi-step conversations  
- agent tool calls  
- chain-of-thought workflows  
- structured output generation  
- code generation  
- orchestration logic  
- multi-agent routing  

This makes **local testing**, **CI**, and **E2E automation** incredibly fragile unless you have:

- deterministic outputs  
- reproducible flows  
- fast execution  
- offline capability  
- stateful multi-turn interactions  

LLM Emulator provides all of this.

---

# Installation

```
npm install llm-emulator --save-dev
```

Or use npx:

```
npx llm-emulator ./mocks/config.mjs
```

---

# Quick Start

### **config.mjs**

```js
import { define, scenario, caseWhen, httpGet } from "llm-emulator";

export default define({
  server: { port: 11434 },

  useScenario: "checkout-graph",

  scenarios: [
    scenario("checkout-graph", {
      start: "collect-name",
      steps: {
        "collect-name": {
          branches: [
            {
              when: "my name is {{name}}",
              if: ({ name }) => name.toLowerCase().includes("declined"),
              reply: "Your application is declined.",
              next: "end-declined",
            },
            {
              when: "my name is {{name}}",
              if: ({ name }) => name.toLowerCase().includes("approved"),
              reply: "Your application is approved!",
              next: "end-approved",
            },
            {
              when: "my name is {{name}}",
              reply: ({ vars }) =>
                `Thanks ${vars.name}, what's your address?`,
              next: "collect-address",
            },
          ],
        },

        "collect-address": {
          branches: [
            {
              when: "my address is {{address}}",
              reply: ({ vars }) =>
                `We will contact you at ${vars.address}.`,
              next: "end-pending",
            },
          ],
        },

        "end-declined": { final: true },
        "end-approved": { final: true },
        "end-pending": { final: true },
      },
    }),
  ],

  cases: [
    caseWhen("explain {{topic}} simply", ({ topic }) =>
      `Simple explanation of ${topic}.`
    ),
  ],

  httpMocks: [
    httpGet("/api/user/:id", ({ params }) => ({
      id: params.id,
      name: "Mock User",
    })),
  ],

  defaults: {
    fallback: "No mock available.",
  },
});
```

Run it:

```
npx llm-emulator ./config.mjs --scenario checkout-graph
```

---

# Scenario Graphs

Scenario Graphs are the primary way to emulate multi-step LLM-driven workflows.

A scenario consists of:

- `start`: the initial state ID
- `steps`: a mapping of state IDs to state definitions
- each state contains one or more **branches**
- each branch defines:
  - a pattern (`when`)
  - optional guard (`if`)
  - reply (`reply`)
  - next state (`next`)
  - optional delay (`delayMs`)
  - optional tool result (`result`)
  - optional type (`kind`: `"chat"` or `"tools"`)

### Example

```js
scenario("checkout-graph", {
  start: "collect-name",
  steps: {
    "collect-name": {
      branches: [
        {
          when: "my name is {{name}}",
          if: ({ name }) => name.toLowerCase().includes("declined"),
          reply: "Declined.",
          next: "end-declined",
        },
        {
          when: "my name is {{name}}",
          if: ({ name }) => name.toLowerCase().includes("approved"),
          reply: "Approved!",
          next: "end-approved",
        },
        {
          when: "my name is {{name}}",
          reply: ({ vars }) => `Hello ${vars.name}. Your address?`,
          next: "collect-address",
        },
      ],
    },

    "collect-address": {
      branches: [
        {
          when: "my address is {{address}}",
          reply: ({ vars }) =>
            `Thanks. We'll mail you at ${vars.address}.`,
          next: "end-pending",
        },
      ],
    },

    "end-declined": { final: true },
    "end-approved": { final: true },
    "end-pending": { final: true },
  },
});
```

### What Scenario Graphs Support

- Multi-turn conversation emulation  
- Conditional routing  
- Stateful flows  
- Dynamic replies  
- Tool-style responses  
- Terminal states  
- Deterministic behavior  

---

# Linear Scenarios

For simple ordered scripts:

```js
scenario("simple-linear", {
  steps: [
    { kind: "chat", reply: "Welcome" },
    { kind: "chat", reply: "Next" }
  ]
});
```

These run top-to-bottom.

---

# Case-Based Prompt Mocks

Direct LLM prompt → response mocking:

```js
caseWhen("summarize {{topic}}", ({ topic }) =>
  `Summary of ${topic}`
);
```

Pattern matching supports:

- Template variables `{{var}}`  
- Looser lexical matching  
- Optional fuzzy matching fallback  

---

# HTTP Mocking

Mock downstream REST calls:

```js
httpGet("/api/user/:id", ({ params }) => ({
  id: params.id,
  name: "Mock User",
}));

httpPost("/api/checkout", ({ body }) => ({
  status: "ok",
  orderId: "mock123",
}));
```

Works with:

- GET
- POST
- PUT
- DELETE
- Path params (`:id`)
- Query params
- JSON body parsing

---

# Provider Compatibility

LLM Emulator exposes mock endpoints identical to real providers.

## OpenAI-Compatible

```
POST /v1/chat/completions
POST /chat/completions
POST /v1/responses
POST /responses
POST /v1/embeddings
```

Embeddings return deterministic fake vectors.

## Gemini-Compatible

```
POST /v1/models/:model:generateContent
POST /v1alpha/models/:model:generateContent
POST /v1beta/models/:model:generateContent
```

## Ollama-Compatible

```
POST /api/generate
```

---

# Fault Injection

Faults can be attached to any:

- branch  
- case  
- HTTP mock  

Examples:

```js
fault: { type: "timeout" }
fault: { type: "http", status: 503 }
fault: { type: "malformed-json" }
fault: { type: "stream-glitch" }
```

---

# Delays

Simulate real-world latency.

### Global:

```
server: { delayMs: 200 }
```

### Per-scenario-state:

```
delayMs: 500
```

### Per-HTTP-route:

```
httpGet("/x", { delayMs: 300 })
```

---

# Contract Validation

Optional JSON-schema validation using **Ajv**.

Modes:

```
contracts: {
  mode: "strict" | "warn" | "off"
}
```

Validates:

- OpenAI request/response  
- Gemini request/response  
- Ollama request/response  

---

# VCR Recording

Capture all incoming requests:

```
npx llm-emulator ./config.mjs --record ./recordings
```

Produces `.jsonl` files containing:

- timestamp
- provider
- request JSON
- response JSON

Perfect for test reproducibility and debugging.

---

# Express Middleware

Mount the emulator in an existing server:

```js
import { createEmulator } from "llm-emulator";

const emulator = await createEmulator("./config.mjs");

app.use("/mock-llm", emulator.express());
```

---

# CLI Reference

```
npx llm-emulator ./config.mjs [options]

--scenario <id>
--record <dir>
--port <num>
--verbose
```

---

# Full DSL & Config Documentation

## Top-Level `define(config)`

| Field | Description |
|-------|-------------|
| `server.port` | Port to run mock provider |
| `server.delayMs` | Global delay |
| `useScenario` | Active scenario ID |
| `scenarios[]` | Scenario definitions |
| `cases[]` | Case mocks |
| `httpMocks[]` | HTTP mocks |
| `defaults.fallback` | Default response text |

---

## Scenario Graph DSL

```
scenario(id, {
  start: "state",
  steps: {
    "state": {
      branches: [ ... ]
    },
    "end": { final: true }
  }
})
```

### Branch Fields

| Field | Description |
|-------|-------------|
| `when` | Pattern with template vars |
| `if(vars, ctx)` | Optional guard |
| `reply` | String or function |
| `kind` | `"chat"` or `"tools"` |
| `result` | For tool-style replies |
| `next` | Next state ID |
| `delayMs` | Per-branch delay |
| `fault` | Fault injection config |

---

## Linear Scenario DSL

```
scenario(id, {
  steps: [
    { kind, reply, result, delayMs, fault }
  ]
})
```

---

## Case DSL

```
caseWhen(pattern, handler)
```

---

## HTTP Mocks

```
httpGet(path, handler)
httpPost(path, handler)
httpPut(path, handler)
httpDelete(path, handler)
```

Handler receives:

```
{ params, query, body, headers }
```

Supports per-route:

- delays  
- faults  
- dynamic replies  

# License

MIT