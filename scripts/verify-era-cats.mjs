import fs from "node:fs";
const s = fs.readFileSync("artifacts/animator/src/game/gameLibrary.ts", "utf8");
const start = s.indexOf("export const GAME_LIBRARY");
const end = s.indexOf("] as const", start);
const body = s.slice(start, end);
const rows = [...body.matchAll(/id:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"/g)].map(
  (m) => [m[1], m[2]],
);
for (const [id, cat] of rows) console.log(`${id} | ${cat}`);
console.log("count", rows.length);
const bad = rows.filter(([, c]) => !["voxel", "warlords", "nexus", "armada", "account"].includes(c));
console.log("bad", bad);
