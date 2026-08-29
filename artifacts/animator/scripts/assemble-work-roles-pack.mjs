/**
 * Assemble anims/baked/work-roles pack from existing locomotion + harvest JSON.
 * No re-bake required — copies + writes role manifests for AI loaders.
 *
 * Usage (from artifacts/animator):
 *   node scripts/assemble-work-roles-pack.mjs
 *
 * Also mirrors into GrudgeBuilder client/public if path exists.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BAKED = path.join(ROOT, "public/anims/baked");
const OUT = path.join(BAKED, "work-roles");

const ROLES = {
  auto_harvest_mine: {
    idle: "locomotion/idle",
    walk: "locomotion/walk_forward",
    run: "locomotion/run_forward",
    work: "harvest/mining",
    workAlt: "harvest/mining-l",
    carryWalk: "harvest/holding-walk",
    carryIdle: "harvest/holding-idle",
  },
  auto_harvest_chop: {
    idle: "locomotion/idle",
    walk: "locomotion/walk_forward",
    run: "locomotion/run_forward",
    work: "harvest/chop",
    workBegin: "harvest/hammer-begin",
    carryWalk: "harvest/holding-walk",
    carryIdle: "harvest/holding-idle",
  },
  auto_harvest_gather: {
    idle: "locomotion/idle",
    walk: "locomotion/walk_forward",
    work: "harvest/gathering",
    workAlt: "harvest/gathering02",
    workEnd: "harvest/pull-plant",
    carryWalk: "harvest/holding-walk",
    carryIdle: "harvest/holding-idle",
  },
  auto_harvest_fish: {
    idle: "locomotion/idle",
    walk: "locomotion/walk_forward",
    work: "harvest/fishing-wait",
    workBegin: "harvest/fishing-cast",
    workEnd: "harvest/fishing-catch",
  },
  farming: {
    idle: "locomotion/idle",
    walk: "locomotion/walk_forward",
    till: "harvest/farm-plow",
    plant: "harvest/dig-and-plant-seeds",
    water: "harvest/watering",
    reap: "harvest/pull-plant",
  },
  cooking: {
    idle: "locomotion/idle",
    walk: "locomotion/walk_forward",
    prep: "harvest/kneeling-idle",
    cook: "harvest/cow-milking",
    serve: "harvest/pick-fruit",
  },
  refining: {
    idle: "locomotion/idle",
    walk: "locomotion/walk_forward",
    start: "harvest/hammer-begin",
    loop: "harvest/hammer",
    finish: "harvest/chop",
    carryWalk: "harvest/holding-walk",
  },
  carry: {
    idle: "harvest/holding-idle",
    walk: "harvest/holding-walk",
    wheelWalk: "harvest/wheelbarrow-walk",
    wheelIdle: "harvest/wheelbarrow-idle",
    dump: "harvest/wheelbarrow-dump",
  },
};

function copyRel(rel, destName) {
  const src = path.join(BAKED, `${rel}.json`);
  if (!fs.existsSync(src)) {
    // try harvest-only short name
    const alt = path.join(BAKED, "harvest", path.basename(rel) + ".json");
    if (fs.existsSync(alt)) {
      fs.copyFileSync(alt, path.join(OUT, destName));
      return true;
    }
    console.warn("MISS", rel);
    return false;
  }
  fs.copyFileSync(src, path.join(OUT, destName));
  return true;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { roles: {}, copied: [], missing: [] };

  // Flat copies for direct role loaders
  for (const [role, map] of Object.entries(ROLES)) {
    const roleDir = path.join(OUT, role);
    fs.mkdirSync(roleDir, { recursive: true });
    const files = {};
    for (const [key, rel] of Object.entries(map)) {
      const destName = `${key}.json`;
      const ok = copyRel(rel, path.join(role, destName));
      if (ok) {
        files[key] = `work-roles/${role}/${key}`;
        report.copied.push(`${role}/${key} ← ${rel}`);
      } else {
        report.missing.push(`${role}/${key} ← ${rel}`);
      }
    }
    report.roles[role] = files;
    fs.writeFileSync(
      path.join(roleDir, "manifest.json"),
      JSON.stringify(
        {
          role,
          skeleton: "Bip001",
          stripPositionTracks: true,
          clips: files,
          source: "locomotion/* + harvest/* (Human Crafting FREE + farming Mixamo)",
        },
        null,
        2,
      ),
    );
  }

  const rootMan = {
    pack: "work-roles",
    version: "1.0.0",
    updated: new Date().toISOString().slice(0, 10),
    skeleton: "Bip001",
    description:
      "AI work packs: loco + auto-harvest / farming / cooking / refining (assembled, not re-baked)",
    roles: Object.keys(ROLES),
    report,
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(rootMan, null, 2));
  console.log("work-roles pack →", OUT);
  console.log("copied", report.copied.length, "missing", report.missing.length);

  // Mirror to GrudgeBuilder if present
  const gb = path.resolve(
    ROOT,
    "../../../GitHub/GrudgeBuilder/client/public/anims/baked/work-roles",
  );
  const gbAlt = "F:/GitHub/GrudgeBuilder/client/public/anims/baked/work-roles";
  for (const dest of [gb, gbAlt]) {
    try {
      if (!fs.existsSync(path.dirname(dest))) continue;
      fs.cpSync(OUT, dest, { recursive: true });
      console.log("mirrored →", dest);
    } catch (e) {
      /* optional */
    }
  }
}

main();
