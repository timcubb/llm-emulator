/**
 * Text utilities used by the matching layer.
 * Normalization, tokenization, and similarity metrics.
 */

/**
 * Normalize a string for comparison:
 * - lowercases
 * - removes non letter/number/space characters
 * - collapses whitespace
 */
export function norm(input) {
  const value = input ?? "";
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize a string into normalized, non-empty tokens.
 */
export function tokens(input) {
  return norm(input).split(" ").filter(Boolean);
}

/**
 * Jaro–Winkler distance implementation.
 * Returns a score in [0, 1] where 1 is an exact match.
 */
export function jaroWinkler(a, b) {
  const s1 = a;
  const s2 = b;
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;

  const matched1 = Array(s1.length).fill(false);
  const matched2 = Array(s2.length).fill(false);

  let matches = 0;

  // Find matches
  for (let i = 0; i < s1.length; i += 1) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j += 1) {
      if (!matched2[j] && s1[i] === s2[j]) {
        matched1[i] = true;
        matched2[j] = true;
        matches += 1;
        break;
      }
    }
  }

  if (!matches) {
    return 0;
  }

  // Count transpositions
  let transpositions = 0;
  let k = 0;

  for (let i = 0; i < s1.length; i += 1) {
    if (matched1[i]) {
      while (!matched2[k]) {
        k += 1;
      }
      if (s1[i] !== s2[k]) {
        transpositions += 1;
      }
      k += 1;
    }
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler adjustment
  const prefixScale = 0.1;
  let prefixLength = 0;

  const maxPrefix = Math.min(4, s1.length, s2.length);
  while (prefixLength < maxPrefix && s1[prefixLength] === s2[prefixLength]) {
    prefixLength += 1;
  }

  return jaro + prefixLength * prefixScale * (1 - jaro);
}

/**
 * Simple token overlap score:
 * intersection(tokens(a), tokens(b)) / max(|A|, |B|, 1)
 */
export function tokOverlapScore(a, b) {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }

  const denom = Math.max(setA.size, setB.size, 1);
  return intersection / denom;
}
