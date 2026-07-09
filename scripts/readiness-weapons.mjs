#!/usr/bin/env node
/**
 * Print weapon + skill readiness table. Exit 1 if any ship-tagged weapon is blocked.
 *
 *   pnpm readiness:weapons
 */
import {
  loadCatalog,
  evaluateWeapon,
  evaluateSkill,
  rebuildManifests,
  assetExists,
} from "./content-lib.mjs";

const cat = loadCatalog();
const readiness = rebuildManifests();

console.log("\n═══ WEAPONS ═══");
console.log(
  pad("id", 28) +
    pad("family", 10) +
    pad("%", 5) +
    pad("data", 12) +
    pad("mesh", 12) +
    pad("combat", 12) +
    pad("present", 12) +
    "ship",
);
console.log("-".repeat(100));

let blocked = 0;
for (const w of cat.weapons) {
  const rep = evaluateWeapon(w, cat.skillsById);
  if (rep.shipBlocked) blocked++;
  const flag = rep.shipBlocked ? " BLOCKED" : rep.ship ? " ship" : "";
  console.log(
    pad(rep.id, 28) +
      pad(rep.family || "?", 10) +
      pad(String(rep.pct), 5) +
      pad(rep.readiness.data || "?", 12) +
      pad(rep.readiness.mesh || "?", 12) +
      pad(rep.readiness.combat || "?", 12) +
      pad(rep.readiness.present || "?", 12) +
      flag.trim(),
  );
  for (const issue of rep.issues) console.log(`    ! ${issue}`);
  // mesh file presence
  const mp = w.data.mesh?.path;
  if (mp) {
    console.log(
      `    mesh file: ${assetExists(mp) ? "FOUND" : "NOT FOUND"}  ${mp}`,
    );
  }
}

console.log("\n═══ SKILLS ═══");
console.log(
  pad("id", 24) + pad("family", 10) + pad("%", 5) + pad("anim", 12) + pad("vfx", 12) + "icon",
);
console.log("-".repeat(80));
for (const s of cat.skills) {
  const rep = evaluateSkill(s);
  console.log(
    pad(rep.id, 24) +
      pad(rep.family || "?", 10) +
      pad(String(rep.pct), 5) +
      pad(rep.readiness.anim || "?", 12) +
      pad(rep.readiness.vfx || "?", 12) +
      (rep.readiness.icon || "?"),
  );
  for (const issue of rep.issues) console.log(`    ! ${issue}`);
  const ap = s.data.anim?.path;
  if (ap) {
    console.log(
      `    anim file: ${assetExists(ap) ? "FOUND" : "NOT FOUND"}  ${ap}`,
    );
  }
}

console.log("\n═══ SUMMARY ═══");
console.log(JSON.stringify(readiness.summary, null, 2));
console.log(`\nManifests written → content/manifests/readiness.json`);

if (blocked > 0) {
  console.error(`\n${blocked} ship-tagged weapon(s) blocked on readiness.`);
  process.exit(1);
}
// Gold standard uses placeholders for mesh/icon — not exit 1 unless ship requires ready-only
// shipBlocked only when status is missing. placeholder is OK for lab ship.
process.exit(0);

function pad(s, n) {
  const t = String(s);
  return t.length >= n ? t.slice(0, n) : t + " ".repeat(n - t.length);
}
