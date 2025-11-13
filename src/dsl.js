export function define(config) {
  return config;
}

export function caseWhen(pattern, handler, options = {}) {
  return {
    pattern,
    handler,
    options
  };
}

export function scenario(id, spec) {
  return { id, ...spec };
}

export function httpWhen(match, handler, options) {
  return {
    kind: "http",
    match,
    handler,
    options
  };
}