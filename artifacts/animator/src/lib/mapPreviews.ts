/**
 * Map / arena catalog for launcher + Admin UI cards.
 * Previews are procedural canvas "minimap / poster" art (no binary screenshots required).
 */

export type MapPreviewId =
  | "arena-1v1"
  | "arena-2v2"
  | "arena-ffa4"
  | "danger-holo"
  | "danger-foundry"
  | "danger-colosseum"
  | "sailtest"
  | "forest-map"
  | "island-life";

export interface MapPreviewDef {
  id: MapPreviewId;
  title: string;
  subtitle: string;
  blurb: string;
  /** Accent color for chrome */
  tone: string;
  badges: string[];
  /** Optional real poster under public/ */
  posterUrl?: string;
  /** Kind for minimap generator */
  kind: "duel" | "team" | "ffa" | "room" | "islands" | "forest" | "survival";
  players?: string;
  objective?: string;
}

export const ARENA_MAP_CARDS: MapPreviewDef[] = [
  {
    id: "arena-1v1",
    title: "1v1 Duel",
    subtitle: "Classic Arena",
    blurb: "You vs one AI duelist. Countdown, weapon skills, fight until wipe.",
    tone: "#4fc3ff",
    badges: ["Duel", "AI skills", "arena3"],
    posterUrl: "/ui/menu/grudge-arena.png",
    kind: "duel",
    players: "2",
    objective: "Eliminate foe",
  },
  {
    id: "arena-2v2",
    title: "2v2 Team",
    subtitle: "Classic Arena",
    blurb: "You + healer ally vs two AI. Team wipe wins the round.",
    tone: "#6fffb0",
    badges: ["Team", "Heals", "AI skills"],
    posterUrl: "/ui/menu/grudge-arena.png",
    kind: "team",
    players: "4",
    objective: "Wipe enemy team",
  },
  {
    id: "arena-ffa4",
    title: "Assassination Grounds",
    subtitle: "FFA · First to 10",
    blurb:
      "Ultimate Assassination Grounds battleground. You + 3 AI explorers. First to 10 kills wins.",
    tone: "#ff6a4a",
    badges: ["FFA ×4", "First to 10", "AI explorers"],
    posterUrl: "/rooms/danger-scene.png",
    kind: "ffa",
    players: "4",
    objective: "First to 10 kills",
  },
];

export const WORLD_MAP_CARDS: MapPreviewDef[] = [
  {
    id: "danger-holo",
    title: "Holo Grid",
    subtitle: "Danger Room",
    blurb: "Classic holographic training chamber.",
    tone: "#5fe0ff",
    badges: ["Combat", "Sparring"],
    posterUrl: "/rooms/danger-scene.png",
    kind: "room",
  },
  {
    id: "sailtest",
    title: "Sailtest Isles",
    subtitle: "Camp · Sail · Harvest",
    blurb: "Dual islands near sea level — water, wind, camp, harvest.",
    tone: "#4db8ff",
    badges: ["Outdoor", "Sailing"],
    posterUrl: "/rooms/library-danger-scene.png",
    kind: "islands",
  },
  {
    id: "forest-map",
    title: "Forest Map",
    subtitle: "Harvest · Nature",
    blurb: "Dark forest base with Warlords nature and harvest scatter.",
    tone: "#5d9e3f",
    badges: ["Harvest", "Nature"],
    posterUrl: "/rooms/library-brawl-scene.png",
    kind: "forest",
  },
];

/** Draw a stylized minimap / poster into a canvas; returns data URL. */
export function renderMapMinimap(
  def: MapPreviewDef,
  size = 320,
): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const tone = def.tone;

  // Background
  const g = ctx.createRadialGradient(size * 0.5, size * 0.45, size * 0.05, size * 0.5, size * 0.5, size * 0.7);
  g.addColorStop(0, "#1a2838");
  g.addColorStop(1, "#060a12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Soft vignette
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2);
  ctx.fill();

  if (def.kind === "duel") drawDuel(ctx, size, tone);
  else if (def.kind === "team") drawTeam(ctx, size, tone);
  else if (def.kind === "ffa") drawFfa(ctx, size, tone);
  else if (def.kind === "islands") drawIslands(ctx, size, tone);
  else if (def.kind === "forest") drawForest(ctx, size, tone);
  else drawRoom(ctx, size, tone);

  // Frame
  ctx.strokeStyle = tone + "aa";
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, size - 12, size - 12);

  // Corner label strip
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, size - 36, size, 36);
  ctx.fillStyle = tone;
  ctx.font = `bold ${Math.round(size * 0.045)}px Inter, system-ui, sans-serif`;
  ctx.fillText(def.subtitle.toUpperCase(), 14, size - 14);

  return c.toDataURL("image/png");
}

function pad(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawDuel(ctx: CanvasRenderingContext2D, s: number, tone: string) {
  // Floor ring
  ctx.strokeStyle = tone + "66";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  // West / east pads
  pad(ctx, s * 0.28, s * 0.5, s * 0.055, "#4fc3ff");
  pad(ctx, s * 0.72, s * 0.5, s * 0.055, "#ff6a6a");
  // Center line
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(s / 2, s * 0.25);
  ctx.lineTo(s / 2, s * 0.75);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTeam(ctx: CanvasRenderingContext2D, s: number, tone: string) {
  ctx.strokeStyle = tone + "55";
  ctx.lineWidth = 2;
  ctx.strokeRect(s * 0.18, s * 0.22, s * 0.64, s * 0.56);
  pad(ctx, s * 0.3, s * 0.42, s * 0.04, "#4fc3ff");
  pad(ctx, s * 0.3, s * 0.58, s * 0.04, "#6fffb0");
  pad(ctx, s * 0.7, s * 0.42, s * 0.04, "#ff6a6a");
  pad(ctx, s * 0.7, s * 0.58, s * 0.04, "#ff9a4a");
}

function drawFfa(ctx: CanvasRenderingContext2D, s: number, tone: string) {
  // Rocky arena silhouette
  ctx.fillStyle = "#2a1a14";
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = s * (0.3 + (i % 3) * 0.03);
    const x = s / 2 + Math.cos(a) * r;
    const y = s / 2 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = tone + "99";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Four pads N E S W
  const pads: [number, number][] = [
    [0.5, 0.28],
    [0.72, 0.5],
    [0.5, 0.72],
    [0.28, 0.5],
  ];
  const colors = ["#4fc3ff", "#ff6a6a", "#ffc24a", "#c79bff"];
  pads.forEach(([px, py], i) => {
    pad(ctx, s * px, s * py, s * 0.04, colors[i]!);
  });
  // Kill stars
  ctx.fillStyle = "#ffd24d";
  ctx.font = `${Math.round(s * 0.08)}px serif`;
  ctx.fillText("10", s * 0.44, s * 0.54);
}

function drawRoom(ctx: CanvasRenderingContext2D, s: number, tone: string) {
  ctx.fillStyle = "#0c1420";
  ctx.fillRect(s * 0.15, s * 0.2, s * 0.7, s * 0.55);
  ctx.strokeStyle = tone;
  ctx.lineWidth = 2;
  ctx.strokeRect(s * 0.15, s * 0.2, s * 0.7, s * 0.55);
  // Grid
  ctx.strokeStyle = tone + "44";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const x = s * 0.15 + (s * 0.7 * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, s * 0.2);
    ctx.lineTo(x, s * 0.75);
    ctx.stroke();
  }
  pad(ctx, s * 0.5, s * 0.48, s * 0.05, tone);
}

function drawIslands(ctx: CanvasRenderingContext2D, s: number, tone: string) {
  // Water
  const w = ctx.createLinearGradient(0, 0, 0, s);
  w.addColorStop(0, "#0a2840");
  w.addColorStop(1, "#061820");
  ctx.fillStyle = w;
  ctx.fillRect(0, 0, s, s);
  // Islands
  ctx.fillStyle = "#3d8b37";
  ctx.beginPath();
  ctx.ellipse(s * 0.35, s * 0.45, s * 0.18, s * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.68, s * 0.55, s * 0.14, s * 0.1, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c2b280";
  ctx.beginPath();
  ctx.ellipse(s * 0.35, s * 0.48, s * 0.1, s * 0.05, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tone + "88";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s * 0.42, s * 0.48);
  ctx.quadraticCurveTo(s * 0.52, s * 0.4, s * 0.6, s * 0.52);
  ctx.stroke();
}

function drawForest(ctx: CanvasRenderingContext2D, s: number, tone: string) {
  ctx.fillStyle = "#0c140e";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 18; i++) {
    const x = ((i * 47) % s);
    const y = ((i * 73) % (s * 0.7)) + s * 0.15;
    ctx.fillStyle = i % 3 === 0 ? "#2d5a28" : "#1e3d1a";
    ctx.beginPath();
    ctx.moveTo(x, y + 20);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x + 16, y + 20);
    ctx.fill();
  }
  ctx.strokeStyle = tone + "66";
  ctx.lineWidth = 2;
  ctx.strokeRect(s * 0.2, s * 0.25, s * 0.6, s * 0.5);
  pad(ctx, s * 0.5, s * 0.55, s * 0.04, "#ffb24d");
}

const minimapCache = new Map<string, string>();

export function getMapMinimapUrl(def: MapPreviewDef, size = 320): string {
  const key = `${def.id}:${size}`;
  let hit = minimapCache.get(key);
  if (!hit) {
    if (typeof document === "undefined") return "";
    hit = renderMapMinimap(def, size);
    minimapCache.set(key, hit);
  }
  return hit;
}
