export function extractUserTextFromOpenAI(body) {
  const lastUser = [...(body.messages || [])]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUser) return "";
  if (typeof lastUser.content === "string") return lastUser.content;
  if (Array.isArray(lastUser.content))
    return lastUser.content.map((c) => c?.text || "").join(" ");
  return "";
}
export function openAIResponse({ model, text }) {
  return {
    id: "chatcmpl_mock_" + Math.random().toString(36).slice(2),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || "llm-emulator",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: text.split(/\s+/).length,
      total_tokens: text.split(/\s+/).length,
    },
  };
}
export function extractUserTextFromResponses(body) {
  const inp = body?.input;
  if (typeof inp === "string") return inp;
  if (Array.isArray(inp))
    return inp
      .map((x) => (typeof x === "string" ? x : x?.text || ""))
      .join(" ");
  return "";
}
export function responsesShape({ model, text }) {
  const id = "resp_mock_" + Math.random().toString(36).slice(2);
  const msgId = "msg_mock_" + Math.random().toString(36).slice(2);
  const created = Math.floor(Date.now() / 1000);
  return {
    id,
    object: "response",
    created,
    model,
    output: [
      {
        id: msgId,
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
    usage: {
      input_tokens: 0,
      output_tokens: text.split(/\s+/).length,
      total_tokens: text.split(/\s+/).length,
    },
  };
}
export function embeddingsShape({ model, vecs }) {
  return {
    object: "list",
    data: vecs.map((embedding, idx) => ({
      object: "embedding",
      index: idx,
      embedding,
    })),
  };
}
export function extractUserTextFromGemini(body) {
  const parts = body?.contents?.[0]?.parts || [];
  return parts.map((p) => p.text || "").join(" ");
}
export function geminiResponseShape({ model, text }) {
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        finishReason: "STOP",
        index: 0,
      },
    ],
    modelVersion: model || "models/gemini-mock",
  };
}
