import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR =
  "C:\\Users\\nugye\\Desktop\\grudgeproduction\\grudgenew\\FRESH GRUDGE\\Assets\\uMMORPG\\Prefabs\\Entities\\Players";
const FILES = ["Human.prefab", "Barbarian.prefab", "Elf.prefab", "Dwarf.prefab", "Orc.prefab", "Undead.prefab"];
const KIT = /^(WK_|BRB_|ELF_|DWF_|ORC_|UD_)/i;
const CLOTH = /hand|boot|cape|cloak|shoulder|armor|hat|glove|foot|back|ring|relic|naked|mesh switch|PT_|Medieval/i;
const KEEP = /body|head|arm|leg|shoulder|weapon|sword|axe|bow|staff|shield|bag|wood|quiver|xtra|hat|cloak|cape|boot|glove|hand|foot|back|ring|relic|armor|naked/i;

async function parsePrefab(file) {
  const full = path.join(DIR, file);
  const st = fs.statSync(full);
  const rl = readline.createInterface({ input: fs.createReadStream(full, { encoding: "utf8" }) });
  let pending = null;
  const rows = [];
  const categories = [];
  const extraNames = new Set();
  for await (const line of rl) {
    const cat = /^\s+requiredCategory:\s*(.+)\s*$/.exec(line);
    if (cat) {
      const v = cat[1].replace(/^["']|["']$/g, "").trim();
      if (v) categories.push(v);
      continue;
    }
    const nameM = /^\s+m_Name:\s*(.+)\s*$/.exec(line);
    if (nameM) {
      pending = nameM[1].replace(/^["']|["']$/g, "");
      continue;
    }
    const actM = /^\s+m_IsActive:\s*([01])\s*$/.exec(line);
    if (actM && pending) {
      const name = pending;
      pending = null;
      if (KIT.test(name) || KEEP.test(name)) {
        rows.push({ name, active: actM[1] === "1" });
      }
      if (CLOTH.test(name) && !KIT.test(name)) extraNames.add(name);
    }
  }
  const kitRows = rows.filter((r) => KIT.test(r.name));
  const extraRows = rows.filter((r) => !KIT.test(r.name));
  const unique = (arr) => [...new Set(arr)];
  return {
    file,
    bytes: st.size,
    slotInfo: unique(categories),
    kitActive: unique(kitRows.filter((r) => r.active).map((r) => r.name)),
    kitHidden: unique(kitRows.filter((r) => !r.active).map((r) => r.name)),
    extraActive: unique(extraRows.filter((r) => r.active).map((r) => r.name)),
    extraHidden: unique(extraRows.filter((r) => !r.active).map((r) => r.name)),
    extraClothNames: [...extraNames].sort(),
    kitCount: kitRows.length,
  };
}

const out = [];
for (const f of FILES) {
  const full = path.join(DIR, f);
  if (!fs.existsSync(full)) {
    out.push({ file: f, missing: true });
    continue;
  }
  console.error("parse", f);
  out.push(await parsePrefab(f));
}
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), "_ummorpg-player-prefabs.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log("wrote", dest);
for (const r of out) {
  if (r.missing) {
    console.log(r.file, "MISSING");
    continue;
  }
  console.log(
    `\n=== ${r.file} ${Math.round(r.bytes / 1024)}KB slots=${r.slotInfo.join("|")} kit=${r.kitActive.length}/${r.kitCount} extraCloth=${r.extraClothNames.length} ===`,
  );
  console.log("  kitActive:", r.kitActive.join(", ") || "(none)");
  console.log("  extraActive:", r.extraActive.slice(0, 40).join(", ") || "(none)");
}
