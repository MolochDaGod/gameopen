/**
 * ThreeBrawler — React shell for the 3D Ruins Brawler.
 *
 * Full combat HUD:
 *  • Top bar: brand, live status, exit
 *  • Character panel: name / class / weapon
 *  • Vitals: HP + armor bars
 *  • Skill bar 1–4 with cooldown sweeps
 *  • Equipment strip (weapon cycle)
 *  • Safe-zone shop
 *  • Pointer-lock hints
 */
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import {
  BrawlerScene,
  type BrawlerState,
  type BrawlerSkillSlot,
} from "../three/brawler/BrawlerScene";
import { gameSession } from "../game/GameSession";
import { bakedIndexFor } from "../three/grudge/bakedRoster";
import { resolveRaceModel } from "../lib/raceModel";

interface Props {
  onExit: () => void;
}

const EMPTY_SKILLS: BrawlerSkillSlot[] = [1, 2, 3, 4].map((slot) => ({
  slot: slot as 1 | 2 | 3 | 4,
  label: `Skill ${slot}`,
  key: String(slot),
  cd: 0,
  cdMax: 1,
  ready: true,
}));

const DEFAULT_STATE: BrawlerState = {
  phase: "loading",
  playerHp: 150,
  playerMaxHp: 150,
  playerArmor: 30,
  ammo: 60,
  credits: 0,
  kills: 0,
  weaponName: "Sword",
  weaponId: "sword",
  characterName: "Brawler",
  characterClass: "Fighter",
  connected: false,
  playerCount: 1,
  inSafeZone: false,
  wave: 1,
  skills: EMPTY_SKILLS,
  moving: false,
  loadError: null,
  focusLocked: false,
  hasTarget: false,
  targetHp: 0,
  targetMaxHp: 0,
};

const WEAPONS = [
  { id: "sword", label: "Sword", icon: "⚔" },
  { id: "axe", label: "Axe", icon: "🪓" },
  { id: "dagger", label: "Dagger", icon: "🗡" },
  { id: "bow", label: "Bow", icon: "🏹" },
] as const;

export function ThreeBrawler({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BrawlerScene | null>(null);
  const [state, setState] = useState<BrawlerState>(DEFAULT_STATE);
  const [locked, setLocked] = useState(false);

  const fleetChar = gameSession.selectedCharacter();
  const displayName =
    fleetChar?.name ||
    gameSession.snapshot.account?.displayName ||
    gameSession.snapshot.account?.grudgeId ||
    "Open Player";
  const characterClass = fleetChar?.classId || fleetChar?.raceId || "Fighter";
  const resolved = resolveRaceModel(fleetChar);
  const rosterIndex = bakedIndexFor(resolved.raceId, resolved.presetId);

  // Prefer animated combat GLBs over static baked roster.
  const preferredAvatarId =
    /mage|wizard|shaman/i.test(characterClass) ? "karate-boss" :
    /orc|brute|barb/i.test(String(fleetChar?.raceId || "")) ? "orc" :
    /kick|striker|monk/i.test(characterClass) ? "sanji" :
    "karate-boss";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new BrawlerScene(canvas, (s) => setState(s), {
      displayName,
      characterClass: String(characterClass),
      preferredAvatarId,
      rosterIndex,
    });
    sceneRef.current = scene;

    const onLockChange = () => setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      scene.dispose();
      sceneRef.current = null;
    };
    // Mount once per brawler entry — identity is read at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cast = useCallback((slot: 1 | 2 | 3 | 4) => {
    sceneRef.current?.castSkill(slot);
  }, []);

  const setWeapon = useCallback((index: number) => {
    sceneRef.current?.setWeapon(index);
  }, []);

  const hpPct = Math.max(0, Math.min(100, (state.playerHp / state.playerMaxHp) * 100));
  const armorPct = Math.max(0, Math.min(100, (state.playerArmor / 80) * 100));

  return (
    <div style={rootStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      {/* Top bar */}
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

      {/* Wave */}
      <div style={waveBadgeStyle}>WAVE {state.wave}</div>

      {/* Character / equipment panel — top left */}
      {state.phase !== "loading" && (
        <div style={charPanelStyle}>
          <div style={charNameStyle}>{state.characterName}</div>
          <div style={charSubStyle}>
            {state.characterClass} · {state.weaponName}
          </div>
          <div style={equipRowStyle}>
            {WEAPONS.map((w, i) => {
              const active = state.weaponId === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  title={`${w.label} (key ${i + 1})`}
                  style={{
                    ...equipBtnStyle,
                    borderColor: active ? "rgba(79,195,255,0.7)" : "rgba(79,195,255,0.2)",
                    background: active ? "rgba(79,195,255,0.16)" : "rgba(7,11,20,0.55)",
                    color: active ? "#8ec3ff" : "#cfe0fa",
                  }}
                  onClick={() => setWeapon(i)}
                >
                  <span style={{ fontSize: 16 }}>{w.icon}</span>
                  <span style={{ fontSize: 10 }}>{i + 1}</span>
                </button>
              );
            })}
          </div>
          <div style={statRowStyle}>
            <span>◈ {state.credits}</span>
            <span>KILLS {state.kills}</span>
            <span>AMMO {state.ammo}</span>
          </div>
          {state.loadError && (
            <div style={{ fontSize: 10, color: "#f0c040", marginTop: 6, opacity: 0.9 }}>
              {state.loadError}
            </div>
          )}
        </div>
      )}

      {/* Vitals — bottom left */}
      {state.phase !== "loading" && (
        <div style={vitalsStyle}>
          <div style={vitalLabelStyle}>HP</div>
          <div style={trackStyle}>
            <div
              style={{
                ...fillStyle,
                width: `${hpPct}%`,
                background:
                  hpPct < 25
                    ? "linear-gradient(90deg,#ff3b3b,#ff7a7a)"
                    : "linear-gradient(90deg,#1f9a5a,#7ee0a0)",
              }}
            />
            <span style={vitalNumStyle}>
              {state.playerHp}/{state.playerMaxHp}
            </span>
          </div>
          <div style={vitalLabelStyle}>ARM</div>
          <div style={trackStyle}>
            <div
              style={{
                ...fillStyle,
                width: `${armorPct}%`,
                background: "linear-gradient(90deg,#3a6ab0,#8ec3ff)",
              }}
            />
            <span style={vitalNumStyle}>{state.playerArmor}</span>
          </div>
        </div>
      )}

      {/* Skill bar — bottom centre */}
      {state.phase === "playing" && (
        <div style={skillBarStyle}>
          {(state.skills.length ? state.skills : EMPTY_SKILLS).map((sk) => {
            const frac =
              sk.cdMax > 0 && sk.cd > 0 ? Math.min(1, sk.cd / sk.cdMax) : 0;
            return (
              <button
                key={sk.slot}
                type="button"
                title={`${sk.label} · key ${sk.key} / ${["Q", "E", "R", "F"][sk.slot - 1]}`}
                style={{
                  ...skillSlotStyle,
                  opacity: sk.ready ? 1 : 0.75,
                  borderColor: sk.ready
                    ? "rgba(79,195,255,0.55)"
                    : "rgba(79,195,255,0.2)",
                }}
                onClick={() => cast(sk.slot)}
              >
                <div style={skillKeyStyle}>{sk.key}</div>
                <div style={skillLabelStyle}>{sk.label}</div>
                {frac > 0 && (
                  <div
                    style={{
                      ...skillCdStyle,
                      background: `conic-gradient(rgba(4,10,20,0.82) ${frac * 360}deg, transparent 0deg)`,
                    }}
                  />
                )}
                {frac > 0 && (
                  <div style={skillCdNumStyle}>{sk.cd.toFixed(1)}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Crosshair — brighter when focus-locked (Danger Room parity) */}
      {locked && state.phase === "playing" && (
        <div
          style={{
            ...crosshairStyle,
            borderColor: state.focusLocked
              ? state.hasTarget
                ? "rgba(255,106,74,0.95)"
                : "rgba(255,200,80,0.85)"
              : "rgba(207,224,250,0.55)",
            boxShadow: state.focusLocked
              ? "0 0 12px rgba(255,106,74,0.55)"
              : "none",
          }}
        />
      )}

      {/* Focus / target readout */}
      {state.phase === "playing" && state.focusLocked && (
        <div style={focusBadgeStyle}>
          {state.hasTarget ? (
            <>
              <span style={{ color: "#ff8a6a", fontWeight: 700 }}>FOCUS LOCK</span>
              <span style={{ opacity: 0.85 }}>
                HP {state.targetHp}/{state.targetMaxHp}
              </span>
            </>
          ) : (
            <span style={{ color: "#ffd080" }}>FOCUS · no target in range</span>
          )}
        </div>
      )}

      {/* Shop */}
      {state.inSafeZone && state.phase === "playing" && (
        <div style={shopStyle}>
          <span style={{ opacity: 0.8, fontSize: 12, color: "#7ee0a0" }}>
            ✦ Safe Zone — shop:
          </span>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 20}
            onClick={() => sceneRef.current?.buyAmmoRefill()}
          >
            Ammo +30 · 20◈
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 40}
            onClick={() => sceneRef.current?.buyArmor()}
          >
            Armor +20 · 40◈
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 80}
            onClick={() => sceneRef.current?.buyMaxHpUp()}
          >
            Heal +30HP · 80◈
          </button>
        </div>
      )}

      {/* Hints */}
      <div style={hintStyle}>
        {locked
          ? "WASD · LMB attack · RMB / Tab focus lock · 1-4 skills · QERF · Shift dash · Space jump"
          : "Click canvas to lock pointer · then fight (RMB = focus lock)"}
      </div>

      {/* Loading */}
      {state.phase === "loading" && (
        <div style={overlayStyle}>
          <div style={overlayBoxStyle}>
            <div style={overlayTitleStyle}>RUINS BRAWLER</div>
            <div style={{ opacity: 0.7, fontSize: 14 }}>
              Loading combat avatar + arena…
            </div>
            <div style={{ opacity: 0.55, fontSize: 12, marginTop: 6 }}>
              {displayName} · {preferredAvatarId}
            </div>
            <div style={spinnerStyle} />
          </div>
        </div>
      )}

      {/* Death */}
      {state.phase === "dead" && (
        <div style={overlayStyle}>
          <div style={overlayBoxStyle}>
            <div style={{ ...overlayTitleStyle, color: "#ff5a5a" }}>ELIMINATED</div>
            <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 18 }}>
              Kills: {state.kills} · Wave: {state.wave} · Credits: {state.credits}◈
            </div>
            <button
              type="button"
              style={respawnBtnStyle}
              onClick={() => sceneRef.current?.respawn()}
            >
              RESPAWN
            </button>
            <button type="button" style={{ ...btnStyle, marginTop: 8 }} onClick={onExit}>
              ⮐ Back to Doors
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0a0e17",
  fontFamily: "Inter, system-ui, sans-serif",
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
  background: "rgba(7,11,20,0.88)",
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
const brandAccentStyle: CSSProperties = { color: "#4fc3ff" };
const waveBadgeStyle: CSSProperties = {
  position: "fixed",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  fontWeight: 700,
  letterSpacing: 3,
  fontSize: 13,
  color: "#4fc3ff",
  background: "rgba(7,11,20,0.85)",
  border: "1px solid rgba(79,195,255,0.28)",
  borderRadius: 8,
  padding: "4px 14px",
  zIndex: 20,
};
const charPanelStyle: CSSProperties = {
  position: "fixed",
  top: 12,
  left: 12,
  minWidth: 200,
  maxWidth: 260,
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(7,11,20,0.9)",
  border: "1px solid rgba(79,195,255,0.28)",
  color: "#eaf4ff",
  zIndex: 20,
};
const charNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  letterSpacing: 0.5,
  color: "#8ec3ff",
};
const charSubStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.75,
  marginTop: 2,
  marginBottom: 10,
  textTransform: "capitalize",
};
const equipRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 8,
};
const equipBtnStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "6px 4px",
  borderRadius: 8,
  border: "1px solid",
  cursor: "pointer",
  background: "transparent",
};
const statRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  fontSize: 11,
  opacity: 0.9,
  flexWrap: "wrap",
};
const vitalsStyle: CSSProperties = {
  position: "fixed",
  bottom: 88,
  left: 12,
  width: 220,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(7,11,20,0.9)",
  border: "1px solid rgba(79,195,255,0.22)",
  zIndex: 20,
};
const vitalLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  opacity: 0.7,
  color: "#cfe0fa",
};
const trackStyle: CSSProperties = {
  position: "relative",
  height: 16,
  borderRadius: 6,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
  marginBottom: 4,
};
const fillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 6,
  transition: "width 0.15s linear",
};
const vitalNumStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  fontWeight: 700,
  color: "#fff",
  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
};
const skillBarStyle: CSSProperties = {
  position: "fixed",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(7,11,20,0.92)",
  border: "1px solid rgba(79,195,255,0.3)",
  zIndex: 25,
};
const skillSlotStyle: CSSProperties = {
  position: "relative",
  width: 72,
  height: 72,
  borderRadius: 12,
  border: "1px solid rgba(79,195,255,0.4)",
  background: "linear-gradient(180deg,rgba(30,45,80,0.9),rgba(10,16,28,0.95))",
  color: "#eaf4ff",
  cursor: "pointer",
  overflow: "hidden",
  padding: 0,
};
const skillKeyStyle: CSSProperties = {
  position: "absolute",
  top: 4,
  left: 6,
  fontSize: 11,
  fontWeight: 800,
  color: "#4fc3ff",
};
const skillLabelStyle: CSSProperties = {
  position: "absolute",
  bottom: 6,
  left: 4,
  right: 4,
  fontSize: 10,
  fontWeight: 600,
  textAlign: "center",
  lineHeight: 1.15,
};
const skillCdStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};
const skillCdNumStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
  textShadow: "0 1px 3px #000",
  pointerEvents: "none",
};
const crosshairStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  top: "50%",
  width: 10,
  height: 10,
  marginLeft: -5,
  marginTop: -5,
  border: "1.5px solid rgba(232,244,255,0.85)",
  borderRadius: "50%",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
  pointerEvents: "none",
  zIndex: 15,
};
const focusBadgeStyle: CSSProperties = {
  position: "fixed",
  top: 48,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "6px 14px",
  borderRadius: 8,
  background: "rgba(20,8,8,0.88)",
  border: "1px solid rgba(255,106,74,0.45)",
  color: "#ffe0d0",
  fontSize: 12,
  letterSpacing: 0.4,
  zIndex: 20,
  pointerEvents: "none",
};
const shopStyle: CSSProperties = {
  position: "fixed",
  bottom: 100,
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
  maxWidth: 280,
  fontSize: 11,
  opacity: 0.55,
  color: "#cfe0fa",
  zIndex: 20,
  textAlign: "right",
  lineHeight: 1.35,
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
