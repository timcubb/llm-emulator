import { norm } from "./text.js";

/**
 * Render a simple {{var}} template using the provided vars object.
 */
export function renderTemplate(template, vars) {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => {
    return vars?.[key] ?? "";
  });
}

/**
 * Try to extract variables from input based on a {{var}} pattern.
 * First attempts a stricter match, then a looser one that allows
 * a bit of "noise" between tokens.
 */
export function extractVarsLoosely(input, pattern) {
  const strictRegex = buildPatternRegex(pattern, false);
  let match = norm(input).match(strictRegex);
  if (match?.groups) {
    return match.groups;
  }

  const looseRegex = buildPatternRegex(pattern, true);
  match = norm(input).match(looseRegex);
  if (match?.groups) {
    return match.groups;
  }

  return {};
}

function buildPatternRegex(pattern, allowLooseNoise = false) {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]]/g, "\\$&");
  const spacePattern = allowLooseNoise ? "(?:\\s+\\w{0,12})?" : "\\s+";

  const body = escaped
    .replace(/\s+/g, spacePattern)
    .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, "(?<$1>.+?)");

  return new RegExp(`^${body}$`, "i");
}

/**
 * Compile a {{var}} template into a function that, when given an input
 * string, returns either the extracted variables or null if it does not match.
 */
export function compileTemplateRegex(
  pattern,
  options = { looseSpaces: true, caseInsensitive: true, trimVar: true }
) {
  const {
    looseSpaces = true,
    caseInsensitive = true,
    trimVar = true,
  } = options;

  const escaped = pattern.replace(/[-/\\^$+?.()|[\]]/g, "\\$&");
  const space = looseSpaces ? "\\s+" : " ";

  const withCaptures = escaped.replace(
    /\{\{([a-zA-Z0-9_]+)\}\}/g,
    (_match, name) => `(?<${name}>.+?)`
  );

  const relaxed = withCaptures.replace(/\s+/g, space);
  const source = `^\\s*${relaxed}\\s*$`;
  const flags = caseInsensitive ? "i" : "";

  const regex = new RegExp(source, flags);

  return (input) => {
    const match = regex.exec(input);
    if (!match || !match.groups) {
      return null;
    }

    const vars = {};
    for (const [key, value] of Object.entries(match.groups)) {
      vars[key] = trimVar ? String(value).trim() : String(value);
    }
    return vars;
  };
}
