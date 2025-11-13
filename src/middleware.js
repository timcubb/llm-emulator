import express from "express";
import cors from "cors";
import { withReqId, log } from "./log.js";
import {
  extractUserTextFromOpenAI,
  openAIResponse,
  extractUserTextFromResponses,
  responsesShape,
  embeddingsShape,
  extractUserTextFromGemini,
  geminiResponseShape,
} from "./providers.js";
import { routeToCase, runHandler } from "./router.js";
import { applyFaultOrLatency } from "./faults.js";
import { validatePayload } from "./contracts.js";
import { ScenarioRunner } from "./scenario.js";

function findCaseOptions(config, text) {
  const c = (config.cases || []).find((cs) =>
    text.toLowerCase().includes(cs.pattern.split("{{")[0].trim().toLowerCase())
  );
  return c?.options || {};
}

function deterministicEmbedding(text, seed, dim = 1536) {
  let a =
    (seed >>> 0) ^
    Array.from(text).reduce((s, ch) => (s * 33 + ch.charCodeAt(0)) >>> 0, 5381);
  function rnd() {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 0xffffffff;
  }
  const v = Array.from({ length: dim }, () => rnd() * 2 - 1);
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export async function createLlmMockRouter(config) {
  const router = express.Router();
  const scenarios = new ScenarioRunner(config);

  router.use(cors());
  router.use(express.json({ limit: "2mb" }));
  router.use(withReqId);

  router.get("/health", (req, res) => res.json({ ok: true, env: config.env }));

  const openAIHandler = async (req, res) => {
    const body = req.body || {};
    validatePayload(
      "request",
      "openai.chat.completions.request",
      body,
      config.contracts?.mode || "warn"
    );

    // SCENARIO HOOK: see if there's a scripted step to play
    const step = await scenarios.nextStep();
    if (step) {
      const model = body.model || "llm-emulator";
      if (step.kind === "chat") {
        const payload = openAIResponse({
          model,
          text: step.reply || "OK",
        });
        validatePayload(
          "response",
          "openai.chat.completions.response",
          payload,
          config.contracts?.mode || "warn"
        );
        return res.json(payload);
      }

      if (step.kind === "tools") {
        const text = JSON.stringify(step.result);
        const payload = openAIResponse({ model, text });
        validatePayload(
          "response",
          "openai.chat.completions.response",
          payload,
          config.contracts?.mode || "warn"
        );
        return res.json(payload);
      }

      // if some unknown step kind sneaks in, just fall through to normal flow
    }

    // Normal caseWhen-based mocking
    const text = extractUserTextFromOpenAI(body) || "";
    const model = body.model || "llm-emulator";
    const provider = "openai.chat";

    log("req.in", { provider, reqId: req._reqId, model, text });

    const ctx = {
      env: config.env,
      testTag: config.testTag,
      provider,
      model,
      headers: req.headers,
      params: req.query,
      stream: !!body.stream,
    };

    async function send() {
      const match = await routeToCase({ text, config });
      if (match.chosen) {
        log("match", {
          provider,
          mode: match.mode,
          pattern: match.pattern,
          score: match.score,
          vars: match.vars,
        });

        const out = await runHandler(match.chosen, {
          text,
          vars: match.vars,
          model,
          provider,
          messages: body.messages,
          score: match.score,
          matchedPattern: match.pattern,
        });

        const payload = openAIResponse({ model, text: out });
        validatePayload(
          "response",
          "openai.chat.completions.response",
          payload,
          config.contracts?.mode || "warn"
        );
        return res.json(payload);
      }

      log("match.none", { provider });

      const payload = openAIResponse({
        model,
        text:
          config.defaults?.fallback || "Sorry, I don't have a mock for that yet.",
      });
      validatePayload(
        "response",
        "openai.chat.completions.response",
        payload,
        config.contracts?.mode || "warn"
      );
      return res.json(payload);
    }

    return applyFaultOrLatency(findCaseOptions(config, text), ctx, res, send);
  };

  const geminiHandler = async (req, res) => {
    const body = req.body || {};
    validatePayload(
      "request",
      "gemini.generateContent.request",
      body,
      config.contracts?.mode || "warn"
    );

    const model = req.params.model || body.model || "models/gemini-mock";
    const provider = "gemini.generateContent";

    // SCENARIO HOOK for Gemini
    const step = await scenarios.nextStep();
    if (step) {
      let text;
      if (step.kind === "chat") {
        text = step.reply || "OK";
      } else if (step.kind === "tools") {
        text = JSON.stringify(step.result);
      }

      if (text !== undefined) {
        const payload = geminiResponseShape({ model, text });
        validatePayload(
          "response",
          "gemini.generateContent.response",
          payload,
          config.contracts?.mode || "warn"
        );
        return res.json(payload);
      }
      // unknown step.kind → fall through
    }

    //  Normal Gemini caseWhen-based mocking
    const text = extractUserTextFromGemini(body) || "";

    log("req.in", { provider, reqId: req._reqId, model, text });

    const ctx = {
      env: config.env,
      testTag: config.testTag,
      provider,
      model,
      headers: req.headers,
      params: req.query,
      stream: !!body.stream,
    };

    async function send() {
      const match = await routeToCase({ text, config });
      if (match.chosen) {
        log("match", {
          provider,
          mode: match.mode,
          pattern: match.pattern,
          score: match.score,
          vars: match.vars,
        });

        const out = await runHandler(match.chosen, {
          text,
          vars: match.vars,
          model,
          provider,
          score: match.score,
          matchedPattern: match.pattern,
        });

        const payload = geminiResponseShape({ model, text: out });
        validatePayload(
          "response",
          "gemini.generateContent.response",
          payload,
          config.contracts?.mode || "warn"
        );
        return res.json(payload);
      }

      log("match.none", { provider });

      const payload = geminiResponseShape({
        model,
        text:
          config.defaults?.fallback || "Sorry, I don't have a mock for that yet.",
      });
      validatePayload(
        "response",
        "gemini.generateContent.response",
        payload,
        config.contracts?.mode || "warn"
      );
      return res.json(payload);
    }

    return applyFaultOrLatency(findCaseOptions(config, text), ctx, res, send);
  };

  router.post("/v1/chat/completions", openAIHandler);
  router.post("/chat/completions", openAIHandler);

  router.post("/v1/models/:model:generateContent", geminiHandler);
  router.post("/v1alpha/models/:model:generateContent", geminiHandler);
  router.post("/v1beta/models/:model:generateContent", geminiHandler);

  async function handleResponses(req, res) {
    const body = req.body || {};
    validatePayload(
      "request",
      "openai.responses.request",
      body,
      config.contracts?.mode || "warn"
    );

    const model = body.model || "llm-emulator";
    const provider = "openai.responses";

    //  SCENARIO HOOK: same idea as chat / gemini
    const step = await scenarios.nextStep();
    if (step) {
      let text;
      if (step.kind === "chat") {
        text = step.reply || "OK";
      } else if (step.kind === "tools") {
        text = JSON.stringify(step.result);
      }

      if (text !== undefined) {
        const payload = responsesShape({ model, text });
        validatePayload(
          "response",
          "openai.responses.response",
          payload,
          config.contracts?.mode || "warn"
        );
        return res.json(payload);
      }
      // unknown step kind → fall through to normal matching
    }

    //  Normal caseWhen-based behavior
    const text = extractUserTextFromResponses(body) || "";

    log("req.in", {
      provider,
      reqId: req._reqId,
      model,
      text,
    });

    const ctx = {
      env: config.env,
      testTag: config.testTag,
      provider,
      model,
      headers: req.headers,
      params: req.query,
      stream: !!body.stream,
    };

    async function send() {
      const match = await routeToCase({ text, config });

      if (match.chosen) {
        log("match", {
          provider,
          mode: match.mode,
          pattern: match.pattern,
          score: match.score,
          vars: match.vars,
        });

        const out = await runHandler(match.chosen, {
          text,
          vars: match.vars,
          model,
          provider,
          messages: body.messages,
          score: match.score,
          matchedPattern: match.pattern,
        });

        const payload = responsesShape({ model, text: out });
        validatePayload(
          "response",
          "openai.responses.response",
          payload,
          config.contracts?.mode || "warn"
        );
        return res.json(payload);
      }

      log("match.none", { provider });

      const payload = responsesShape({
        model,
        text:
          config.defaults?.fallback || "Sorry, I don't have a mock for that yet.",
      });
      validatePayload(
        "response",
        "openai.responses.response",
        payload,
        config.contracts?.mode || "warn"
      );
      return res.json(payload);
    }

    return applyFaultOrLatency(findCaseOptions(config, text), ctx, res, send);
  }

  router.post("/responses", handleResponses);
  router.post("/v1/responses", handleResponses);

  router.post("/v1/embeddings", async (req, res) => {
    const body = req.body || {};
    validatePayload(
      "request",
      "openai.embeddings.request",
      body,
      config.contracts?.mode || "warn"
    );
    const model = body.model || "llm-emulator-embed";
    const seed = config.seed ?? 42;
    const dim = 1536;
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    const vecs = inputs.map((t) =>
      deterministicEmbedding(String(t ?? ""), seed, dim)
    );
    const payload = embeddingsShape({ model, vecs });
    validatePayload(
      "response",
      "openai.embeddings.response",
      payload,
      config.contracts?.mode || "warn"
    );
    res.json(payload);
  });

  return router;
}
