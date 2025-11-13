import Ajv from "ajv";
import fs from "node:fs";
import path from "node:path";
import { log } from "./log.js";

const ajv = new Ajv({ strict: false, allErrors: true });

function loadSchema(name) {
  const p = path.join(process.cwd(), "schemas", name + ".json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function validatePayload(kind, name, payload, mode = "warn") {
  try {
    const schema = loadSchema(name);
    if (!schema) {
      log("contracts.miss", { kind, name });
      return true;
    }
    const validate = ajv.compile(schema);
    const ok = validate(payload);
    if (!ok) {
      const errs = validate.errors
        ?.map((e) => `${e.instancePath} ${e.message}`)
        .join("; ");
      if (mode === "strict")
        throw new Error(`Schema violation ${name}: ${errs}`);
      log("contracts.warn", { kind, name, errs });
    }
    return true;
  } catch (e) {
    if (mode === "strict") throw e;
    log("contracts.error", { kind, name, error: String(e) });
    return false;
  }
}
