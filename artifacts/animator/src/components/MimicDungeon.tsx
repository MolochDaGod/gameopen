import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  MimicDungeon as MimicDungeonScene,
  type MimicDungeonState,
} from "../three/mimic/MimicDungeon";
import type { HudSnapshot, SlotBinding, WeaponId } from "../three/types";
import { CraftpixCombatHud } from "./hud/CraftpixCombatHud";
import "./hud/craftpixHud.css";

const INITIAL: MimicDungeonState = {
  phase: "loading",
  prompt: null,
  hint: "Loading volcano + Toon play kit…",
  playerHp: 100,
  playerMaxHp: 100,
  mimicHp: 120,
  mimicMaxHp: 120,
  telegraph: null,
  skills: [],
  loadNote: "Booting…",
};

/**
 * Build a Danger Room–compatible HudSnapshot so CraftpixCombatHud works
 * without the full Studio controller.
 */
function mimicHudSnapshot(s: MimicDungeonState): HudSnapshot {
  const sk = s.skills;
  const s0 = sk[0];
  const s1 = sk[1];
  const s2 = sk[2];
  const s3 = sk[3];
  const slots: SlotBinding[] = [
    {
      slot: "primary",
      key: s0?.key ?? "LMB",
      label: s0?.label ?? "Strike",
      clip: "attack",
      custom: false,
      iconUrl: s0?.iconUrl,
      icon: "attack",
    },
    {
      slot: "fskill",
      key: "F",
      label: "Skill",
      clip: "attack",
      custom: false,
      icon: "skill",
    },
    {
      slot: "sig1",
      key: s0?.key ?? "1",
      label: s0?.label ?? "Skill 1",
      clip: "attack",
      custom: false,
      iconUrl: s0?.iconUrl,
    },
    {
      slot: "sig2",
      key: s1?.key ?? "2",
      label: s1?.label ?? "Skill 2",
      clip: "attack",
      custom: false,
      iconUrl: s1?.iconUrl,
    },
    {
      slot: "sig3",
      key: s2?.key ?? "3",
      label: s2?.label ?? "Skill 3",
      clip: "attack",
      custom: false,
      iconUrl: s2?.iconUrl,
    },
    {
      slot: "sig4",
      key: s3?.key ?? "4",
      label: s3?.label ?? "Skill 4",
      clip: "attack",
      custom: false,
      iconUrl: s3?.iconUrl,
    },
  ];

  const weapon: WeaponId = "sword";
  return {
    character: "Hero",
    weapon,
    weaponLabel: "Sword",
    skillName: s0?.label ?? "Strike",
    level: 1,
    health: s.playerHp,
    maxHealth: s.playerMaxHp,
    stamina: 100,
    maxStamina: 100,
    poise: 100,
    maxPoise: 100,
    combatState: s.phase === "defeat" ? "dead" : "idle",
    critWindow: 0,
    combatFlash: "",
    enemyHealth: s.mimicHp,
    enemyMaxHealth: s.mimicMaxHp,
    enemyStamina: 100,
    enemyMaxStamina: 100,
    enemyPoise: 100,
    enemyMaxPoise: 100,
    enemyCritWindow: 0,
    enemyCombatState: s.phase === "windup" || s.phase === "strike" ? "attack" : "idle",
    skillReady: (s0?.cd ?? 0) <= 0,
    skillCooldown: s0?.cd ?? 0,
    skillCooldownMax: s0?.cdMax ?? 1,
    skyfallCooldown: 0,
    skyfallCooldownMax: 0,
    sigCooldowns: [s0?.cd ?? 0, s1?.cd ?? 0, s2?.cd ?? 0, s3?.cd ?? 0],
    sigCooldownMaxes: [s0?.cdMax ?? 1, s1?.cdMax ?? 1, s2?.cdMax ?? 1, s3?.cdMax ?? 1],
    hovering: false,
    locked: false,
    firstPerson: false,
    aimSpread: 4,
    owrRange: "none",
    hitMarker: 0,
    grounded: true,
    jumpsLeft: 1,
    speed: 0,
    fps: 60,
    targetsAlive: s.mimicHp > 0 ? 1 : 0,
    difficulty: "normal" as HudSnapshot["difficulty"],
    blocking: false,
    activityMode: "combat",
    activityTool: "sword",
    radialOpen: false,
    radialKind: "none",
    hurt: 0,
    defeated: s.phase === "defeat",
    selectedTarget:
      s.phase !== "loading" && s.mimicHp > 0
        ? {
            x: window.innerWidth * 0.5,
            y: 72,
            health: s.mimicHp,
            maxHealth: s.mimicMaxHp,
            name: "Mimic",
          }
        : null,
    selectedAllyTarget: null,
    zone: null,
    boss:
      s.phase !== "loading"
        ? {
            name: "Mimic",
            health: s.mimicHp,
            maxHealth: s.mimicMaxHp,
            hint: s.telegraph
              ? s.telegraph === "acid"
                ? "ACID — MOVE!"
                : "MELEE LUNGE!"
              : "E: Open Barrel · 1–4 skills",
          }
        : null,
    clip: "idle",
    slots,
    statuses: [],
    prompt: s.prompt,
    inDungeon: true,
    mech: null,
  };
}

/**
 * Test Dungeon (Mimic): volcano scene + mimic asset + Craftpix combat HUD
 * (same Danger Room language). Lightweight overlays for telegraph / win-lose.
 */
export function MimicDungeon({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<MimicDungeonScene | null>(null);
  const [s, setS] = useState<MimicDungeonState>(INITIAL);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: MimicDungeonScene | null = null;
    try {
      scene = new MimicDungeonScene(canvas, setS);
      sceneRef.current = scene;
    } catch (err) {
      console.warn("[MimicDungeon] init failed", err);
    }
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const hud = useMemo(() => mimicHudSnapshot(s), [s]);
  const over = s.phase === "victory" || s.phase === "defeat";

  return (
    <div style={wrap} data-surface="mimic-dungeon">
      <canvas ref={canvasRef} style={canvasStyle} />

      <button type="button" style={exitBtn} onClick={onExit}>
        ⬑ Doors
      </button>

      {/* Boss strip — Mimic HP (Craftpix combat bar is player vitals) */}
      {s.phase !== "loading" && (
        <div style={bossStrip} aria-label="Mimic health">
          <span style={bossName}>MIMIC</span>
          <div style={bossTrack}>
            <div
              style={{
                ...bossFill,
                width: `${Math.max(0, Math.min(100, (s.mimicHp / Math.max(1, s.mimicMaxHp)) * 100))}%`,
              }}
            />
          </div>
          <span style={bossHp}>
            {Math.round(s.mimicHp)}/{s.mimicMaxHp}
          </span>
        </div>
      )}

      {s.telegraph && (
        <div style={{ ...telegraph, color: s.telegraph === "acid" ? "#9cff5a" : "#ff8a5a" }}>
          {s.telegraph === "acid" ? "◆ ACID INCOMING — MOVE!" : "◆ MELEE LUNGE!"}
        </div>
      )}

      {over && (
        <div style={banner}>{s.phase === "victory" ? "MIMIC SLAIN" : "DEVOURED"}</div>
      )}

      {s.prompt && (
        <button type="button" style={prompt} onClick={() => sceneRef.current?.interact()}>
          {s.prompt}
        </button>
      )}

      {/* Danger Room Craftpix combat HUD — HP globe + skill bar (full-screen overlay) */}
      <CraftpixCombatHud hud={hud} />

      <div style={hint}>
        {s.hint}
        {s.loadNote ? ` · ${s.loadNote}` : ""}
      </div>
    </div>
  );
}

const wrap: CSSProperties = { position: "fixed", inset: 0, background: "#05060a", userSelect: "none" };
const canvasStyle: CSSProperties = { width: "100%", height: "100%", display: "block" };
const exitBtn: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 16,
  zIndex: 5,
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid rgba(79,195,255,0.4)",
  background: "rgba(7,11,20,0.7)",
  color: "#eaf4ff",
  cursor: "pointer",
  fontSize: 13,
};
const bossStrip: CSSProperties = {
  position: "absolute",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 5,
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 320,
  maxWidth: "70vw",
  padding: "8px 14px",
  borderRadius: 10,
  background: "rgba(12,6,4,0.78)",
  border: "1px solid rgba(255,120,60,0.45)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
};
const bossName: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 2,
  color: "#ffb07a",
};
const bossTrack: CSSProperties = {
  flex: 1,
  height: 14,
  borderRadius: 7,
  background: "rgba(255,255,255,0.1)",
  overflow: "hidden",
};
const bossFill: CSSProperties = {
  height: "100%",
  borderRadius: 7,
  background: "linear-gradient(90deg,#5a1a08,#e85a20)",
  transition: "width 0.15s linear",
};
const bossHp: CSSProperties = { fontSize: 11, color: "#ffd8c0", fontWeight: 700, minWidth: 52 };
const telegraph: CSSProperties = {
  position: "absolute",
  top: 64,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 6,
  fontWeight: 900,
  letterSpacing: 2,
  fontSize: 20,
  textShadow: "0 2px 12px rgba(0,0,0,0.8)",
};
const banner: CSSProperties = {
  position: "absolute",
  top: "42%",
  left: "50%",
  transform: "translate(-50%,-50%)",
  zIndex: 7,
  fontWeight: 900,
  letterSpacing: 4,
  fontSize: 46,
  color: "#eaf4ff",
  textShadow: "0 4px 24px rgba(0,0,0,0.9)",
};
const prompt: CSSProperties = {
  position: "absolute",
  bottom: 148,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 6,
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid rgba(124,255,58,0.5)",
  background: "rgba(10,20,8,0.8)",
  color: "#d8ffc4",
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: 1,
  cursor: "pointer",
};
const hint: CSSProperties = {
  position: "absolute",
  bottom: 8,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 5,
  fontSize: 12,
  color: "#9fb8da",
  textAlign: "center",
  pointerEvents: "none",
  maxWidth: "90vw",
};
