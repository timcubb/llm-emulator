import { matchPathPattern } from "./matchPathPattern.js";

export function findHttpMock(httpMocks = [], req) {
  const method = req.method.toUpperCase();
  const path = req.path || "/";

  for (const mock of httpMocks) {
    const match = mock.match || {};
    const wantMethod = (match.method || "").toUpperCase();

    if (wantMethod && wantMethod !== method) {
      continue;
    }

    if (!match.path) {
      continue;
    }

    const result = matchPathPattern(match.path, path);
    if (!result) {
      continue;
    }

    return { mock, params: result.params || {} };
  }

  return null;
}
