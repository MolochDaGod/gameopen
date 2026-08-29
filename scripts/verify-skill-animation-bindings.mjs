/**
 * Validate shared skill-to-animation bindings before they are synced into the
 * Animator artifact. This verifies schema and rig separation; clip existence is
 * confirmed by the per-lane bake/readiness checks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "content/anims/skill-bindings.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const keys = new Set();
const skills = new Set();
const lanes = new Set(Object.keys(manifest.rigLanes ?? {}));
let failed = false;

for (const binding of manifest.bindings ?? []) {
  if (!binding.animationKey || !binding.skillId || !binding.role) {
    console.error("binding requires animationKey, skillId, and role", binding);
    failed = true;
    continue;
  }
  if (keys.has(binding.animationKey)) {
    console.error("duplicate animationKey", binding.animationKey);
    failed = true;
  }
  keys.add(binding.animationKey);
  if (skills.has(binding.skillId)) {
    console.error("duplicate skillId", binding.skillId);
    failed = true;
  }
  skills.add(binding.skillId);

  for (const [lane, target] of Object.entries(binding.lanes ?? {})) {
    if (!lanes.has(lane)) {
      console.error("unknown rig lane", lane, "for", binding.animationKey);
      failed = true;
    }
    if (!target || (typeof target.sourceClipId !== "string" && typeof target.animationDbId !== "string")) {
      console.error("lane needs sourceClipId or animationDbId", lane, binding.animationKey);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`skill animation bindings: ${keys.size} bindings, ${lanes.size} rig lanes`);