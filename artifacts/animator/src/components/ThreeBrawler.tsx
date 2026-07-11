/**
 * ThreeBrawler — React wrapper around the 3D BrawlerScene.
 *
 * Replaces the 2D canvas RuinsBrawler.tsx with a full Three.js 3D session.
 * Mounts/disposes BrawlerScene via useEffect; mirrors the same CSS-in-JS
 * palette and HUD structure as the original component.
 */
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BrawlerScene, type BrawlerState } from "../three/brawler/BrawlerScene";
import { getStoredToken } from "../lib/grudgeAuth";
import { gameSession } from "../game/GameSession";

interface Props {
  onExit: () => void;
}

const DEFAULT_STATE: BrawlerState = {
  phase: "loading",
  playerHp: 150,
  playerMaxHp: 150,
  playerArmor: 30,
  ammo: 60,
  credits: 0,
  kills: 0,
  weaponName: "Sword",
  connected: false,
  playerCount: 1,
  inSafeZone: false,
  wave: 1,
};

export function ThreeBrawler({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BrawlerScene | null>(null);
  const [state, setState] = useState<BrawlerState>(DEFAULT_STATE);
  const [locked, setLocked] = useState(false);

  // Derive player identity from fleet account / character for future BrawlClient auth.
  // BrawlerScene does not yet accept playerName in its constructor — when BrawlClient
  // is upgraded to send authenticated presence, pass `grudgeToken` and `playerName` via
  // a scene.setIdentity(token, name) method.
  // getStoredToken() is available here for that wiring.
  const grudgeToken = getStoredToken();
  const playerName =
    gameSession.selectedCharacter()?.name ||
    gameSession.snapshot.account?.displayName ||
    gameSession.snapshot.account?.grudgeId ||
    "Open Player";
  void grudgeToken; // referenced above — will be consumed by future BrawlClient auth
  void playerName;  // will be passed to BrawlerScene once constructor supports it

  // Mount / dispose the 3D scene.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new BrawlerScene(canvas, (s) => setState(s));
    sceneRef.current = scene;

    const onLockChange = () =>
      setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const sc = sceneRef.current;

  return (
    <div style={rootStyle}>
      {/* 3D canvas */}
      <canvas ref={canvasRef} style={canvasStyle} />

      {/* Top-right bar */}
      <div style={topbarStyle}>
        <span style={brandStyle}>
          RUINS<span style={brandAccentStyle}>BRAWLER</span>
        </span>
        <span style={{ fontSize: 12, opacity: 0.85, color: "#cfe0fa" }}>
          {state.connected
            ? `● live · ${state.playerCount} in room`
            : "○ offline · local AI"}
        </span>
        <button type="button" style={btnStyle} onClick={onExit}>
          ⮐ Doors
        </button>
      </div>

      {/* Wave counter — top centre */}
      <div style={waveBadgeStyle}>WAVE {state.wave}</div>

      {/* HUD — bottom left */}
      {state.phase !== "loading" && (
        <div style={hudStyle}>
          <span>
            HP{" "}
            <span
              style={{
                color:
                  state.playerHp < state.playerMaxHp * 0.25
                    ? "#ff5a5a"
                    : "#7ee0a0",
              }}
            >
              {Math.max(0, state.playerHp)}/{state.playerMaxHp}
            </span>
          </span>
          <span>ARM {state.playerArmor}</span>
          <span>AMMO {state.ammo}</span>
          <span>◈ {state.credits}</span>
          <span>KILLS {state.kills}</span>
          <span style={{ color: "#4fc3ff" }}>{state.weaponName}</span>
        </div>
      )}

      {/* Shop overlay — bottom centre, only in safe zone */}
      {state.inSafeZone && state.phase === "playing" && (
        <div style={shopStyle}>
          <span style={{ opacity: 0.8, fontSize: 12, color: "#7ee0a0" }}>
            ✦ Safe Zone — shop:
          </span>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 20}
            title="Refill 30 ammo"
            onClick={() => sc?.buyAmmoRefill()}
          >
            Ammo +30 · 20◈
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 40}
            title="Boost armor by 20"
            onClick={() => sc?.buyArmor()}
          >
            Armor +20 · 40◈
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 80}
            title="Restore 30 HP"
            onClick={() => sc?.buyMaxHpUp()}
          >
            Heal +30HP · 80◈
          </button>
        </div>
      )}

      {/* Hint bar — bottom right */}
      <div style={hintStyle}>
        {locked
          ? "WASD move · mouse aim · LMB attack · Shift dash · 1-4 weapons · Space jump"
          : "Click to lock pointer · WASD move · LMB attack"}
      </div>

      {/* Loading overlay */}
      {state.phase === "loading" && (
        <div style={overlayStyle}>
          <div style={overlayBoxStyle}>
            <div style={overlayTitleStyle}>RUINS BRAWLER</div>
            <div style={{ opacity: 0.7, fontSize: 14 }}>Loading arena…</div>
            <div style={spinnerStyle} />
          </div>
        </div>
      )}

      {/* Death screen */}
      {state.phase === "dead" && (
        <div style={overlayStyle}>
          <div style={overlayBoxStyle}>
            <div style={{ ...overlayTitleStyle, color: "#ff5a5a" }}>
              ELIMINATED
            </div>
            <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 18 }}>
              Kills: {state.kills} · Wave: {state.wave} · Credits: {state.credits}◈
            </div>
            <button
              type="button"
              style={respawnBtnStyle}
              onClick={() => sc?.respawn()}
            >
              RESPAWN
            </button>
            <button
              type="button"
              style={{ ...btnStyle, marginTop: 8 }}
              onClick={onExit}
            >
              ⮐ Back to Doors
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles (CSS-in-JS, matching RuinsBrawler.tsx palette) ────────────────────
const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0a0e17",
};
const canvasStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  cursor: "crosshair",
};
const topbarStyle: CSSProperties = {
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
const brandStyle: CSSProperties = {
  fontWeight: 700,
  letterSpacing: 2,
  fontSize: 15,
  color: "#eaf4ff",
};
const brandAccentStyle: CSSProperties = {
  color: "#4fc3ff",
};
const waveBadgeStyle: CSSProperties = {
  position: "fixed",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  fontWeight: 700,
  letterSpacing: 3,
  fontSize: 13,
  color: "#4fc3ff",
  background: "rgba(7,11,20,0.8)",
  border: "1px solid rgba(79,195,255,0.28)",
  borderRadius: 8,
  padding: "4px 14px",
  zIndex: 20,
};
const hudStyle: CSSProperties = {
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
const shopStyle: CSSProperties = {
  position: "fixed",
  bottom: 60,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  maxWidth: "min(560px, 92vw)",
  padding: "10px 14px",
  borderRadius: 10,
  background: "rgba(7,11,20,0.92)",
  border: "1px solid rgba(126,224,160,0.38)",
  zIndex: 20,
};
const hintStyle: CSSProperties = {
  position: "fixed",
  bottom: 12,
  right: 12,
  fontSize: 11,
  opacity: 0.55,
  color: "#cfe0fa",
  zIndex: 20,
};
const btnStyle: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.35)",
  background: "rgba(7,11,20,0.6)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "5px 10px",
  cursor: "pointer",
  fontSize: 12,
};
const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(7,11,20,0.82)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 40,
};
const overlayBoxStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  padding: "36px 48px",
  borderRadius: 16,
  background: "rgba(7,11,20,0.96)",
  border: "1px solid rgba(79,195,255,0.28)",
  color: "#eaf4ff",
  fontFamily: "Inter, system-ui, sans-serif",
};
const overlayTitleStyle: CSSProperties = {
  fontWeight: 800,
  letterSpacing: 4,
  fontSize: 24,
  color: "#4fc3ff",
  marginBottom: 8,
};
const respawnBtnStyle: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.7)",
  background: "rgba(79,195,255,0.12)",
  color: "#4fc3ff",
  borderRadius: 10,
  padding: "10px 28px",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 2,
};
const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: "3px solid rgba(79,195,255,0.2)",
  borderTop: "3px solid #4fc3ff",
  borderRadius: "50%",
  animation: "spin 0.9s linear infinite",
  marginTop: 16,
};
