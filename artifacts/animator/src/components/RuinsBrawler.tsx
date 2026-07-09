/**
 * Native in-gameopen Ruins Brawler — the concrete "realtime on GRUDOX" surface.
 *
 * Connects straight to the shared GRUDOX zone room `/api/brawl` via
 * {@link ../net/BrawlClient.BrawlClient} and the vendored `@workspace/brawl-net`
 * sim. The authoritative server owns the simulation; this client renders its
 * snapshots on a top-down 2D canvas, regenerates the identical static world from
 * the welcome seed, and streams local input (WASD move, mouse aim, LMB fire,
 * Shift dash, 1-4 weapon select) back each tick. Safe-zone shop purchases are
 * sent when the player stands in a sanctuary.
 *
 * It is intentionally engine-light (no three.js): the brawler is a top-down
 * twin-stick game, so a 2D canvas is the faithful, low-risk renderer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PLAYER,
  PROJECTILE,
  SHOP,
  SHOP_ORDER,
  TICK_HZ,
  WEAPONS,
  WORLD,
  ZOMBIE,
  generateWorld,
  type BrawlWorld,
  type PlayerInput,
  type PlayerState,
  type ShopItemId,
} from "@workspace/brawl-net";
import { BrawlClient, type BrawlSnapshot } from "../net/BrawlClient";
import { gameSession } from "../game/GameSession";

interface Props {
  /** Leave the brawler and return to the door select. */
  onExit: () => void;
}

/** Pixels drawn per world unit (the arena half-extent is WORLD.half). */
const PX_PER_UNIT = 6;

export function RuinsBrawler({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<BrawlClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [self, setSelf] = useState<PlayerState | null>(null);
  const [playerCount, setPlayerCount] = useState(0);

  const playerName = useMemo(() => {
    const s = gameSession.snapshot;
    return (
      gameSession.selectedCharacter()?.name ||
      s.account?.displayName ||
      s.account?.grudgeId ||
      "Open Player"
    );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const client = new BrawlClient();
    clientRef.current = client;
    let world: BrawlWorld | null = null;
    let snapshot: BrawlSnapshot | null = null;
    let selfId = "";
    let seq = 0;
    let raf = 0;
    let lastSend = 0;
    let disposed = false;

    // Local input state, sampled into a PlayerInput each tick.
    const keys = new Set<string>();
    let mouseX = 0;
    let mouseZ = 0;
    let firing = false;
    let weapon = 0;

    const offOpen = client.on("open", () => setConnected(true));
    const offClose = client.on("close", () => setConnected(false));
    const offWelcome = client.on("welcome", (w) => {
      selfId = w.self;
      world = generateWorld(w.seed);
      setJoined(true);
    });
    const offSnap = client.on("snapshot", (s) => {
      snapshot = s;
      const me = s.players.find((p) => p.id === selfId) ?? null;
      setSelf(me);
      setPlayerCount(s.players.length);
      if (me) weapon = me.weapon;
    });

    client.connect();
    client.join(playerName);

    // ── input listeners ────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      keys.add(e.code);
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5)) - 1;
        if (n >= 0 && n < WEAPONS.length) weapon = n;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const rectAim = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const me = snapshot?.players.find((p) => p.id === selfId);
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      // Screen delta → world delta (inverse of the render transform).
      const dx = (clientX - rect.left - cx) / PX_PER_UNIT;
      const dz = (clientY - rect.top - cy) / PX_PER_UNIT;
      mouseX = (me?.px ?? 0) + dx;
      mouseZ = (me?.pz ?? 0) + dz;
    };
    const onMouseMove = (e: MouseEvent) => rectAim(e.clientX, e.clientY);
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) firing = true;
      rectAim(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) firing = false;
    };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── send loop + render loop ────────────────────────────────────────────
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);

      const me = snapshot?.players.find((p) => p.id === selfId) ?? null;

      // Sample + send input at the sim tick rate.
      if (now - lastSend >= 1000 / TICK_HZ) {
        const moveX = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
        const moveZ = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
        const cmd: PlayerInput = {
          seq: ++seq,
          dt: (now - lastSend) / 1000,
          moveX,
          moveZ,
          aimX: me ? mouseX - me.px : 0,
          aimZ: me ? mouseZ - me.pz : 1,
          fire: firing,
          dash: keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("Space"),
          weapon,
        };
        client.sendInput(cmd);
        lastSend = now;
      }

      render(ctx, canvas, world, snapshot, selfId);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      offOpen();
      offClose();
      offWelcome();
      offSnap();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      client.dispose();
      clientRef.current = null;
    };
  }, [playerName]);

  const buy = (item: ShopItemId) => clientRef.current?.buy(item);

  return (
    <div className="brawler" style={rootStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      <div style={topbarStyle}>
        <span className="brand">
          RUINS<span className="brand-accent">BRAWLER</span>
        </span>
        <span style={{ fontSize: 12, opacity: 0.85 }}>
          {connected ? (joined ? `● live · ${playerCount} in room` : "● joining…") : "○ connecting to GRUDOX…"}
        </span>
        <button type="button" style={btnStyle} onClick={onExit}>
          ⮐ Doors
        </button>
      </div>

      {self && (
        <div style={hudStyle}>
          <span>HP {Math.max(0, Math.round(self.hp))}/{self.maxHp}</span>
          <span>ARM {Math.round(self.armor)}</span>
          <span>AMMO {self.ammo}</span>
          <span>◈ {self.credits}</span>
          <span>KILLS {self.kills}</span>
          <span>{WEAPONS[self.weapon]?.name ?? "Pistol"}</span>
        </div>
      )}

      {self?.safe && (
        <div style={shopStyle}>
          <span style={{ opacity: 0.8, fontSize: 12 }}>Safe zone — shop:</span>
          {SHOP_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              style={btnStyle}
              title={SHOP[id].blurb}
              disabled={(self.credits ?? 0) < SHOP[id].cost}
              onClick={() => buy(id)}
            >
              {SHOP[id].label} · {SHOP[id].cost}◈
            </button>
          ))}
        </div>
      )}

      <div style={hintStyle}>
        WASD move · mouse aim · LMB fire · Shift/Space dash · 1-4 weapons
      </div>
    </div>
  );
}

/** Draw the world + entities, camera-centered on the local player. */
function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: BrawlWorld | null,
  snap: BrawlSnapshot | null,
  selfId: string,
): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a0e17";
  ctx.fillRect(0, 0, w, h);
  if (!world) return;

  const me = snap?.players.find((p) => p.id === selfId) ?? null;
  const camX = me?.px ?? 0;
  const camZ = me?.pz ?? 0;
  const sx = (x: number) => w / 2 + (x - camX) * PX_PER_UNIT;
  const sz = (z: number) => h / 2 + (z - camZ) * PX_PER_UNIT;

  // Arena bounds.
  ctx.strokeStyle = "rgba(79,195,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    sx(-WORLD.half),
    sz(-WORLD.half),
    WORLD.half * 2 * PX_PER_UNIT,
    WORLD.half * 2 * PX_PER_UNIT,
  );

  // Safe zones.
  for (const zone of world.safeZones) {
    ctx.beginPath();
    ctx.arc(sx(zone.px), sz(zone.pz), zone.radius * PX_PER_UNIT, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(126,224,160,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(126,224,160,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Obstacles (ruins).
  ctx.fillStyle = "#2a3550";
  for (const o of world.obstacles) {
    ctx.fillRect(
      sx(o.px - o.hw),
      sz(o.pz - o.hd),
      o.hw * 2 * PX_PER_UNIT,
      o.hd * 2 * PX_PER_UNIT,
    );
  }

  if (!snap) return;

  // Loot.
  for (const l of snap.loot) {
    ctx.beginPath();
    ctx.arc(sx(l.px), sz(l.pz), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = l.kind === 0 ? "#00ccff" : "#ffcc44";
    ctx.fill();
  }

  // Zombies.
  for (const z of snap.zombies) {
    ctx.beginPath();
    ctx.arc(sx(z.px), sz(z.pz), ZOMBIE.radius * PX_PER_UNIT, 0, Math.PI * 2);
    ctx.fillStyle = "#6a8f4a";
    ctx.fill();
  }

  // Projectiles.
  for (const pr of snap.projectiles) {
    const col = WEAPONS[pr.weapon]?.color ?? 0xffffff;
    ctx.beginPath();
    ctx.arc(sx(pr.px), sz(pr.pz), PROJECTILE.radius * PX_PER_UNIT, 0, Math.PI * 2);
    ctx.fillStyle = `#${col.toString(16).padStart(6, "0")}`;
    ctx.fill();
  }

  // Players (self highlighted, aim line drawn).
  for (const p of snap.players) {
    const isSelf = p.id === selfId;
    ctx.beginPath();
    ctx.arc(sx(p.px), sz(p.pz), PLAYER.radius * PX_PER_UNIT, 0, Math.PI * 2);
    ctx.fillStyle = !p.alive ? "#553" : isSelf ? "#4fc3ff" : "#c98bff";
    ctx.fill();
    if (p.alive) {
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx(p.px), sz(p.pz));
      ctx.lineTo(
        sx(p.px + p.ax * (PLAYER.radius + 1.5)),
        sz(p.pz + p.az * (PLAYER.radius + 1.5)),
      );
      ctx.stroke();
    }
    // Name + HP bar.
    ctx.fillStyle = "#cfe0fa";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name, sx(p.px), sz(p.pz) - PLAYER.radius * PX_PER_UNIT - 6);
  }
}

const rootStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0a0e17",
};
const canvasStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  cursor: "crosshair",
};
const topbarStyle: React.CSSProperties = {
  position: "fixed",
  top: 8,
  right: 8,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "6px 10px",
  borderRadius: 10,
  background: "rgba(7,11,20,0.85)",
  border: "1px solid rgba(79,195,255,0.22)",
  color: "#cfe0fa",
  zIndex: 20,
};
const hudStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 12,
  left: 12,
  display: "flex",
  gap: 14,
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(7,11,20,0.85)",
  border: "1px solid rgba(79,195,255,0.22)",
  color: "#eaf4ff",
  fontSize: 13,
  fontFamily: "Inter, system-ui, sans-serif",
  zIndex: 20,
};
const shopStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 60,
  left: 12,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  maxWidth: "min(560px, 92vw)",
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(7,11,20,0.9)",
  border: "1px solid rgba(126,224,160,0.35)",
  zIndex: 20,
};
const hintStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 12,
  right: 12,
  fontSize: 11,
  opacity: 0.6,
  color: "#cfe0fa",
  zIndex: 20,
};
const btnStyle: React.CSSProperties = {
  border: "1px solid rgba(79,195,255,0.35)",
  background: "rgba(7,11,20,0.6)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "5px 10px",
  cursor: "pointer",
  fontSize: 12,
};
