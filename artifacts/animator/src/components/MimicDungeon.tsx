import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  MimicDungeon as MimicDungeonScene,
  type MimicDungeonState,
} from "../three/mimic/MimicDungeon";

const INITIAL: MimicDungeonState = {
  phase: "loading",
  prompt: null,
  hint: "Loading test dungeon…",
  playerHp: 100,
  playerMaxHp: 100,
  mimicHp: 120,
  mimicMaxHp: 120,
  telegraph: null,
};

const pct = (v: number, m: number) => `${Math.max(0, Math.min(100, (v / Math.max(1, m)) * 100))}%`;

/**
 * Test Dungeon (Mimic) surface: owns the WebGL encounter scene and overlays a
 * lightweight HUD (health bars, the shared "E: Open Barrel" prompt, an incoming
 * attack telegraph, and the win/lose banner). Input (WASD / LMB / E) is handled
 * inside the scene; the on-screen prompt also forwards an interact for touch.
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

  const over = s.phase === "victory" || s.phase === "defeat";

  return (
    <div style={wrap}>
      <canvas ref={canvasRef} style={canvasStyle} />

      <button type="button" style={exitBtn} onClick={onExit}>
        ⬑ Doors
      </button>

      <div style={bars}>
        <Bar label="Player" value={pct(s.playerHp, s.playerMaxHp)} color="#4f9bff" />
        <Bar label="Mimic" value={pct(s.mimicHp, s.mimicMaxHp)} color="#7cff3a" />
      </div>

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

      <div style={hint}>{s.hint}</div>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 54, fontSize: 12, color: "#cfe0fa", fontWeight: 700 }}>{label}</span>
      <div style={track}>
        <div style={{ ...fill, width: value, background: color }} />
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
const bars: CSSProperties = {
  position: "absolute",
  top: 14,
  left: 16,
  zIndex: 5,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(7,11,20,0.62)",
  border: "1px solid rgba(79,195,255,0.22)",
  minWidth: 240,
};
const track: CSSProperties = {
  flex: 1,
  height: 12,
  borderRadius: 6,
  background: "rgba(255,255,255,0.12)",
  overflow: "hidden",
};
const fill: CSSProperties = { height: "100%", borderRadius: 6, transition: "width 0.15s linear" };
const telegraph: CSSProperties = {
  position: "absolute",
  top: 84,
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
  bottom: 84,
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
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 5,
  fontSize: 13,
  color: "#9fb8da",
  textAlign: "center",
  pointerEvents: "none",
};
