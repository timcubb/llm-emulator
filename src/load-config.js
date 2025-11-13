import { pathToFileURL } from "node:url";

export async function loadJsConfig(path) {
  const mod = await import(pathToFileURL(path).href);
  const config = mod.default || mod.config || mod;
  config.server ||= {};
  config.server.port ??= 11434;
  config.server.stream ??= false;
  config.matching ||= {};
  config.matching.order ||= [
    "pattern-regex",
    "semantic-minilm",
    "pattern",
    "fuzzy",
    "semantic-ngrams",
  ];
  config.matching.minilm ||= { threshold: 0.72 };
  config.matching.fuzzy ||= { threshold: 0.38 };
  config.cases ||= [];
  config.scenarios ||= [];
  config.contracts ||= {
    provider: "openai",
    version: "2025-06-01",
    mode: "warn",
  };
  config.limits ||= {
    tokensPerMinute: 120000,
    requestsPerMinute: 1000,
  };
  config.vcr ||= {
    enabled: false,
    mode: "replay",
    cassetteDir: "./.cassettes",
    redact: ["Authorization", "api_key"],
  };
  config.defaults ||= { fallback: "Sorry, I don't have a mock for that yet." };
  config.env ||= "local";
  config.seed ??= 42;

  return config;
}
