import { pipeline } from "@xenova/transformers";
import { norm } from "./text.js";
import { log } from "./log.js";

/**
 * MiniLM-based semantic matcher.
 * Lazily loads all-MiniLM-L6-v2 and caches embeddings in-memory.
 */

let embedder = null;
const embeddingCache = new Map();

function placeholderizeVariables(pattern) {
  // Replace {{var}} placeholders with a generic token so patterns with
  // different variable names still cluster semantically.
  return norm(pattern).replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "[VAR]");
}

async function getEmbedder() {
  if (!embedder) {
    log("minilm.load.start");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    log("minilm.load.done");
  }
  return embedder;
}

async function embed(text) {
  const key = `e:${text}`;

  if (embeddingCache.has(key)) {
    return embeddingCache.get(key);
  }

  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  const vector = Array.from(output.data);

  embeddingCache.set(key, vector);
  return vector;
}

function cosineSimilarity(vectorA, vectorB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const length = Math.min(vectorA.length, vectorB.length);

  for (let i = 0; i < length; i += 1) {
    const a = vectorA[i];
    const b = vectorB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denom = Math.sqrt(normA || 1) * Math.sqrt(normB || 1);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Given a query string and an array of cases (each with a .pattern),
 * return the best and second-best matches based on MiniLM cosine similarity.
 */
export async function bestMiniLM(query, cases) {
  const queryVector = await embed(norm(query));

  let best = null;
  let second = null;

  for (const currentCase of cases) {
    const patternText = placeholderizeVariables(currentCase.pattern);
    const patternVector = await embed(patternText);
    const score = cosineSimilarity(queryVector, patternVector);

    if (!best || score > best.score) {
      second = best;
      best = { case: currentCase, score };
    } else if (!second || score > second.score) {
      second = { case: currentCase, score };
    }
  }

  return { best, second };
}
