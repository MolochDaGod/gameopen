import fs from "node:fs";

const path = "artifacts/animator/src/game/gameLibrary.ts";
let s = fs.readFileSync(path, "utf8");

const map = {
  "account-hub": "account",
  "mine-loader-realms": "voxel",
  "danger-room": "warlords",
  "voxgrudge-battle": "voxel",
  "forest-map": "warlords",
  "island-life": "voxel",
  "fabled-main-town": "warlords",
  "bridge-town-docks": "warlords",
  "dwarf-main-city": "warlords",
  "sailtest-map": "armada",
  "ruins-brawler": "voxel",
  "voxgrudge": "voxel",
  "voxgrudge-lab": "voxel",
  "warlord-genesis": "warlords",
  "voxel-editor": "voxel",
  "dressing-room": "warlords",
  "grudox-island": "warlords",
  "warlords": "warlords",
  "rts-grudge": "warlords",
  "dungeon-crawler": "voxel",
  "water-island": "warlords",
  "tactical-infinity": "warlords",
  "angel-island": "voxel",
  "grudox-games": "voxel",
  "survival-grudges": "voxel",
  "z-brawl": "voxel",
  "mimic-dungeon": "warlords",
  "lobby": "account",
  "metaverse": "nexus",
  "mech-forge": "nexus",
  "forge-editor": "warlords",
};

for (const [id, cat] of Object.entries(map)) {
  const re = new RegExp(
    `(id:\\s*"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}",[\\s\\S]*?category:\\s*")[a-z-]+(")`,
  );
  if (!re.test(s)) {
    console.warn("miss", id);
    continue;
  }
  s = s.replace(re, `$1${cat}$2`);
}

// Demote thin lab from featured if still featured
s = s.replace(
  /(id:\s*"voxgrudge-lab",[\s\S]*?)featured:\s*true,/,
  "$1",
);

// Strengthen voxgrudge blurb to name production SSOT + desktop kit
s = s.replace(
  /id:\s*"voxgrudge",\s*title:\s*"VoxGrudge Full World",\s*short:\s*"[^"]*",\s*blurb:\s*\n\s*"[^"]*"/,
  `id: "voxgrudge",
    title: "VoxGrudge Full World",
    short: "Production voxel open world",
    blurb:
      "THE voxel open-world deploy (voxgrudge.vercel.app · GRUDOX /voxgrudge). Source kit: Desktop grudgeproduction/voxgrudge (entry grudge-warlords-openworld.html). Not index/live HTML forks."`,
);

// Insert Grim Armada + Nexus Carrier before closing of GAME_LIBRARY if missing
if (!s.includes('id: "grim-armada"')) {
  const insert = `
  {
    id: "grim-armada",
    title: "Grim Armada",
    short: "Naval armada era",
    blurb:
      "Production Armada-era fleet title — ships, naval combat. Live grim-armada-web.vercel.app. Import new Armada content under this era only.",
    category: "armada",
    tags: ["Naval", "Armada", "Fleet"],
    tone: "#4fc3c8",
    posterKey: "lobby",
    icon: "rally",
    engines: ["three"],
    launch: "external",
    url: "https://grim-armada-web.vercel.app/",
    deploy: { client: "vercel" },
    sources: ["F:\\\\GitHub\\\\grim-armada-web", "GrimArmada"],
    featured: true,
    status: "live",
  },
  {
    id: "nexus-carrier",
    title: "Carrier · Nexus",
    short: "Fleet room / WS nexus",
    blurb:
      "Nexus-era live room relay (carrier.grudge-studio.com). Use for multiplayer presence handoff — not a second open world.",
    category: "nexus",
    tags: ["Nexus", "Multiplayer", "WS"],
    tone: "#9d8bff",
    posterKey: "zones",
    icon: "rally",
    engines: ["socketio"],
    launch: "external",
    url: "https://carrier.grudge-studio.com/",
    deploy: { client: "vercel", server: "railway", edge: "cloudflare-worker" },
    sources: ["gameopen carrier", "voxgrudge-grudox-room"],
    featured: true,
    status: "live",
  },
  {
    id: "nexus-slot",
    title: "Nexus Import Bay",
    short: "Era scaffold · sci-fi",
    blurb:
      "Reserved Nexus-era shelf for production imports (drive, space RTS, cyber packs). Do not dump Warlords or Voxel HTML here — wire a live Vercel URL first.",
    category: "nexus",
    tags: ["Nexus", "Import", "Scaffold"],
    tone: "#7a6cff",
    posterKey: "zones",
    icon: "explore",
    engines: ["three"],
    launch: "external",
    url: "https://grudox.grudge-studio.com/games",
    deploy: { client: "vercel" },
    sources: ["era:nexus"],
    status: "migrating",
  },
  {
    id: "armada-slot",
    title: "Armada Import Bay",
    short: "Era scaffold · naval",
    blurb:
      "Reserved Armada-era shelf for sail/fleet imports beyond Grim Armada + Sailtest. Production URL required before featured.",
    category: "armada",
    tags: ["Armada", "Import", "Scaffold"],
    tone: "#3aa8b0",
    posterKey: "lobby",
    icon: "explore",
    engines: ["three"],
    launch: "external",
    url: "https://grim-armada-web.vercel.app/",
    deploy: { client: "vercel" },
    sources: ["era:armada"],
    status: "migrating",
  },
`;
  s = s.replace(
    /(\{\s*id:\s*"forge-editor",[\s\S]*?status:\s*"live",\s*\},)\s*\] as const;/,
    `$1${insert}] as const;`,
  );
}

// Helpers after libraryByCategory
if (!s.includes("export function libraryByEra")) {
  s = s.replace(
    `export function libraryByCategory(cat: GameCategory | "all"): GameEntry[] {
  if (cat === "all") return [...GAME_LIBRARY];
  return GAME_LIBRARY.filter((g) => g.category === cat);
}`,
    `export function libraryByCategory(cat: GameCategory | "all"): GameEntry[] {
  if (cat === "all") return [...GAME_LIBRARY];
  return GAME_LIBRARY.filter((g) => g.category === cat);
}

/** Alias — eras are the library categories. */
export function libraryByEra(era: GameCategory | "all"): GameEntry[] {
  return libraryByCategory(era);
}

/** Production voxel titles only (no lab/scaffold). */
export function productionVoxelGames(): GameEntry[] {
  return GAME_LIBRARY.filter(
    (g) =>
      g.category === "voxel" &&
      g.status === "live" &&
      g.id !== "voxgrudge-lab" &&
      !g.id.endsWith("-slot"),
  );
}`,
  );
}

fs.writeFileSync(path, s);
const found = [...s.matchAll(/id:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"/g)].map(
  (m) => `${m[1]} -> ${m[2]}`,
);
console.log(found.join("\n"));
console.log("total", found.length);
