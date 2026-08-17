import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const contracts = [
  {
    path: "artifacts/animator/src/three/anim/AnimDatabase.ts",
    required: ["export class AnimDatabase", "getAnimDatabase", "bakePathFromRel"],
    forbidden: ["const OPEN_SAVE_NS", "export class GrudgeAvatar", "export class BrawlerScene"],
  },
  {
    path: "artifacts/animator/src/lib/characterLoadout.ts",
    required: ["const OPEN_SAVE_NS", "export function loadoutFromCharacter", "saveCharacterOpenLoadout"],
    forbidden: ["export class AnimDatabase", "export class GrudgeAvatar", "export class BrawlerScene"],
  },
  {
    path: "artifacts/animator/src/three/grudge/GrudgeAvatar.ts",
    required: ["export class GrudgeAvatar", "loadGrudge6CombatRig", "setLocomotion"],
    forbidden: ["const OPEN_SAVE_NS", "export class AnimDatabase", "export class BrawlerScene"],
  },
  {
    path: "artifacts/animator/src/three/brawler/BrawlerScene.ts",
    required: ["export class BrawlerScene", "private async loadEnvironment", "private animate"],
    forbidden: ["const OPEN_SAVE_NS", "export class AnimDatabase", "export class GrudgeAvatar"],
  },
];

let failed = false;
for (const contract of contracts) {
  const filePath = path.join(root, contract.path);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of contract.required) {
    if (!source.includes(marker)) {
      console.error(`[source-boundaries] ${contract.path}: missing ${marker}`);
      failed = true;
    }
  }
  for (const marker of contract.forbidden) {
    if (source.includes(marker)) {
      console.error(`[source-boundaries] ${contract.path}: contains foreign module marker ${marker}`);
      failed = true;
    }
  }
  if (source.includes(" - AnimDatabase.ts:")) {
    console.error(`[source-boundaries] ${contract.path}: contains leaked diagnostic text`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`[source-boundaries] verified ${contracts.length} module boundaries`);
