import crypto from "node:crypto";

/**
 * Apply environment/CLI overrides onto the loaded config object.
 */
export function applyEnvOverrides(
  config,
  { env, seed, testTag, port, useScenario }
) {
  const updated = { ...config };

  updated.env = env;
  updated.seed = seed;
  updated.testTag = testTag;
  updated.useScenario = useScenario ?? null;

  updated.server = {
    ...(updated.server || {}),
    port,
  };

  return updated;
}

/**
 * Deterministic PRNG used anywhere we want repeatable randomness.
 */
export function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash32(str) {
  const hash = crypto.createHash("sha256").update(String(str)).digest();
  return hash.readUInt32BE(0);
}

export const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function newId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}
