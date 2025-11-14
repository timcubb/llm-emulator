import { extractVarsLoosely, compileTemplateRegex } from "./patterns.js";
import { matchExact, scoreFuzzy, scoreNgramSemantic } from "./matcherBasic.js";

/**
 * Extract "static" tokens from a pattern (excluding {{variables}}).
 * Used to quickly filter obviously unrelated patterns.
 */
function staticTokensFromPattern(pattern) {
  const withoutVars = pattern
    .replace(/\{\{[a-zA-Z0-9_]+\}\}/g, " ")
    .toLowerCase();

  return withoutVars.split(/\s+/).filter((word) => word.length > 2);
}

/**
 * Check whether all words are contained (as whole words) in the text.
 */
function containsAllWords(text, words = []) {
  const haystack = ` ${String(text).toLowerCase()} `;
  return (words || []).every((word) => {
    const needle = ` ${String(word).toLowerCase()} `;
    return haystack.includes(needle);
  });
}

/**
 * Route an input text to the best matching "case" based on the
 * configured matching strategies and thresholds.
 */
export async function routeToCase({ text, config }) {
  const order = config.matching.order || [];
  const cases = config.cases || [];

  if (!text || cases.length === 0) {
    return { chosen: null, mode: "none", score: 0, vars: {}, pattern: null };
  }

  const normalizedText = String(text);

  // Pre-compute static tokens per case for cheap filtering
  const casesWithTokens = cases.map((c) => ({
    case: c,
    tokens: staticTokensFromPattern(c.pattern),
  }));

  // 1) Exact pattern match (after normalization)
  if (order.includes("pattern")) {
    for (const { case: caseDef } of casesWithTokens) {
      if (matchExact(normalizedText, caseDef.pattern)) {
        const vars = extractVarsLoosely(normalizedText, caseDef.pattern);
        return {
          chosen: caseDef,
          mode: "pattern",
          score: 1,
          vars,
          pattern: caseDef.pattern,
        };
      }
    }
  }

  // 2) Regex-based pattern matching (compiled from {{var}} templates)
  if (order.includes("pattern-regex")) {
    for (const { case: caseDef } of casesWithTokens) {
      const matcher = compileTemplateRegex(caseDef.pattern);
      const vars = matcher(normalizedText);
      if (vars) {
        return {
          chosen: caseDef,
          mode: "pattern-regex",
          score: 0.9,
          vars,
          pattern: caseDef.pattern,
        };
      }
    }
  }

  // 4) Fuzzy matching based on simple string similarity + token overlap
  if (order.includes("fuzzy")) {
    let bestScore = 0;
    let bestCase = null;

    const threshold = config.matching.fuzzy?.threshold ?? 0.4;

    for (const { case: caseDef, tokens } of casesWithTokens) {
      if (!containsAllWords(normalizedText, tokens)) {
        continue;
      }

      const score = scoreFuzzy(normalizedText, caseDef.pattern);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestCase = caseDef;
      }
    }

    if (bestCase) {
      const vars = extractVarsLoosely(normalizedText, bestCase.pattern);
      return {
        chosen: bestCase,
        mode: "fuzzy",
        score: bestScore,
        vars,
        pattern: bestCase.pattern,
      };
    }
  }

  // 5) Cheap semantic-ish matching via character n-gram cosine similarity
  if (order.includes("semantic-ngrams")) {
    let bestScore = 0;
    let bestCase = null;

    const threshold = config.matching.ngrams?.threshold ?? 0.3;

    for (const { case: caseDef, tokens } of casesWithTokens) {
      if (!containsAllWords(normalizedText, tokens)) {
        continue;
      }

      const score = scoreNgramSemantic(normalizedText, caseDef.pattern);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestCase = caseDef;
      }
    }

    if (bestCase) {
      const vars = extractVarsLoosely(normalizedText, bestCase.pattern);
      return {
        chosen: bestCase,
        mode: "semantic-ngrams",
        score: bestScore,
        vars,
        pattern: bestCase.pattern,
      };
    }
  }

  // Fallback: nothing matched above thresholds
  return {
    chosen: null,
    mode: "none",
    score: 0,
    vars: {},
    pattern: null,
  };
}

/**
 * Invoke a matched case handler with either:
 * - a single extracted variable (if exactly one is present in the pattern)
 * - the full context object otherwise
 *
 * Always coerces the handler's result to a string.
 */
export async function runHandler(chosenCase, context) {
  const variableMatches =
    chosenCase.pattern.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];

  const variableNames = variableMatches.map((match) =>
    match.replace(/[{}]/g, "")
  );

  // If the pattern contained exactly one {{var}}, pass that value directly
  if (variableNames.length === 1) {
    const variableName = variableNames[0];
    const variableValue = context.vars?.[variableName];
    const result = await chosenCase.handler(variableValue, context);
    return String(result ?? "");
  }

  // Otherwise, just pass the whole context to the handler
  const result = await chosenCase.handler(context);
  return String(result ?? "");
}
