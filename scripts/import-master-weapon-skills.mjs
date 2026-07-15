/**
 * Import ObjectStore master-weaponSkills into content/skills + content/weapons.
 *
 * Usage (from gameopen root):
 *   node scripts/import-master-weapon-skills.mjs
 *
 * Fetches https://objectstore.grudge-studio.com/api/v1/master-weaponSkills.json
 * and writes T0-tier prefabs (primary/secondary/ability/ultimate) per family
 * for the Danger Room sandbox, following content/docs contracts.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const MASTER_URL =
  process.env.MASTER_WEAPON_SKILLS_URL ||
  "https://objectstore.grudge-studio.com/api/v1/master-weaponSkills.json";

const FAMILY_MAP = {
  SWORD: { family: "sword", weaponId: "wpn_sword_master", mesh: "models/weapons/sword.glb" },
  AXE: { family: "axe", weaponId: "wpn_axe_master", mesh: "models/weapons/axe.glb" },
  BOW: { family: "bow", weaponId: "wpn_bow_master", mesh: "models/weapons/bow.glb" },
  CROSSBOW: { family: "crossbow", weaponId: "wpn_crossbow_master", mesh: "models/weapons/rifle.glb" },
  GUN: { family: "gun", weaponId: "wpn_gun_master", mesh: "models/weapons/pistol.glb" },
  DAGGER: { family: "dagger", weaponId: "wpn_dagger_master", mesh: "models/weapons/dagger.glb" },
  STAFF: { family: "staff", weaponId: "wpn_staff_master", mesh: "models/weapons/staff.glb" },
  HAMMER: { family: "hammer", weaponId: "wpn_hammer_master", mesh: "models/weapons/hammer.glb" },
  GREATSWORD: {
    family: "greatsword",
    weaponId: "wpn_greatsword_master",
    mesh: "models/weapons/greatsword.glb",
  },
  GREATAXE: { family: "greataxe", weaponId: "wpn_greataxe_master", mesh: "models/weapons/axe.glb" },
  SPEAR: { family: "spear", weaponId: "wpn_spear_master", mesh: "models/weapons/spear.glb" },
  MACE: { family: "mace", weaponId: "wpn_mace_master", mesh: "models/weapons/mace.glb" },
  WAND: { family: "wand", weaponId: "wpn_wand_master", mesh: "models/weapons/staff.glb" },
  SCYTHE: { family: "scythe", weaponId: "wpn_scythe_master", mesh: "models/weapons/war-spear.glb" },
  TOME: { family: "tome", weaponId: "wpn_tome_master", mesh: "models/weapons/shield.glb" },
  SHIELD: { family: "shield", weaponId: "wpn_shield_master", mesh: "models/weapons/shield.glb" },
};

const SLOT_KIND = {
  primary: "primary",
  secondary: "secondary",
  ability: "ability",
  ultimate: "ultimate",
};

function cdn(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://assets.grudge-studio.com/${String(path).replace(/^\//, "")}`;
}

function pickSkill(slot) {
  if (!slot?.skills?.length) return null;
  const sorted = [...slot.skills].sort(
    (a, b) => (a.tier ?? 99) - (b.tier ?? 99) || String(a.name).localeCompare(String(b.name)),
  );
  return sorted.find((s) => (s.tier ?? 1) <= 1) || sorted[0];
}

function skillPrefab(family, slotType, skill, hotbarSlot) {
  const id = skill.id || `${family}.${slotType}`;
  const animKey =
    slotType === "primary"
      ? "attack"
      : slotType === "ultimate"
        ? "attack"
        : "attack";
  const ranged =
    !!skill.projectile ||
    (typeof skill.range === "number" && skill.range > 4) ||
    /bolt|shot|missile|arrow|cast|blast/i.test(skill.name || "");
  return {
    id,
    family,
    slotKind: SLOT_KIND[slotType] || "ability",
    hotbarSlot,
    name: skill.name,
    description: skill.description || "",
    animKey,
    anim: {
      path: `/anim/base/${animKey}`,
      status: "placeholder",
      notes: "Mapped to Danger Room attack one-shot until dedicated clip bake",
    },
    power: Math.max(0.5, Math.min(4, (Math.abs(skill.damage || 40) / 45) || 1)),
    cost: {
      stamina: skill.resourceCost?.stamina ?? (ranged ? 0 : 3),
      mana: skill.resourceCost?.mana ?? (ranged ? 4 : 0),
    },
    cooldown: skill.cooldown > 0 ? skill.cooldown : hotbarSlot === 4 ? 12 : hotbarSlot,
    hitWindows: [
      ranged
        ? { t: 0.18, kind: "projectile", radius: 0.4, speed: 28 }
        : { t: 0.22, kind: "melee", radius: 1.4, angleDeg: 90 },
    ],
    vfx: {
      cast: skill.damageType === "fire" ? "#ff7a1a" : "#d8c38a",
      impact: skill.damageType === "frost" ? "#5fd6ff" : "#e8d9a0",
      mode: ranged ? "directional" : "none",
    },
    icon: {
      path: String(skill.icon || "").replace(/^\//, "") || "icons/pack/misc/Flow.png",
      cdnUrl: cdn(skill.icon) || "https://assets.grudge-studio.com/icons/pack/misc/Flow.png",
      source: "objectstore-master-weaponSkills@3.1.0",
      status: "ready",
    },
    readiness: {
      data: "ready",
      anim: "placeholder",
      vfx: "ready",
      icon: "ready",
      combat: "ready",
    },
    masterUuid: skill.uuid || null,
    damageType: skill.damageType || "physical",
    ship: true,
  };
}

function weaponPrefab(meta, masterType, skills, icon) {
  return {
    id: meta.weaponId,
    itemId: meta.weaponId.replace(/^wpn_/, "itm_"),
    family: meta.family,
    slot: masterType === "TOME" || masterType === "SHIELD" ? "offHand" : "mainHand",
    twoHanded: ["BOW", "CROSSBOW", "GREATSWORD", "GREATAXE", "SPEAR", "SCYTHE", "STAFF"].includes(
      masterType,
    ),
    baseDamage: 22,
    attackSpeed: 1.0,
    animPack:
      masterType === "BOW" || masterType === "CROSSBOW"
        ? "longbow"
        : masterType === "STAFF" || masterType === "WAND" || masterType === "TOME"
          ? "magic"
          : "sword_shield",
    skills: skills.map((s) => s.id),
    mesh: {
      path: meta.mesh,
      format: "glb",
      status: "ready",
      notes: "Mapped to existing converted gameopen weapon GLB (uMMORPG port stand-in)",
    },
    tags: ["master-weaponSkills", "ummorpg-port", masterType.toLowerCase()],
    ship: true,
    readiness: {
      data: "ready",
      mesh: "ready",
      combat: "ready",
      present: "ready",
      icon: "ready",
    },
    icon: {
      path: String(icon || "").replace(/^\//, "") || "icons/pack/weapons/Sword_01.png",
      cdnUrl: cdn(icon) || "https://assets.grudge-studio.com/icons/pack/weapons/Sword_01.png",
      source: "objectstore-master-weaponSkills@3.1.0",
      status: "ready",
    },
  };
}

async function main() {
  console.log("[import] fetch", MASTER_URL);
  const res = await fetch(MASTER_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const catalog = await res.json();
  console.log(
    `[import] version=${catalog.version} types=${catalog.weaponTypes?.length} skills=${catalog.totalSkills}`,
  );

  const skillsDir = join(root, "content", "skills");
  const weaponsDir = join(root, "content", "weapons");
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(weaponsDir, { recursive: true });

  let skillCount = 0;
  let weaponCount = 0;
  const indexWeapons = [];
  const indexSkills = [];

  for (const wt of catalog.weaponTypes || []) {
    const meta = FAMILY_MAP[wt.id];
    if (!meta) {
      console.warn("[import] skip type", wt.id);
      continue;
    }
    const slotOrder = ["primary", "secondary", "ability", "ultimate"];
    const skills = [];
    let hotbar = 1;
    for (const st of slotOrder) {
      const slot = (wt.slots || []).find((s) => s.type === st);
      // TOME only has ultimate in master — use first 4 unique ultimate-ish names
      let sk = pickSkill(slot);
      if (!sk && wt.id === "TOME") {
        const ult = (wt.slots || []).find((s) => s.type === "ultimate");
        sk = ult?.skills?.[hotbar - 1] || ult?.skills?.[0];
        if (sk) {
          sk = {
            ...sk,
            name: String(sk.name || "Tome Spell")
              .replace(/^"+|"+$/g, "")
              .split(",")[0]
              ?.replace(/"/g, "")
              .trim() || `Tome Spell ${hotbar}`,
            id: `${sk.id || "tome"}_slot${hotbar}`,
          };
        }
      }
      if (!sk) continue;
      const prefab = skillPrefab(meta.family, st, sk, hotbar);
      const file = join(skillsDir, `${prefab.id}.json`);
      writeFileSync(file, JSON.stringify(prefab, null, 2) + "\n");
      skills.push(prefab);
      indexSkills.push({ id: prefab.id, family: meta.family, slot: st, file: `skills/${prefab.id}.json` });
      skillCount++;
      hotbar++;
    }
    if (!skills.length) continue;
    const wpn = weaponPrefab(meta, wt.id, skills, wt.icon);
    writeFileSync(join(weaponsDir, `${wpn.id}.json`), JSON.stringify(wpn, null, 2) + "\n");
    indexWeapons.push({ id: wpn.id, family: meta.family, file: `weapons/${wpn.id}.json` });
    weaponCount++;
    console.log(`[import] ${wt.id} → ${skills.length} skills + weapon ${wpn.id}`);
  }

  const manifests = join(root, "content", "manifests");
  mkdirSync(manifests, { recursive: true });
  writeFileSync(
    join(manifests, "master-import.index.json"),
    JSON.stringify(
      {
        version: catalog.version,
        generated: new Date().toISOString(),
        source: MASTER_URL,
        weapons: indexWeapons,
        skills: indexSkills,
        counts: { weapons: weaponCount, skills: skillCount },
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`[import] done weapons=${weaponCount} skills=${skillCount}`);
  console.log(`[import] wrote content/manifests/master-import.index.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
