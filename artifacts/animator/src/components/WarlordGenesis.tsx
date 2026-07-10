import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  WarlordGenesisScene,
  type WarlordGenesisState,
} from "../three/genesis/WarlordGenesisScene";

interface Props {
  onExit: () => void;
}

// ── race catalogue ────────────────────────────────────────────────────────────

interface RaceCard {
  id: string;
  name: string;
  lore: string;
  stats: string;
  hpColor: string;
}

const RACE_CARDS: RaceCard[] = [
  { id: "human",    name: "Human",    lore: "Balanced warrior",  stats: "STR ★★★ DEX ★★★ INT ★★★",          hpColor: "#4f9bff" },
  { id: "orc",      name: "Orc",      lore: "Brute force",       stats: "STR ★★★★★ DEX ★★ INT ★",            hpColor: "#7cff3a" },
  { id: "undead",   name: "Undead",   lore: "Dark sorcerer",     stats: "STR ★★ DEX ★★★ INT ★★★★★",          hpColor: "#c45cff" },
  { id: "barbarian",name: "Barbarian",lore: "Berserker",         stats: "STR ★★★★ DEX ★★★ INT ★★",           hpColor: "#ff7a3a" },
  { id: "dwarf",    name: "Dwarf",    lore: "Iron tank",         stats: "STR ★★★★ DEX ★★ INT ★★ VIT ★★★★★", hpColor: "#ffd24d" },
  { id: "high_elf", name: "High Elf", lore: "Arcane ranger",     stats: "STR ★★ DEX ★★★★ INT ★★★★",         hpColor: "#5fe0ff" },
];

const RACE_HP_COLOR: Record<string, string> = Object.fromEntries(
  RACE_CARDS.map((r) => [r.id, r.hpColor]),
);

// ── helpers ───────────────────────────────────────────────────────────────────

const pct = (v: number, m: number) =>
  `${Math.max(0, Math.min(100, (v / Math.max(1, m)) * 100))}%`;

const INITIAL_STATE: WarlordGenesisState = {
  phase: "loading",
  raceId: null,
  playerHp: 100,
  playerMaxHp: 100,
  wave: 0,
  maxWaves: 4,
  kills: 0,
  bossHp: 200,
  bossMaxHp: 200,
  bossName: "Karate Warlord",
  hint: "Loading Warlord Genesis…",
  countdown: 3,
};

// ── component ─────────────────────────────────────────────────────────────────

export function WarlordGenesis({ onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef  = useRef<WarlordGenesisScene | null>(null);
  const [s, setS] = useState<WarlordGenesisState>(INITIAL_STATE);
  const [selectedRace, setSelectedRace] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: WarlordGenesisScene | null = null;
    try {
      scene = new WarlordGenesisScene(canvas, setS);
      sceneRef.current = scene;
    } catch (err) {
      console.warn("[WarlordGenesis] scene init failed", err);
    }
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const handleRaceSelect = (raceId: string) => {
    setSelectedRace(raceId);
    // Don't start yet — user must click START
  };

  const handleStartCampaign = () => {
    if (!selectedRace) return;
    sceneRef.current?.selectRace(selectedRace);
  };

  const handleRespawn = () => {
    sceneRef.current?.respawn();
    setSelectedRace(null);
  };

  const hpColor = RACE_HP_COLOR[s.raceId ?? ""] ?? "#4f9bff";
  const isLoading   = s.phase === "loading";
  const isSelect    = s.phase === "select";
  const isCountdown = s.phase === "countdown";
  const isWave      = s.phase === "wave" || s.phase === "bosswave";
  const isBossWave  = s.phase === "bosswave";
  const isOver      = s.phase === "victory" || s.phase === "defeat";
  const showHUD     = isWave || isCountdown || isOver;

  return (
    <div style={wrap}>
      <canvas ref={canvasRef} style={canvasStyle} />

      {/* ── loading spinner ── */}
      {isLoading && (
        <div style={loadingOverlay}>
          <div style={spinner} />
          <div style={{ marginTop: 14, color: "#9fb8da", fontSize: 14 }}>
            Loading Warlord Genesis…
          </div>
        </div>
      )}

      {/* ── character select overlay ── */}
      {isSelect && (
        <div style={selectOverlay}>
          <div style={selectHeader}>CHOOSE YOUR WARLORD</div>
          <div style={cardsRow}>
            {RACE_CARDS.map((r) => (
              <button
                key={r.id}
                type="button"
                style={{
                  ...raceCard,
                  borderColor: selectedRace === r.id ? r.hpColor : "rgba(255,210,77,0.25)",
                  background: selectedRace === r.id
                    ? `rgba(${hexToRgb(r.hpColor)},0.18)`
                    : "rgba(6,9,16,0.78)",
                  boxShadow: selectedRace === r.id ? `0 0 16px ${r.hpColor}66` : "none",
                }}
                onClick={() => handleRaceSelect(r.id)}
              >
                <div style={{ ...raceName, color: r.hpColor }}>{r.name}</div>
                <div style={raceLore}>{r.lore}</div>
                <div style={raceStats}>{r.stats}</div>
              </button>
            ))}
          </div>
          <button
            type="button"
            style={{ ...startBtn, opacity: selectedRace ? 1 : 0.45, cursor: selectedRace ? "pointer" : "default" }}
            disabled={!selectedRace}
            onClick={handleStartCampaign}
          >
            ⚔ START CAMPAIGN
          </button>
        </div>
      )}

      {/* ── countdown overlay ── */}
      {isCountdown && (
        <div style={countdownOverlay}>
          <div style={countdownNum}>{s.countdown}</div>
          <div style={{ color: "#ffd24d", fontSize: 16, letterSpacing: 3 }}>PREPARE FOR BATTLE</div>
        </div>
      )}

      {/* ── in-game HUD top-left: player HP ── */}
      {showHUD && s.raceId && (
        <div style={hudTL}>
          <div style={{ fontSize: 11, color: "#9fb8da", fontWeight: 700, marginBottom: 4 }}>
            {RACE_CARDS.find((r) => r.id === s.raceId)?.name ?? "Warlord"} HP
          </div>
          <div style={barTrack}>
            <div
              style={{ ...barFill, width: pct(s.playerHp, s.playerMaxHp), background: hpColor }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#eaf4ff", marginTop: 3 }}>
            {s.playerHp} / {s.playerMaxHp}
          </div>
        </div>
      )}

      {/* ── in-game HUD top-center: wave + kills ── */}
      {showHUD && (
        <div style={hudTC}>
          {isWave ? (
            <>
              <span style={{ fontWeight: 900, letterSpacing: 2 }}>
                WAVE {s.wave}/{s.maxWaves}
              </span>
              <span style={{ opacity: 0.75, marginLeft: 12 }}>⚔ {s.kills} kills</span>
            </>
          ) : isCountdown ? null : (
            <span style={{ fontWeight: 900, letterSpacing: 2, color: "#ffd24d" }}>
              {s.phase === "victory" ? "VICTORY" : "DEFEATED"}
            </span>
          )}
        </div>
      )}

      {/* ── top-right: leave + mode name ── */}
      <div style={hudTR}>
        <span style={{ fontSize: 11, opacity: 0.55, color: "#eaf4ff" }}>WARLORD GENESIS</span>
        <button type="button" style={leaveBtn} onClick={onExit}>
          ⬑ Doors
        </button>
      </div>

      {/* ── boss HP bar ── */}
      {isBossWave && (
        <div style={bossBar}>
          <div style={{ fontSize: 11, color: "#ff7a7a", fontWeight: 900, marginBottom: 4, letterSpacing: 2 }}>
            {s.bossName.toUpperCase()}
          </div>
          <div style={{ ...barTrack, height: 10 }}>
            <div
              style={{ ...barFill, width: pct(s.bossHp, s.bossMaxHp), background: "#ff3a3a" }}
            />
          </div>
          <div style={{ fontSize: 11, color: "#ff9a9a", marginTop: 3 }}>
            {s.bossHp} / {s.bossMaxHp}
          </div>
        </div>
      )}

      {/* ── victory / defeat overlay ── */}
      {isOver && (
        <div style={endOverlay}>
          <div style={{ ...endTitle, color: s.phase === "victory" ? "#ffd24d" : "#ff5a5a" }}>
            {s.phase === "victory" ? "⚔ WARLORD VICTORIOUS" : "✕ DEFEATED"}
          </div>
          <div style={{ fontSize: 15, color: "#9fb8da", marginBottom: 20 }}>
            Kills: {s.kills} | Waves: {Math.min(s.wave, 4)}/{s.maxWaves}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {s.phase === "defeat" && (
              <button type="button" style={endBtn} onClick={handleRespawn}>
                ↺ Try Again
              </button>
            )}
            <button type="button" style={{ ...endBtn, background: "rgba(255,210,77,0.2)", borderColor: "#ffd24d", color: "#ffd24d" }} onClick={onExit}>
              ENTER GRUDOX →
            </button>
          </div>
        </div>
      )}

      {/* ── hint bar ── */}
      {!isSelect && !isOver && (
        <div style={hintBar}>{s.hint}</div>
      )}
    </div>
  );
}

// ── small util ────────────────────────────────────────────────────────────────

/** Convert 6-digit hex colour to "R,G,B" string for rgba() CSS. */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// ── styles ────────────────────────────────────────────────────────────────────

const wrap: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#060910",
  userSelect: "none",
  fontFamily: "Inter, system-ui, sans-serif",
};

const canvasStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

const loadingOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(6,9,16,0.75)",
  zIndex: 10,
};

const spinner: CSSProperties = {
  width: 40,
  height: 40,
  border: "3px solid rgba(255,210,77,0.2)",
  borderTopColor: "#ffd24d",
  borderRadius: "50%",
  animation: "spin 0.9s linear infinite",
};

// ── select overlay ────────────────────────────────────────────────────────────

const selectOverlay: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "42%",
  background: "linear-gradient(to top, rgba(6,9,16,0.97) 70%, rgba(6,9,16,0))",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 24px 20px",
  zIndex: 10,
};

const selectHeader: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: 4,
  color: "#ffd24d",
  textShadow: "0 2px 16px rgba(255,210,77,0.5)",
  marginBottom: 14,
};

const cardsRow: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "center",
  marginBottom: 14,
};

const raceCard: CSSProperties = {
  width: 120,
  padding: "10px 8px",
  borderRadius: 10,
  border: "1px solid rgba(255,210,77,0.25)",
  background: "rgba(6,9,16,0.78)",
  cursor: "pointer",
  textAlign: "center",
  transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
  color: "#eaf4ff",
};

const raceName: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1,
  marginBottom: 4,
};

const raceLore: CSSProperties = {
  fontSize: 10,
  color: "#9fb8da",
  marginBottom: 5,
};

const raceStats: CSSProperties = {
  fontSize: 9,
  color: "#c9d8ee",
  lineHeight: 1.5,
};

const startBtn: CSSProperties = {
  padding: "10px 28px",
  borderRadius: 10,
  border: "1.5px solid #ffd24d",
  background: "rgba(255,210,77,0.14)",
  color: "#ffd24d",
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 2,
  cursor: "pointer",
  textShadow: "0 1px 8px rgba(255,210,77,0.4)",
  transition: "opacity 0.15s",
};

// ── in-game HUD ───────────────────────────────────────────────────────────────

const hudTL: CSSProperties = {
  position: "absolute",
  top: 14,
  left: 16,
  zIndex: 5,
  minWidth: 200,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(6,9,16,0.65)",
  border: "1px solid rgba(79,195,255,0.22)",
};

const hudTC: CSSProperties = {
  position: "absolute",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 5,
  padding: "8px 16px",
  borderRadius: 10,
  background: "rgba(6,9,16,0.65)",
  border: "1px solid rgba(255,210,77,0.22)",
  color: "#eaf4ff",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};

const hudTR: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 16,
  zIndex: 5,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "6px 10px",
  borderRadius: 10,
  background: "rgba(6,9,16,0.65)",
  border: "1px solid rgba(255,210,77,0.18)",
};

const leaveBtn: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.35)",
  background: "rgba(6,9,16,0.6)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "5px 10px",
  cursor: "pointer",
  fontSize: 12,
};

const barTrack: CSSProperties = {
  width: "100%",
  height: 12,
  borderRadius: 6,
  background: "rgba(255,255,255,0.12)",
  overflow: "hidden",
};

const barFill: CSSProperties = {
  height: "100%",
  borderRadius: 6,
  transition: "width 0.15s linear",
};

// ── boss HP bar ───────────────────────────────────────────────────────────────

const bossBar: CSSProperties = {
  position: "absolute",
  top: 70,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(560px, 88vw)",
  zIndex: 5,
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(6,9,16,0.8)",
  border: "1px solid rgba(255,58,58,0.4)",
  textAlign: "center",
};

// ── countdown ─────────────────────────────────────────────────────────────────

const countdownOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 8,
  pointerEvents: "none",
};

const countdownNum: CSSProperties = {
  fontSize: 120,
  fontWeight: 900,
  color: "#ffd24d",
  textShadow: "0 4px 40px rgba(255,210,77,0.7)",
  lineHeight: 1,
  marginBottom: 8,
};

// ── victory / defeat ──────────────────────────────────────────────────────────

const endOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(6,9,16,0.72)",
  zIndex: 9,
};

const endTitle: CSSProperties = {
  fontSize: 44,
  fontWeight: 900,
  letterSpacing: 4,
  textShadow: "0 4px 24px rgba(0,0,0,0.9)",
  marginBottom: 12,
};

const endBtn: CSSProperties = {
  padding: "10px 22px",
  borderRadius: 10,
  border: "1px solid rgba(79,195,255,0.4)",
  background: "rgba(6,9,16,0.65)",
  color: "#eaf4ff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: 1,
};

// ── hint bar ──────────────────────────────────────────────────────────────────

const hintBar: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 5,
  fontSize: 12,
  color: "#9fb8da",
  opacity: 0.75,
  pointerEvents: "none",
  textAlign: "center",
  whiteSpace: "nowrap",
};
