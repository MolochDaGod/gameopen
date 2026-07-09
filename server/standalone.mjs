/**
 * Zero-dependency gameopen API for Railway.
 * Native Node http + optional WebSocket upgrade.
 */
import http from "node:http";
import { URL } from "node:url";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";


const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const ASSETS_CDN = process.env.ASSETS_CDN || "https://assets.grudge-studio.com";
const GAMEOPEN_PREFIX = process.env.GAMEOPEN_ASSET_PREFIX || "gameopen";
const GRUDGE_BUILDER =
  process.env.GRUDGE_BUILDER_API ||
  "https://grudge-api-production-0d46.up.railway.app";
const OBJECTSTORE =
  process.env.OBJECTSTORE_URL ||
  "https://objectstore.grudge-studio.com/api/v1";
const GRUDGE_ID = process.env.GRUDGE_ID_URL || "https://id.grudge-studio.com";

const ALLOWED = (
  process.env.ALLOWED_ORIGINS ||
  "https://gameopen.vercel.app,https://grudges.grudge-studio.com,https://survival.grudge-studio.com,https://open.grudge-studio.com,http://localhost:5173,http://localhost:3000,http://localhost:4173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function originOk(origin) {
  if (!origin) return true;
  if (ALLOWED.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  if (origin.endsWith(".grudge-studio.com")) return true;
  if (origin.endsWith(".puter.site") || origin.endsWith(".puter.work")) return true;
  return false;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (originOk(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Cookie, X-Grudge-Id",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
  }
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

const LOCAL_EFFECTS = [
  "attack-slashes",
  "lightning",
  "fireball",
  "explosion",
  "explosive-orb",
  "energy-beam",
  "laser-beam",
  "light-beam",
  "spell-glyph",
  "chaos-glyph",
  "aoe-warning",
  "location",
  "ring-green",
  "ring-red",
  "yellow-light",
  "crystals",
  "muzzle",
  "strawberry-strike",
  "light-of-slash",
].map((id) => ({
  id,
  name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  glb: `models/vfx/${id}.glb`,
  url: `${ASSETS_CDN}/${GAMEOPEN_PREFIX}/models/vfx/${id}.glb`,
  localUrl: `/models/vfx/${id}.glb`,
}));

async function proxyJson(req, res, target) {
  const headers = { Accept: "application/json" };
  if (req.headers.authorization)
    headers.Authorization = req.headers.authorization;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers["content-type"])
    headers["Content-Type"] = req.headers["content-type"];
  if (req.headers["x-grudge-id"])
    headers["x-grudge-id"] = req.headers["x-grudge-id"];

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await readBody(req);
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.length ? body : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type":
        upstream.headers.get("content-type") || "application/json",
    });
    res.end(text);
  } catch (err) {
    json(res, 502, {
      error: "upstream_unavailable",
      target,
      message: String(err?.message || err),
    });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const rooms = new Map();

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  if (path === "/" || path === "") {
    return json(res, 200, {
      service: "gameopen-api",
      version: "1.1.0-fleet",
      health: "/api/healthz",
      effects: "/api/effects",
      content: "/api/content",
      characters: "/api/characters",
      modes: "/api/modes",
      fleet: "/api/fleet/config",
      carrier: "ws /api/carrier?room=CODE",
      hasDatabase: Boolean(process.env.DATABASE_URL),
      hasJwt: Boolean(process.env.JWT_SECRET),
    });
  }

  // ── Weapon / skill / item content catalog (SSOT: content/) ───────────────
  if (path === "/api/content" || path === "/api/content/") {
    return json(res, 200, {
      service: "gameopen-content",
      docs: [
        "content/docs/WEAPON_PREFAB.md",
        "content/docs/SKILL_PREFAB.md",
        "content/docs/ITEM_DB.md",
        "content/docs/UMMORPG_ADOPTION.md",
      ],
      endpoints: {
        weapons: "/api/content/weapons",
        weaponById: "/api/content/weapons/:id",
        skills: "/api/content/skills",
        skillById: "/api/content/skills/:id",
        items: "/api/content/items",
        armor: "/api/content/armor",
        readiness: "/api/content/readiness",
        manifests: "/api/content/manifests/:name",
      },
    });
  }

  if (path.startsWith("/api/content/")) {
    // Docker (/app/content), server-root Docker (./content), monorepo (../content)
    const contentRoot = [
      join(__dirname, "content"),
      join(__dirname, "../content"),
      "/app/content",
    ].find((p) => existsSync(p)) || join(__dirname, "content");
    const loadCollection = (name) => {
      const dir = join(contentRoot, name);
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
    };

    if (path === "/api/content/weapons") {
      const weapons = loadCollection("weapons");
      return json(res, 200, { count: weapons.length, weapons });
    }
    if (path.startsWith("/api/content/weapons/")) {
      const id = decodeURIComponent(path.slice("/api/content/weapons/".length));
      const file = join(contentRoot, "weapons", `${id}.json`);
      if (!existsSync(file)) return json(res, 404, { error: "weapon not found", id });
      return json(res, 200, JSON.parse(readFileSync(file, "utf8")));
    }
    if (path === "/api/content/skills") {
      const skills = loadCollection("skills");
      return json(res, 200, { count: skills.length, skills });
    }
    if (path.startsWith("/api/content/skills/")) {
      const id = decodeURIComponent(path.slice("/api/content/skills/".length));
      const file = join(contentRoot, "skills", `${id}.json`);
      if (!existsSync(file)) return json(res, 404, { error: "skill not found", id });
      return json(res, 200, JSON.parse(readFileSync(file, "utf8")));
    }
    if (path === "/api/content/items") {
      const items = loadCollection("items");
      return json(res, 200, { count: items.length, items });
    }
    if (path === "/api/content/armor") {
      const armor = loadCollection("armor");
      return json(res, 200, { count: armor.length, armor });
    }
    if (path === "/api/content/readiness") {
      const file = join(contentRoot, "manifests", "readiness.json");
      if (!existsSync(file)) {
        return json(res, 200, {
          version: 0,
          note: "run pnpm content:index locally",
          weapons: [],
          skills: [],
        });
      }
      return json(res, 200, JSON.parse(readFileSync(file, "utf8")));
    }
    if (path === "/api/content/scenes" || path === "/api/content/scenes/") {
      const indexFile = join(contentRoot, "scenes", "index.json");
      if (!existsSync(indexFile)) {
        return json(res, 200, {
          version: 0,
          note: "run pnpm scenes:build",
          scenes: [],
        });
      }
      return json(res, 200, JSON.parse(readFileSync(indexFile, "utf8")));
    }
    if (path.startsWith("/api/content/scenes/")) {
      const key = decodeURIComponent(
        path.slice("/api/content/scenes/".length).replace(/\.gfscene\.json$/, ""),
      );
      const file = join(contentRoot, "scenes", `${key}.gfscene.json`);
      if (!existsSync(file)) {
        return json(res, 404, { error: "scene not found", key });
      }
      // CORS * so forge.grudge-studio.com can fetch ?scene=
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=60");
      return json(res, 200, JSON.parse(readFileSync(file, "utf8")));
    }
    if (path.startsWith("/api/content/manifests/")) {
      const name = path
        .slice("/api/content/manifests/".length)
        .replace(/\.json$/, "");
      const file = join(contentRoot, "manifests", `${name}.json`);
      if (!existsSync(file)) return json(res, 404, { error: "manifest not found", name });
      return json(res, 200, JSON.parse(readFileSync(file, "utf8")));
    }
    return json(res, 404, { error: "unknown content route", path });
  }

  if (path === "/api/healthz" || path === "/healthz" || path === "/api/health") {
    return json(res, 200, {
      status: "ok",
      service: "gameopen-api",
      time: new Date().toISOString(),
    });
  }

  if (path === "/api/effects") {
    let remote = null;
    try {
      const r = await fetch(`${OBJECTSTORE}/abilityEffects.json`, {
        signal: AbortSignal.timeout(4000),
      });
      if (r.ok) remote = await r.json();
    } catch {
      /* optional */
    }
    return json(res, 200, {
      source: remote ? "objectstore+local" : "local",
      count: LOCAL_EFFECTS.length,
      effects: LOCAL_EFFECTS,
      objectStore: remote,
      cdn: ASSETS_CDN,
    });
  }

  if (path === "/api/fleet/config") {
    return json(res, 200, {
      game: "gameopen",
      title: "Grudge Open",
      services: {
        auth: GRUDGE_ID,
        gameData: GRUDGE_BUILDER,
        assets: ASSETS_CDN,
        objectStore: OBJECTSTORE,
        gameopenPrefix: GAMEOPEN_PREFIX,
      },
      races: [
        "human",
        "orc",
        "undead",
        "barbarian",
        "dwarf",
        "high_elf",
      ].map((id) => ({
        id,
        glb: `models/races/${id}.glb`,
        cdn: `${ASSETS_CDN}/${GAMEOPEN_PREFIX}/models/races/${id}.glb`,
      })),
    });
  }

  if (path === "/api/assets/catalog") {
    const candidates = [
      join(__dirname, "../client/public/asset-manifest.json"),
      join(process.cwd(), "client/public/asset-manifest.json"),
      join(process.cwd(), "asset-manifest.json"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        const data = JSON.parse(readFileSync(p, "utf8"));
        return json(res, 200, {
          ...data,
          cdnBase: `${ASSETS_CDN}/${GAMEOPEN_PREFIX}`,
        });
      }
    }
    return json(res, 200, {
      version: 1,
      count: 0,
      assets: [],
      cdnBase: `${ASSETS_CDN}/${GAMEOPEN_PREFIX}`,
    });
  }

  if (path.startsWith("/api/characters")) {
    const rest = path.slice("/api/characters".length) || "";
    const target = `${GRUDGE_BUILDER}/api/characters${rest}${url.search}`;
    return proxyJson(req, res, target);
  }

  // Fleet auth / account — proxy to Grudge ID + GrudgeBuilder
  if (path.startsWith("/api/auth")) {
    const rest = path.slice("/api/auth".length) || "";
    // Prefer GrudgeBuilder for puter/login/session; ID for /auth/*
    const toBuilder = ["/puter", "/login", "/register", "/me", "/verify", "/session"].some(
      (p) => rest === p || rest.startsWith(p + "/") || rest.startsWith(p + "?"),
    );
    if (toBuilder || rest === "/me" || rest.startsWith("/me?")) {
      const target = `${GRUDGE_BUILDER}/api/auth${rest}${url.search}`;
      return proxyJson(req, res, target);
    }
    const target = `${GRUDGE_ID}/api/auth${rest}${url.search}`;
    return proxyJson(req, res, target);
  }

  if (path.startsWith("/api/account")) {
    const rest = path.slice("/api/account".length) || "";
    const target = `${GRUDGE_BUILDER}/api/account${rest}${url.search}`;
    return proxyJson(req, res, target);
  }

  if (path.startsWith("/api/objectstore")) {
    const rest = path.slice("/api/objectstore".length) || "";
    const base = OBJECTSTORE.replace(/\/api\/v1$/, "");
    const target = `${base}${rest}${url.search}`;
    return proxyJson(req, res, target);
  }

  // Game modes + AI strategy catalog (static, for lobby/tools)
  if (path === "/api/game/modes" || path === "/api/modes") {
    return json(res, 200, {
      modes: [
        "danger-room",
        "sparring",
        "boss-rush",
        "horde",
        "duel",
        "coop-assault",
        "arena-war",
        "dungeon-crawl",
        "pirate-siege",
      ],
      strategies: [
        "aggressive-rusher",
        "cautious-duelist",
        "ranged-skirmisher",
        "support-healer",
        "tank-guard",
        "boss-phased",
        "swarm-horde",
        "flanker",
        "commander",
      ],
      fleet: {
        auth: GRUDGE_ID,
        gameData: GRUDGE_BUILDER,
        assets: ASSETS_CDN,
        objectStore: OBJECTSTORE,
      },
      hasDatabase: Boolean(process.env.DATABASE_URL),
      hasJwt: Boolean(process.env.JWT_SECRET),
    });
  }

  json(res, 404, { error: "not_found", path });
});

// Minimal WebSocket carrier (binary frame not required — text JSON relay)
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/carrier" && url.pathname !== "/api/realtime") {
    socket.destroy();
    return;
  }

  // Very small WS handshake
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = createAccept(key);
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  const roomId = url.searchParams.get("room") || "lobby";
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  const room = rooms.get(roomId);
  const client = { socket, roomId };
  room.add(client);

  sendText(socket, JSON.stringify({ t: "welcome", room: roomId, peers: room.size - 1 }));

  socket.on("data", (buf) => {
    const msg = decodeTextFrame(buf);
    if (msg == null) return;
    for (const peer of room) {
      if (peer !== client) sendText(peer.socket, msg);
    }
  });

  socket.on("close", () => {
    room.delete(client);
    if (room.size === 0) rooms.delete(roomId);
  });
  socket.on("error", () => {
    room.delete(client);
  });
});

function createAccept(key) {
  return createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
}

function sendText(socket, text) {
  const payload = Buffer.from(text);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try {
    socket.write(Buffer.concat([header, payload]));
  } catch {
    /* closed */
  }
}

function decodeTextFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  if (opcode === 0x8) return null; // close
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) {
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  let payload = buf.subarray(offset, offset + len + (masked ? 4 : 0));
  if (masked) {
    const mask = payload.subarray(0, 4);
    payload = payload.subarray(4);
    const data = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) data[i] = payload[i] ^ mask[i % 4];
    payload = data;
  }
  if (opcode !== 0x1) return null;
  return payload.toString("utf8");
}

server.listen(PORT, () => {
  console.log(
    JSON.stringify({
      msg: "gameopen-api listening",
      port: PORT,
      service: "gameopen-api",
    }),
  );
});
