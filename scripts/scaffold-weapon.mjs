#!/usr/bin/env node
/**
 * Scaffold a weapon package: item + weapon + 4 skill stubs.
 *
 * Usage:
 *   node scripts/scaffold-weapon.mjs --family sword --slug steel_longsword
 *   pnpm scaffold:weapon -- --family bow --slug oak_recurve
 */
import { existsSync } from "node:fs";
import {
  contentPath,
  writeJson,
  rebuildManifests,
} from "./content-lib.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const family = (arg("family") || "sword").toLowerCase();
const slug = (arg("slug") || "new_01").toLowerCase().replace(/[^a-z0-9_]/g, "_");
const baseName = arg("name") || slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const wpnId = `wpn_${family}_${slug}`;
const itmId = `itm_${family}_${slug}`;

const skillDefs = [
  {
    id: `${family}.primary`,
    label: "Primary",
    hotbarSlot: 1,
    slotKind: "primary",
    power: 1,
    cost: { stamina: 6 },
    cooldown: 0,
  },
  {
    id: `${family}.secondary`,
    label: "Secondary",
    hotbarSlot: 2,
    slotKind: "primary",
    power: 1.15,
    cost: { stamina: 8 },
    cooldown: 0,
  },
  {
    id: `${family}.ability`,
    label: "Ability",
    hotbarSlot: 3,
    slotKind: "ability",
    power: 1.4,
    cost: { stamina: 14 },
    cooldown: 8,
  },
  {
    id: `${family}.ultimate`,
    label: "Ultimate",
    hotbarSlot: 4,
    slotKind: "ultimate",
    power: 2.0,
    cost: { stamina: 28 },
    cooldown: 16,
  },
];

const itemPath = contentPath("items", `${itmId}.json`);
const wpnPath = contentPath("weapons", `${wpnId}.json`);

if (existsSync(wpnPath) && !process.argv.includes("--force")) {
  console.error(`Already exists: ${wpnPath} (use --force to overwrite stubs carefully)`);
  process.exit(1);
}

writeJson(itemPath, {
  id: itmId,
  kind: "weapon",
  name: baseName,
  description: `${baseName} — scaffolded weapon package.`,
  rarity: "common",
  maxStack: 1,
  sellValue: 10,
  tags: [family, "scaffolded"],
  icon: {
    path: `icons/weapons/${family}_${slug}.png`,
    status: "missing",
  },
});

writeJson(wpnPath, {
  id: wpnId,
  itemId: itmId,
  family,
  slot: "mainHand",
  twoHanded: false,
  baseDamage: 16,
  attackSpeed: 1.0,
  animPack: family,
  skills: skillDefs.map((s) => s.id),
  mesh: {
    path: "",
    format: "glb",
    grip: {
      bone: "Bip001_R_Hand",
      pos: [0, 0, 0],
      rot: [0, 0, 0],
      scale: 1,
    },
    status: "missing",
  },
  tags: ["scaffolded"],
  ship: false,
  readiness: {
    data: "ready",
    mesh: "missing",
    combat: "placeholder",
    present: "missing",
  },
});

for (const s of skillDefs) {
  const skillPath = contentPath("skills", `${s.id}.json`);
  if (existsSync(skillPath) && !process.argv.includes("--force")) {
    console.warn(`skip existing skill ${s.id}`);
    continue;
  }
  writeJson(skillPath, {
    id: s.id,
    weaponFamily: family,
    label: s.label,
    description: `${baseName} ${s.label} — fill anim/VFX/icon.`,
    rank: s.hotbarSlot <= 2 ? 1 : 2,
    hotbarSlot: s.hotbarSlot,
    slotKind: s.slotKind,
    animKey: `${family}_${s.slotKind}`,
    anim: { path: "", status: "missing" },
    power: s.power,
    cost: s.cost,
    cooldown: s.cooldown,
    damageType: "physical",
    effects: ["fx.warrior.cleave"],
    hitWindows: [{ t: 0.25, kind: "melee", radius: 1.4, angleDeg: 90 }],
    vfx: {
      castTimeMs: 0,
      charge: { enabled: false, color: "#d8c38a", size: 0.4 },
      cast: { enabled: false, color: "#d8c38a", size: 0.5 },
      slashTrail: {
        enabled: true,
        color: "#e8d9a0",
        reach: 1.5,
        arcDeg: 90,
        wave: false,
        knockback: 0.5,
      },
      travel: {
        mode: "none",
        distance: 0,
        arc: 0,
        speed: 0,
        color: "#d8c38a",
        startAnchor: "weaponTip",
        endAnchor: "forward",
      },
      impact: { enabled: true, color: "#d8c38a", size: 0.4 },
      ground: { enabled: false, color: "#c79a5b" },
      aoe: { radius: 0, aroundPlayer: false },
      physics: { impulse: 2, up: 0.2, falloff: true },
      afterimage: {
        enabled: false,
        color: "#d8c38a",
        count: 0,
        spacingMs: 0,
        fadeMs: 0,
        scale: 1,
      },
    },
    icon: {
      path: `icons/skills/${s.id.replace(".", "_")}.png`,
      status: "missing",
    },
    readiness: {
      data: "ready",
      anim: "missing",
      vfx: "placeholder",
      icon: "missing",
    },
  });
}

const readiness = rebuildManifests();
console.log(`Scaffolded ${wpnId}`);
console.log(`  item:    content/items/${itmId}.json`);
console.log(`  weapon:  content/weapons/${wpnId}.json`);
console.log(`  skills:  ${skillDefs.map((s) => s.id).join(", ")}`);
console.log(`  avg readiness: ${readiness.summary.avgWeaponPct}%`);
console.log(`Next: fill mesh.path, anim paths, icons → pnpm readiness:weapons`);
