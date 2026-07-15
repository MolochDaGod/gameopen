/**
 * ThreeBrawler — React shell for Ruins Brawler / Agama Survival.
 *
 * Full Danger Room combat stack surface:
 *  • Fleet character → grudge6 avatar + class kit
 *  • Arsenal weapons (mountWeaponModel) + T0 skill kits
 *  • Content API / ObjectStore skill labels + pack icons
 *  • Vitals, skill bar, equipment strip, safe-zone shop
 */
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrawlerScene,
  type BrawlerSceneOptions,
  type BrawlerState,
  type BrawlerSkillSlot,
} from "../three/brawler/BrawlerScene";
import {
  resolveBrawlerLoadout,
  weaponStripEntries,
} from "../three/brawler/combatLoadout";
import { gameSession } from "../game/GameSession";
import { resolveSlotIconUrl } from "../three/skillIcons";
import type { WeaponId } from "../three/types";

export type BrawlerVariant = "brawl" | "survival";

interface Props {
  onExit: () => void;
  /** Which open surface is hosting this shell. */
  variant?: BrawlerVariant;
}

/** Map + spawn presets per hub surface. */
const VARIANT_PRESETS: Record<
  BrawlerVariant,
  {
    brand: string;
    brandAccent: string;
    mapPath: string;
    sceneOpts: Partial<BrawlerSceneOptions>;
  }
> = {
  brawl: {
    brand: "RUINS",
    brandAccent: "BRAWLER",
    mapPath: "models/arena-war-zone.glb",
    sceneOpts: {},
  },
  survival: {
    brand: "AGAMA",
    brandAccent: "SURVIVAL",
    mapPath: "models/agama-map.glb",
    sceneOpts: {
      maxEnemies: 16,
      spawnInterval: 3.2,
      initialSpawnCount: 6,
      safeZoneRadius: 8,
      spawnRadius: 36,
    },
  },
};

const EMPTY_SKILLS: BrawlerSkillSlot[] = [1, 2, 3, 4].map((slot) => ({
  slot: slot as 1 | 2 | 3 | 4,
  label: `Skill ${slot}`,
  key: String(slot),
  cd: 0,
  cdMax: 1,
  ready: true,
  iconUrl: resolveSlotIconUrl(
    (`sig${slot}` as "sig1" | "sig2" | "sig3" | "sig4"),
    "sword",
  ),
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
  avatarId: "explorer",
  weaponCycle: [],
};

export function ThreeBrawler({ onExit, variant = "brawl" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BrawlerScene | null>(null);
  const [state, setState] = useState<BrawlerState>(DEFAULT_STATE);
  const [locked, setLocked] = useState(false);
  const preset = VARIANT_PRESETS[variant] ?? VARIANT_PRESETS.brawl;

  // Live fleet → Danger Room loadout (recompute when session updates)
  const loadout = useMemo(() => resolveBrawlerLoadout(), []);
  const [sessionTick, setSessionTick] = useState(0);
  useEffect(() => {
    return gameSession.subscribe(() => setSessionTick((n) => n + 1));
  }, []);
  const liveLoadout = useMemo(
    () => resolveBrawlerLoadout(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionTick],
  );
  const kit = sessionTick > 0 ? liveLoadout : loadout;

  const weaponStrip = useMemo(() => {
    const cycle = (state.weaponCycle.length
      ? state.weaponCycle
      : weaponStripEntries().map((w) => w.id)) as WeaponId[];
    return weaponStripEntries(cycle);
  }, [state.weaponCycle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new BrawlerScene(canvas, (s) => setState(s), {
      displayName: kit.displayName,
      characterClass: kit.characterClass,
      characterId: kit.avatarId,
      preferredAvatarId: kit.avatarId,
      weaponId: kit.weaponId,
      offHand: kit.offHand,
      atk: kit.atk,
      maxHp: kit.maxHp,
      mapPath: preset.mapPath,
      ...preset.sceneOpts,
    });
    sceneRef.current = scene;

    const onLockChange = () => setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      scene.dispose();
      sceneRef.current = null;
    };
    // Mount once per surface entry — identity + map read at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const cast = useCallback((slot: 1 | 2 | 3 | 4) => {
    sceneRef.current?.castSkill(slot);
  }, []);

  const setWeaponId = useCallback((id: WeaponId) => {
    sceneRef.current?.setWeaponId(id);
  }, []);

  const hpPct = Math.max(0, Math.min(100, (state.playerHp / state.playerMaxHp) * 100));
  const armorPct = Math.max(0, Math.min(100, (state.playerArmor / 80) * 100));

  return (
    <div style={rootStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      {/* Top bar */}
      <div style={topbarStyle}>
        <span style={brandStyle}>
          {preset.brand}
          <span style={brandAccentStyle}>{preset.brandAccent}</span>
        </span>
        <span style={{ fontSize: 12, opacity: 0.85, color: "#cfe0fa" }}>
          {state.connected
            ? `● live · ${state.playerCount} in room`
            : "○ offline · local AI"}
          {kit.authenticated ? " · fleet" : " · guest"}
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
          <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 6, color: "#9ab" }}>
            {state.avatarId}
          </div>
          <div style={equipRowStyle}>
            {weaponStrip.map((w) => {
              const active = state.weaponId === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  title={`${w.label} · [ ] to cycle`}
                  style={{
                    ...equipBtnStyle,
                    borderColor: active ? "rgba(79,195,255,0.7)" : "rgba(79,195,255,0.2)",
                    background: active ? "rgba(79,195,255,0.16)" : "rgba(7,11,20,0.55)",
                    color: active ? "#8ec3ff" : "#cfe0fa",
                  }}
                  onClick={() => setWeaponId(w.id)}
                >
                  <img
                    src={w.iconUrl}
                    alt=""
                    width={18}
                    height={18}
                    style={{ objectFit: "contain", imageRendering: "pixelated" }}
                    draggable={false}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span style={{ fontSize: 9, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {w.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={statRowStyle}>
            <span>◈ {state.credits}</span>
            <span>KILLS {state.kills}</span>
            <span>AMMO {state.ammo}</span>
            <span>ATK {kit.atk}</span>
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

      {/* Skill bar — bottom centre (T0 kit + content labels) */}
      {state.phase === "playing" && (
        <div style={skillBarStyle}>
          {(state.skills.length ? state.skills : EMPTY_SKILLS).map((sk) => {
            const frac =
              sk.cdMax > 0 && sk.cd > 0 ? Math.min(1, sk.cd / sk.cdMax) : 0;
            const icon =
              sk.iconUrl ||
              resolveSlotIconUrl(
                (`sig${sk.slot}` as "sig1" | "sig2" | "sig3" | "sig4"),
                (state.weaponId as WeaponId) || "sword",
              );
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
                <img
                  src={icon}
                  alt=""
                  width={28}
                  height={28}
                  style={{
                    objectFit: "contain",
                    imageRendering: "pixelated",
                    filter: sk.ready ? "none" : "grayscale(0.6)",
                  }}
                  draggable={false}
                />
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

      {/* Crosshair */}
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
            Ammo +30 (20)
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 40}
            onClick={() => sceneRef.current?.buyArmor()}
          >
            Armor +20 (40)
          </button>
          <button
            type="button"
            style={btnStyle}
            disabled={state.credits < 80}
            onClick={() => sceneRef.current?.buyMaxHpUp()}
          >
            Max HP +25 (80)
          </button>
        </div>
      )}

      {/* Dead */}
      {state.phase === "dead" && (
        <div style={deadStyle}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>DOWNED</div>
          <div style={{ opacity: 0.8, marginBottom: 12 }}>
            Wave {state.wave} · {state.kills} kills
          </div>
          <button
            type="button"
            style={{ ...btnStyle, padding: "10px 20px", fontSize: 14 }}
            onClick={() => sceneRef.current?.respawn()}
          >
            Respawn
          </button>
        </div>
      )}

      {/* Loading */}
      {state.phase === "loading" && (
        <div style={loadStyle}>
          Loading {preset.brand} {preset.brandAccent}…
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
            {kit.avatarId} · {kit.weaponId}
          </div>
        </div>
      )}

      {/* Hints */}
      {state.phase === "playing" && !locked && (
        <div style={hintStyle}>Click to lock · WASD · 1–4 skills · [ ] weapons · RMB focus</div>
      )}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "#05070c",
  overflow: "hidden",
  fontFamily: "system-ui,Segoe UI,sans-serif",
  color: "#e8f0ff",
  userSelect: "none",
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
  position: "absolute",
  top: 12,
  left: 12,
  right: 12,
  display: "flex",
  alignItems: "center",
  gap: 14,
  zIndex: 5,
  pointerEvents: "none",
};

const brandStyle: CSSProperties = {
  fontWeight: 800,
  letterSpacing: 2,
  fontSize: 15,
  pointerEvents: "auto",
};

const brandAccentStyle: CSSProperties = {
  color: "#4fc3ff",
  marginLeft: 4,
};

const btnStyle: CSSProperties = {
  pointerEvents: "auto",
  background: "rgba(10,16,28,0.72)",
  border: "1px solid rgba(79,195,255,0.35)",
  color: "#cfe0fa",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 12,
  marginLeft: "auto",
};

const waveBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 52,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 4,
  fontWeight: 800,
  letterSpacing: 3,
  fontSize: 13,
  color: "#ffd24d",
  textShadow: "0 0 12px rgba(255,210,77,0.45)",
  pointerEvents: "none",
};

const charPanelStyle: CSSProperties = {
  position: "absolute",
  top: 52,
  left: 12,
  zIndex: 5,
  minWidth: 220,
  maxWidth: 340,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(6,10,18,0.78)",
  border: "1px solid rgba(79,195,255,0.22)",
  backdropFilter: "blur(8px)",
};

const charNameStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 0.4,
};

const charSubStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.75,
  marginBottom: 8,
  color: "#9ec0e8",
};

const equipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 8,
  maxHeight: 120,
  overflowY: "auto",
};

const equipBtnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "4px 6px",
  borderRadius: 8,
  border: "1px solid",
  cursor: "pointer",
  minWidth: 48,
};

const statRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  fontSize: 11,
  opacity: 0.85,
  color: "#b8d4f0",
};

const vitalsStyle: CSSProperties = {
  position: "absolute",
  left: 12,
  bottom: 88,
  zIndex: 5,
  width: 220,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const vitalLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  opacity: 0.7,
};

const trackStyle: CSSProperties = {
  position: "relative",
  height: 16,
  borderRadius: 6,
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const fillStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 5,
  transition: "width 0.12s linear",
};

const vitalNumStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  fontWeight: 700,
  textShadow: "0 1px 2px #000",
};

const skillBarStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 18,
  transform: "translateX(-50%)",
  display: "flex",
  gap: 10,
  zIndex: 5,
};

const skillSlotStyle: CSSProperties = {
  position: "relative",
  width: 72,
  height: 78,
  borderRadius: 12,
  border: "1px solid",
  background: "rgba(6,12,22,0.82)",
  color: "#d8e8ff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  paddingTop: 4,
};

const skillKeyStyle: CSSProperties = {
  position: "absolute",
  top: 4,
  left: 6,
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.7,
};

const skillLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  textAlign: "center",
  lineHeight: 1.15,
  maxWidth: 64,
  padding: "0 2px",
};

const skillCdStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 11,
  pointerEvents: "none",
};

const skillCdNumStyle: CSSProperties = {
  position: "absolute",
  bottom: 4,
  right: 6,
  fontSize: 10,
  fontWeight: 700,
  color: "#9cf",
};

const crosshairStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: 14,
  height: 14,
  marginLeft: -7,
  marginTop: -7,
  border: "2px solid",
  borderRadius: "50%",
  pointerEvents: "none",
  zIndex: 3,
};

const focusBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 78,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 4,
  display: "flex",
  gap: 10,
  fontSize: 12,
  padding: "4px 12px",
  borderRadius: 999,
  background: "rgba(20,8,8,0.72)",
  border: "1px solid rgba(255,106,74,0.35)",
  pointerEvents: "none",
};

const shopStyle: CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: 88,
  zIndex: 5,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 12,
  borderRadius: 12,
  background: "rgba(6,18,12,0.82)",
  border: "1px solid rgba(126,224,160,0.3)",
};

const deadStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(4,6,12,0.72)",
  gap: 8,
};

const loadStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%,-50%)",
  zIndex: 6,
  fontSize: 14,
  opacity: 0.85,
  textAlign: "center",
  pointerEvents: "none",
};

const hintStyle: CSSProperties = {
  position: "absolute",
  bottom: 100,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 4,
  fontSize: 12,
  opacity: 0.7,
  pointerEvents: "none",
  whiteSpace: "nowrap",
};
