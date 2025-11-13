import { norm, jaroWinkler, tokOverlapScore } from "./text.js";

/**
 * Exact match after normalization.
 */
export function matchExact(input, pattern) {
  return norm(input) === norm(pattern);
}

/**
 * Fuzzy similarity score combining Jaro–Winkler and token overlap.
 * Returns a score in [0, 1] where higher is more similar.
 */
export function scoreFuzzy(input, pattern) {
  const normalizedInput = norm(input);
  const normalizedPattern = norm(pattern);

  const similarity = jaroWinkler(normalizedInput, normalizedPattern);
  const overlap = tokOverlapScore(normalizedInput, normalizedPattern);

  // Weighted blend – tuned by hand to be reasonably forgiving
  return 0.6 * similarity + 0.4 * overlap;
}

/**
 * Build character n-grams for a string, with simple padding.
 */
function charNgrams(text, minN = 3, maxN = 5) {
  const padded = `__${text}__`;
  const grams = [];

  for (let n = minN; n <= maxN; n += 1) {
    if (padded.length < n) continue;
    for (let i = 0; i <= padded.length - n; i += 1) {
      grams.push(padded.slice(i, i + n));
    }
  }

  return grams;
}

/**
 * Convert an array of n-grams into a sparse frequency vector.
 */
function vectorFromGrams(grams) {
  const counts = new Map();
  for (const gram of grams) {
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/**
 * Cosine similarity between two sparse vectors (as Maps).
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, valueA] of vecA.entries()) {
    const valueB = vecB.get(key) ?? 0;
    dot += valueA * valueB;
    normA += valueA * valueA;
  }

  for (const valueB of vecB.values()) {
    normB += valueB * valueB;
  }

  const denom = Math.sqrt(normA || 1) * Math.sqrt(normB || 1);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Rough "semantic-ish" similarity based on character n-gram cosine similarity.
 * This is cheap compared to the MiniLM-based matcher and works offline.
 */
export function scoreNgramSemantic(input, pattern) {
  const inputVector = vectorFromGrams(charNgrams(norm(input)));
  const patternVector = vectorFromGrams(charNgrams(norm(pattern)));
  return cosineSimilarity(inputVector, patternVector);
}
