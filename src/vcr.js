import fs from "node:fs";
import path from "node:path";
export function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
export function record(cassetteDir, entry) {
  try {
    ensureDir(cassetteDir);
    const p = path.join(
      cassetteDir,
      `${entry.endpoint.replace(/[\/:]/g, "_")}.jsonl`
    );
    fs.appendFileSync(p, JSON.stringify(entry) + "\n", "utf-8");
  } catch {}
}
