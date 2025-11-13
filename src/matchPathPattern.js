export function matchPathPattern(pattern, actualPath) {
  // Ensure leading slash consistency
  const normalizedPattern = pattern.startsWith("/")
    ? pattern
    : `/${pattern}`;

  const normalizedPath = actualPath.startsWith("/")
    ? actualPath
    : `/${actualPath}`;

  const patternSegments = normalizedPattern.split("/").filter(Boolean);
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params = {};

  for (let i = 0; i < patternSegments.length; i += 1) {
    const pSeg = patternSegments[i];
    const aSeg = pathSegments[i];

    if (pSeg.startsWith(":")) {
      const name = pSeg.slice(1);
      params[name] = aSeg;
      continue;
    }

    if (pSeg !== aSeg) {
      return null;
    }
  }

  return { params };
}
