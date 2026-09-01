/**
 * Danger Room multiplayer relay (zero-dep, pure Node).
 *
 * Wire protocol matches `@workspace/danger-net` so the browser DangerClient
 * talks to this process on `wss://…/api/danger` without a TypeScript build.
 *
 * Model: client-authoritative transforms + host-owned NPCs; server-authoritative
 * PvP HP with range / rate / attack-window validation.
 */
import { randomUUID } from "node:crypto";

export const WS_PATH = "/api/danger";
export const TICK_HZ = 20;
export const STATE_REPORT_MS = 50;
export const PLAYER_TIMEOUT_MS = 15_000;
export const MAX_PLAYERS = 8;
export const PERSISTENT_ROOM_MAX_PLAYERS = 4;
export const PVP_MAX_HP = 100;
export const PVP_HIT_MAX_DAMAGE = 200;
export const PVP_HIT_MAX_RANGE = 30;
export const PVP_HIT_MIN_INTERVAL_MS = 90;
export const PVP_ATTACK_WINDOW_MS = 900;
export const PVP_RESPAWN_MS = 3500;
export const MAX_MOVE_SPEED = 60;
export const PVP_AVOID_COOLDOWN_MS = 450;

/** Always-on official lobbies — never reaped when empty. */
export const PERSISTENT_ROOMS = [
  {
    code: "DANGER",
    name: "Danger Room",
    mode: "coop",
    preset: "holo",
    maxPlayers: PERSISTENT_ROOM_MAX_PLAYERS,
  },
  {
    code: "ARENA",
    name: "Colosseum",
    mode: "pvp",
    preset: "colosseum",
    maxPlayers: PERSISTENT_ROOM_MAX_PLAYERS,
  },
];

const DEFAULT_SNAPSHOT = {
  px: 0,
  py: 0,
  pz: 0,
  ry: 0,
  clip: "idle",
  weapon: "none",
  hp: PVP_MAX_HP,
  moving: false,
  grounded: true,
  guard: "open",
};

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clampCoord(n) {
  if (n > 1e6) return 1e6;
  if (n < -1e6) return -1e6;
  return n;
}

function sanitizeGuard(raw) {
  return raw === "block" || raw === "parry" || raw === "dodge" ? raw : "open";
}

function sanitizeSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  const s = raw;
  return {
    px: clampCoord(finite(s.px)),
    py: clampCoord(finite(s.py)),
    pz: clampCoord(finite(s.pz)),
    ry: finite(s.ry),
    clip: typeof s.clip === "string" ? s.clip.slice(0, 64) : "idle",
    weapon: typeof s.weapon === "string" ? s.weapon.slice(0, 32) : "none",
    hp: finite(s.hp, 100),
    moving: !!s.moving,
    grounded: s.grounded === undefined ? true : !!s.grounded,
    guard: sanitizeGuard(s.guard),
  };
}

function sanitizeNpcs(raw, max = 64) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (out.length >= max) break;
    if (!item || typeof item !== "object") continue;
    if (typeof item.id !== "string") continue;
    out.push({
      id: item.id.slice(0, 64),
      archetype: typeof item.archetype === "string" ? item.archetype.slice(0, 64) : "dummy",
      weapon: typeof item.weapon === "string" ? item.weapon.slice(0, 32) : "none",
      px: clampCoord(finite(item.px)),
      py: clampCoord(finite(item.py)),
      pz: clampCoord(finite(item.pz)),
      ry: finite(item.ry),
      clip: typeof item.clip === "string" ? item.clip.slice(0, 64) : "idle",
      hp: finite(item.hp, 100),
      maxHp: finite(item.maxHp, 100),
      alive: item.alive === undefined ? true : !!item.alive,
    });
  }
  return out;
}

function sanitizeCombat(raw, from) {
  if (!raw || typeof raw !== "object") return null;
  switch (raw.k) {
    case "attack":
      return {
        k: "attack",
        from,
        action: typeof raw.action === "string" ? raw.action.slice(0, 64) : "attack",
      };
    case "death":
      return { k: "death", from };
    case "respawn":
      return { k: "respawn", from };
    case "hit": {
      if (typeof raw.to !== "string") return null;
      const amount = finite(raw.amount, 0);
      if (amount <= 0 || amount > 10000) return null;
      return {
        k: "hit",
        from,
        to: raw.to.slice(0, 64),
        target: raw.target === "npc" ? "npc" : "player",
        amount,
      };
    }
    default:
      return null;
  }
}

function clampMove(prev, next, dt) {
  const maxDist = MAX_MOVE_SPEED * Math.max(dt, 1 / 30);
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dz = next.z - prev.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist <= maxDist || dist < 1e-6) return next;
  const k = maxDist / dist;
  return {
    x: prev.x + dx * k,
    y: prev.y + dy * k,
    z: prev.z + dz * k,
  };
}

function clampDamage(amount) {
  const n = finite(amount, 0);
  if (n <= 0) return 0;
  return n > PVP_HIT_MAX_DAMAGE ? PVP_HIT_MAX_DAMAGE : n;
}

function resolvePvpDamage(amount, guard, canAvoid) {
  const base = clampDamage(amount);
  if (guard === "parry" || guard === "dodge") {
    if (canAvoid) return { applied: 0, outcome: "avoid" };
    return { applied: Math.round(base), outcome: "hit" };
  }
  if (guard === "block") {
    return { applied: Math.round(base * 0.35), outcome: "block" };
  }
  return { applied: Math.round(base), outcome: "hit" };
}

function encode(msg) {
  return JSON.stringify(msg);
}

function decodeClient(raw) {
  try {
    const m = JSON.parse(raw);
    if (m && typeof m === "object" && typeof m.t === "string") return m;
  } catch {
    /* drop */
  }
  return null;
}

class DangerRoom {
  constructor(opts) {
    this.code = opts.code;
    this.name = opts.name;
    this.mode = opts.mode === "pvp" ? "pvp" : "coop";
    this.visibility = opts.visibility === "private" ? "private" : "public";
    this.content = opts.content || { kind: "arena", name: opts.name };
    this.hostId = null;
    this.persistent = !!opts.persistent;
    this.maxPlayers = opts.maxPlayers || MAX_PLAYERS;
    this.players = new Map();
    this.npcs = [];
  }

  get playerCount() {
    return this.players.size;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  isFull() {
    return this.players.size >= this.maxPlayers;
  }

  info() {
    const host = this.hostId ? this.players.get(this.hostId) : undefined;
    return {
      code: this.code,
      name: this.name,
      mode: this.mode,
      content: this.content,
      players: this.players.size,
      maxPlayers: this.maxPlayers,
      hostName: host?.name ?? "—",
      persistent: this.persistent,
    };
  }

  playerState(p) {
    const hp = this.mode === "pvp" ? p.hp : p.snap.hp;
    return {
      ...p.snap,
      hp,
      id: p.id,
      name: p.name,
      host: p.id === this.hostId,
      alive: this.mode === "pvp" ? p.alive : hp > 0,
    };
  }

  roster() {
    return [...this.players.values()].map((p) => this.playerState(p));
  }

  broadcast(data, exceptId) {
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue;
      try {
        p.send(data);
      } catch {
        /* dead socket reaped on close */
      }
    }
  }

  addPlayer(id, name, send) {
    const now = Date.now();
    const player = {
      id,
      name: (name || "Player").slice(0, 32),
      send,
      snap: { ...DEFAULT_SNAPSHOT },
      alive: true,
      lastSeen: now,
      hp: PVP_MAX_HP,
      lastPos: {
        x: DEFAULT_SNAPSHOT.px,
        y: DEFAULT_SNAPSHOT.py,
        z: DEFAULT_SNAPSHOT.pz,
      },
      lastStateAt: now,
      lastAttackAt: 0,
      lastHitAt: 0,
      lastAvoidAt: 0,
      respawnAt: 0,
    };
    if (this.hostId === null) this.hostId = id;
    this.players.set(id, player);
    send(
      encode({
        t: "welcome",
        self: id,
        code: this.code,
        mode: this.mode,
        content: this.content,
        hostId: this.hostId,
        players: this.roster(),
        tickHz: TICK_HZ,
      }),
    );
    this.broadcast(encode({ t: "joined", player: this.playerState(player) }), id);
  }

  setState(id, raw) {
    const p = this.players.get(id);
    if (!p) return;
    const snap = sanitizeSnapshot(raw);
    if (!snap) return;
    const now = Date.now();
    const dt = (now - p.lastStateAt) / 1000;
    const clamped = clampMove(
      p.lastPos,
      { x: snap.px, y: snap.py, z: snap.pz },
      dt,
    );
    snap.px = clamped.x;
    snap.py = clamped.y;
    snap.pz = clamped.z;
    if (this.mode === "pvp") {
      snap.hp = p.hp;
    } else {
      p.hp = snap.hp;
      p.alive = snap.hp > 0;
    }
    p.snap = snap;
    p.lastPos = clamped;
    p.lastStateAt = now;
    p.lastSeen = now;
  }

  setNpcs(id, raw) {
    const p = this.players.get(id);
    if (!p) return;
    p.lastSeen = Date.now();
    if (id !== this.hostId) return;
    this.npcs = sanitizeNpcs(raw);
    this.broadcast(encode({ t: "npcs", npcs: this.npcs }));
  }

  setPreset(id, raw) {
    const p = this.players.get(id);
    if (!p) return;
    p.lastSeen = Date.now();
    if (id !== this.hostId) return;
    if (typeof raw !== "string" || raw.length === 0 || raw.length > 64) return;
    this.content = { ...this.content, preset: raw };
    this.broadcast(encode({ t: "preset", preset: raw }), id);
  }

  handleCombat(id, raw) {
    const p = this.players.get(id);
    if (!p) return;
    const now = Date.now();
    p.lastSeen = now;
    const ev = sanitizeCombat(raw, id);
    if (!ev) return;
    this.relayCombat(p, ev, now);
  }

  relayCombat(from, ev, now) {
    switch (ev.k) {
      case "attack":
        from.lastAttackAt = now;
        this.broadcast(encode({ t: "combat", ev }), ev.from);
        return;
      case "death":
      case "respawn":
        this.broadcast(encode({ t: "combat", ev }), ev.from);
        return;
      case "hit": {
        if (ev.target === "npc") {
          const host = this.hostId ? this.players.get(this.hostId) : undefined;
          if (host && host.id !== ev.from) host.send(encode({ t: "combat", ev }));
          return;
        }
        if (this.mode !== "pvp") return;
        this.resolvePvpHit(from, ev.to, ev.amount, now);
        return;
      }
    }
  }

  resolvePvpHit(attacker, victimId, amount, now) {
    const victim = this.players.get(victimId);
    if (!victim || victim.id === attacker.id) return;
    if (!attacker.alive || !victim.alive) return;
    if (now - attacker.lastAttackAt > PVP_ATTACK_WINDOW_MS) return;
    if (now - attacker.lastHitAt < PVP_HIT_MIN_INTERVAL_MS) return;
    const dx = victim.lastPos.x - attacker.lastPos.x;
    const dy = victim.lastPos.y - attacker.lastPos.y;
    const dz = victim.lastPos.z - attacker.lastPos.z;
    if (dx * dx + dy * dy + dz * dz > PVP_HIT_MAX_RANGE * PVP_HIT_MAX_RANGE) return;
    const canAvoid = now - victim.lastAvoidAt >= PVP_AVOID_COOLDOWN_MS;
    const { applied, outcome } = resolvePvpDamage(amount, victim.snap.guard, canAvoid);
    attacker.lastHitAt = now;
    if (outcome === "avoid") victim.lastAvoidAt = now;
    if (applied > 0) {
      victim.hp = Math.max(0, victim.hp - applied);
      victim.snap.hp = victim.hp;
    }
    this.broadcast(
      encode({
        t: "combat",
        ev: {
          k: "hit",
          from: attacker.id,
          to: victim.id,
          target: "player",
          amount: applied,
          outcome,
        },
      }),
    );
    if (victim.hp <= 0 && victim.alive) {
      victim.alive = false;
      victim.respawnAt = now + PVP_RESPAWN_MS;
      this.broadcast(encode({ t: "combat", ev: { k: "death", from: victim.id } }));
    }
  }

  remove(id) {
    if (!this.players.delete(id)) return;
    this.broadcast(encode({ t: "left", id }));
    if (this.hostId === id) {
      const next = this.players.keys().next();
      this.hostId = next.done ? null : next.value;
      if (this.hostId) this.broadcast(encode({ t: "host", id: this.hostId }));
    }
  }

  tick(now) {
    for (const [id, p] of this.players) {
      if (now - p.lastSeen > PLAYER_TIMEOUT_MS) this.remove(id);
    }
    if (this.mode === "pvp") {
      for (const p of this.players.values()) {
        if (!p.alive && p.respawnAt > 0 && now >= p.respawnAt) {
          p.hp = PVP_MAX_HP;
          p.snap.hp = PVP_MAX_HP;
          p.alive = true;
          p.respawnAt = 0;
          this.broadcast(encode({ t: "combat", ev: { k: "respawn", from: p.id } }));
        }
      }
    }
    if (this.players.size === 0) return;
    this.broadcast(encode({ t: "snapshot", time: now, players: this.roster() }));
  }
}

class DangerRoomManager {
  constructor() {
    this.rooms = new Map();
    this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
    if (typeof this.timer.unref === "function") this.timer.unref();
    this.seedPersistent();
  }

  seedPersistent() {
    for (const spec of PERSISTENT_ROOMS) {
      if (this.rooms.has(spec.code)) continue;
      const room = new DangerRoom({
        code: spec.code,
        name: spec.name,
        mode: spec.mode,
        visibility: "public",
        content: {
          kind: "arena",
          name: spec.name,
          preset: spec.preset,
        },
        persistent: true,
        maxPlayers: spec.maxPlayers,
      });
      this.rooms.set(spec.code, room);
    }
  }

  newCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < 5; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return `R${Date.now().toString(36).toUpperCase()}`;
  }

  createRoom(opts) {
    const code = this.newCode();
    const room = new DangerRoom({ code, ...opts, persistent: false });
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(String(code || "").toUpperCase());
  }

  deleteRoomIfEmpty(code) {
    const room = this.rooms.get(code);
    if (room && room.isEmpty() && !room.persistent) this.rooms.delete(code);
  }

  publicRooms() {
    // Always list persistent lobbies (even empty) + occupied public ad-hoc rooms.
    return [...this.rooms.values()]
      .filter((r) => r.visibility === "public" && (r.persistent || !r.isEmpty()))
      .map((r) => r.info());
  }

  tick() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      room.tick(now);
      if (room.isEmpty() && !room.persistent) this.rooms.delete(code);
    }
    // Re-seed if something wiped persistent rooms.
    this.seedPersistent();
  }
}

/**
 * Attach Danger Room WS to an http.Server using a minimal native handshake
 * (no `ws` package — Railway Dockerfile is zero-dep).
 */
export function attachDangerRelay(server, { createAccept, decodeTextFrame, sendText }) {
  const manager = new DangerRoomManager();

  server.on("upgrade", (req, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(req.url || "/", "http://localhost").pathname;
    } catch {
      pathname = req.url || "";
    }
    if (pathname !== WS_PATH) return; // leave carrier / other paths alone

    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    // Consume any leftover head (we don't need subprotocols).
    if (head && head.length) {
      /* ignored — clients send nothing before first frame after open */
    }

    try {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${createAccept(key)}\r\n\r\n`,
      );
    } catch {
      socket.destroy();
      return;
    }

    const conn = {
      id: randomUUID(),
      room: null,
      send: (data) => {
        try {
          sendText(socket, data);
        } catch {
          /* closing */
        }
      },
    };

    const leaveRoom = () => {
      if (!conn.room) return;
      const code = conn.room.code;
      conn.room.remove(conn.id);
      manager.deleteRoomIfEmpty(code);
      conn.room = null;
    };

    socket.on("data", (buf) => {
      const msgRaw = decodeTextFrame(buf);
      if (msgRaw == null) return;
      // Client may coalesce frames; handle one JSON message per decode.
      const msg = decodeClient(msgRaw);
      if (!msg) return;

      switch (msg.t) {
        case "list":
          conn.send(encode({ t: "rooms", rooms: manager.publicRooms() }));
          return;
        case "create": {
          leaveRoom();
          const room = manager.createRoom({
            name: (msg.name || "Danger Room").slice(0, 60),
            mode: msg.mode === "pvp" ? "pvp" : "coop",
            visibility: msg.visibility === "private" ? "private" : "public",
            content: msg.content || { kind: "arena", name: msg.name || "Danger Room" },
          });
          room.addPlayer(conn.id, msg.player, conn.send);
          conn.room = room;
          return;
        }
        case "join": {
          const room = manager.getRoom(msg.code ?? "");
          if (!room) {
            conn.send(encode({ t: "error", code: "not_found", message: "Room not found" }));
            return;
          }
          if (room.isFull()) {
            conn.send(encode({ t: "error", code: "room_full", message: "Room is full" }));
            return;
          }
          leaveRoom();
          room.addPlayer(conn.id, msg.player, conn.send);
          conn.room = room;
          return;
        }
        case "leave":
          leaveRoom();
          return;
        case "state":
          conn.room?.setState(conn.id, msg.snap);
          return;
        case "combat":
          conn.room?.handleCombat(conn.id, msg.ev);
          return;
        case "npcs":
          conn.room?.setNpcs(conn.id, msg.npcs);
          return;
        case "preset":
          conn.room?.setPreset(conn.id, msg.preset);
          return;
      }
    });

    socket.on("close", leaveRoom);
    socket.on("error", leaveRoom);
    socket.on("end", leaveRoom);
  });

  return manager;
}
