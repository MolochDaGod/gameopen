/**
 * VoxGrudge Battle — pre-battle loadout UI + live battleground shell.
 * Singles / Duos · weapon + sidearm · minimap M · bots to 16.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { VoxGrudgeBattleScene } from "../three/voxgrudgeBattle/VoxGrudgeBattleScene";
import {
  type BattleHudSnapshot,
  type BattleLoadout,
  type BattleMode,
  loadSavedLoadout,
  saveLoadout,
  normalizeLoadout,
  primaries,
  sidearms,
  featuredBattleDeployments,
  MAX_BATTLE_PLAYERS,
} from "../game/voxgrudgeBattle";
import { gameSession } from "../game/GameSession";

interface Props {
  onExit: () => void;
  initialMode?: BattleMode;
}

const EMPTY_HUD: BattleHudSnapshot = {
  phase: "lobby",
  mode: "singles",
  aliveCount: 0,
  maxPlayers: 16,
  localHp: 150,
  localMaxHp: 150,
  localKills: 0,
  placement: null,
  countdown: 0,
  winnerName: null,
  winnerTeam: null,
  minimapOpen: false,
  fighters: [],
  primary: "sword",
  sidearm: "pistol",
  usingSidearm: false,
  skills: [
    { slot: 1, label: "Combo", cd: 0, cdMax: 1.6, ready: true },
    { slot: 2, label: "Special", cd: 0, cdMax: 2.8, ready: true },
    { slot: 3, label: "Ranged", cd: 0, cdMax: 2.2, ready: true },
    { slot: 4, label: "Power", cd: 0, cdMax: 4.5, ready: true },
  ],
  killFeed: [],
  loadError: null,
};

export function ThreeVoxBattle({ onExit, initialMode = "singles" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<VoxGrudgeBattleScene | null>(null);
  const [hud, setHud] = useState<BattleHudSnapshot>(EMPTY_HUD);
  const [mode, setMode] = useState<BattleMode>(initialMode);
  const [slots, setSlots] = useState(16);
  const [loadout, setLoadout] = useState<BattleLoadout>(() => loadSavedLoadout());
  const [started, setStarted] = useState(false);
  const [deploymentId, setDeploymentId] = useState("voxgrudge-battle-hunger-singles");

  const session = gameSession.snapshot;
  const localName = useMemo(() => {
    const id = session.selectedCharacterId;
    const c = session.characters.find((x) => x.id === id);
    return c?.name || session.account?.displayName || "You";
  }, [session]);
  const raceId = useMemo(() => {
    const id = session.selectedCharacterId;
    const c = session.characters.find((x) => x.id === id);
    return (c as { raceId?: string } | undefined)?.raceId || "human";
  }, [session]);

  const deps = featuredBattleDeployments();

  const setPrimary = (id: BattleLoadout["primary"]) => {
    setLoadout((L) => normalizeLoadout({ ...L, primary: id }));
  };
  const setSidearm = (id: BattleLoadout["sidearm"]) => {
    setLoadout((L) => normalizeLoadout({ ...L, sidearm: id }));
  };

  const launch = useCallback(() => {
    saveLoadout(loadout);
    const canvas = canvasRef.current;
    if (!canvas) return;
    sceneRef.current?.dispose();
    const depId =
      mode === "duos"
        ? "voxgrudge-battle-hunger-duos"
        : deploymentId;
    sceneRef.current = new VoxGrudgeBattleScene({
      canvas,
      mode,
      playerSlots: slots,
      deploymentId: depId,
      loadout,
      localName,
      localRaceId: raceId,
      seed: `vox-${mode}-${Date.now()}`,
      onHud: setHud,
    });
    setStarted(true);
  }, [loadout, mode, slots, deploymentId, localName, raceId]);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const shell: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    background: "#0a0e14",
    color: "#f2f4f8",
    overflow: "hidden",
    fontFamily: "system-ui,Segoe UI,sans-serif",
  };

  return (
    <div style={shell} data-surface="voxgrudge-battle">
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: started ? "block" : "none",
        }}
      />

      {/* Pre-battle lobby */}
      {!started && (
        <div style={lobbyStyle}>
          <header style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, letterSpacing: 3, color: "#f0c14b", opacity: 0.9 }}>
              VOXGRUDGE BATTLE
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 800 }}>
              Hunger Games Arena
            </h1>
            <p style={{ margin: "8px 0 0", opacity: 0.75, maxWidth: 520, lineHeight: 1.45 }}>
              Last fighter standing · 16 max · Danger Room weapon skills + sidearm · bots with
              brains & strategy · minimap <kbd style={kbd}>M</kbd>
            </p>
          </header>

          <div style={grid2}>
            <section style={card}>
              <h3 style={h3}>Game mode</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {(["singles", "duos"] as BattleMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setDeploymentId(
                        m === "duos"
                          ? "voxgrudge-battle-hunger-duos"
                          : "voxgrudge-battle-hunger-singles",
                      );
                    }}
                    style={mode === m ? btnOn : btnOff}
                  >
                    {m === "singles" ? "Singles" : "Duos"}
                  </button>
                ))}
              </div>
              <label style={{ display: "block", marginTop: 14, fontSize: 13, opacity: 0.8 }}>
                Players (bots fill): {slots}
              </label>
              <input
                type="range"
                min={2}
                max={MAX_BATTLE_PLAYERS}
                value={slots}
                onChange={(e) => setSlots(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </section>

            <section style={card}>
              <h3 style={h3}>Map deployment</h3>
              {deps.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDeploymentId(d.id);
                    if (d.mode === "singles" || d.mode === "duos") setMode(d.mode);
                  }}
                  style={{
                    ...(deploymentId === d.id ? btnOn : btnOff),
                    width: "100%",
                    marginBottom: 8,
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{d.blurb}</div>
                </button>
              ))}
            </section>

            <section style={card}>
              <h3 style={h3}>Primary weapon</h3>
              <div style={weaponGrid}>
                {primaries().map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setPrimary(w.id)}
                    style={loadout.primary === w.id ? weaponOn : weaponOff}
                    title={w.blurb}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </section>

            <section style={card}>
              <h3 style={h3}>Sidearm</h3>
              <div style={weaponGrid}>
                {sidearms().map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSidearm(w.id)}
                    style={loadout.sidearm === w.id ? weaponOn : weaponOff}
                    title={w.blurb}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, opacity: 0.65, marginTop: 10 }}>
                Skills 1–4 use primary T0 / master-weaponSkills kit (Danger Room).{" "}
                <kbd style={kbd}>Q</kbd> swaps sidearm in fight.
              </p>
            </section>
          </div>

          <footer style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "center" }}>
            <button type="button" onClick={launch} style={launchBtn}>
              Drop in — {mode === "duos" ? "Duos" : "Singles"}
            </button>
            <button type="button" onClick={onExit} style={btnOff}>
              Exit
            </button>
            <span style={{ fontSize: 12, opacity: 0.55 }}>
              Fighter: {localName} · race {raceId}
            </span>
          </footer>
        </div>
      )}

      {/* In-match HUD */}
      {started && (
        <>
          <div style={topBar}>
            <button type="button" onClick={onExit} style={btnOff}>
              Exit
            </button>
            <div style={{ fontWeight: 700, letterSpacing: 1 }}>
              VOXGRUDGE BATTLE · {hud.mode.toUpperCase()}
            </div>
            <div>
              Alive {hud.aliveCount}/{hud.maxPlayers}
              {hud.localKills > 0 ? ` · Kills ${hud.localKills}` : ""}
            </div>
          </div>

          {(hud.phase === "countdown" || hud.phase === "result") && (
            <div style={centerBanner}>
              {hud.phase === "countdown" && (
                <div style={{ fontSize: 72, fontWeight: 900 }}>
                  {hud.countdown > 0.2 ? Math.ceil(hud.countdown) : "FIGHT"}
                </div>
              )}
              {hud.phase === "result" && (
                <div>
                  <div style={{ fontSize: 28, opacity: 0.8 }}>Winner</div>
                  <div style={{ fontSize: 42, fontWeight: 900 }}>{hud.winnerName}</div>
                  {hud.placement != null && (
                    <div style={{ marginTop: 8 }}>Your place: #{hud.placement}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {hud.phase === "spectate" && (
            <div style={{ ...centerBanner, fontSize: 22 }}>
              Eliminated · Place #{hud.placement} · Spectating
            </div>
          )}

          <div style={hpBarWrap}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              HP {Math.ceil(hud.localHp)}/{hud.localMaxHp} ·{" "}
              {hud.usingSidearm ? hud.sidearm : hud.primary}
              {hud.minimapOpen ? " · MINIMAP" : " · M minimap"}
            </div>
            <div style={hpTrack}>
              <div
                style={{
                  ...hpFill,
                  width: `${(100 * hud.localHp) / Math.max(1, hud.localMaxHp)}%`,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {hud.skills.map((s) => (
                <div
                  key={s.slot}
                  style={{
                    ...skillChip,
                    opacity: s.ready ? 1 : 0.45,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{s.slot}</div>
                  <div style={{ fontSize: 10 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={killFeed}>
            {hud.killFeed.map((line, i) => (
              <div key={`${line}-${i}`} style={{ opacity: 1 - i * 0.1 }}>
                {line}
              </div>
            ))}
          </div>

          {hud.loadError && (
            <div style={warnBanner}>{hud.loadError}</div>
          )}

          <div style={helpBar}>
            WASD move · Mouse look · LMB attack · 1–4 skills · Q sidearm · M minimap · Shift sprint
          </div>
        </>
      )}
    </div>
  );
}

const lobbyStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  padding: "28px 32px 40px",
  maxWidth: 1100,
  margin: "0 auto",
  height: "100%",
  overflow: "auto",
  background:
    "radial-gradient(ellipse at 20% 0%, rgba(240,193,75,0.12), transparent 50%), linear-gradient(180deg,#101820,#0a0e14)",
};

const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: 14,
};

const card: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 14,
};

const h3: CSSProperties = { margin: "0 0 10px", fontSize: 14, letterSpacing: 1, opacity: 0.9 };

const btnOn: CSSProperties = {
  background: "linear-gradient(180deg,#f0c14b,#c4922a)",
  color: "#1a1205",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnOff: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  color: "#eee",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "10px 14px",
  cursor: "pointer",
};

const launchBtn: CSSProperties = {
  ...btnOn,
  padding: "14px 28px",
  fontSize: 16,
};

const weaponGrid: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const weaponOn: CSSProperties = {
  ...btnOn,
  padding: "8px 10px",
  fontSize: 12,
};

const weaponOff: CSSProperties = {
  ...btnOff,
  padding: "8px 10px",
  fontSize: 12,
};

const kbd: CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  borderRadius: 4,
  padding: "1px 6px",
  fontSize: 11,
};

const topBar: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  background: "linear-gradient(180deg,rgba(0,0,0,0.65),transparent)",
  pointerEvents: "auto",
};

const centerBanner: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 25,
  pointerEvents: "none",
  textAlign: "center",
  textShadow: "0 4px 24px #000",
};

const hpBarWrap: CSSProperties = {
  position: "absolute",
  left: 16,
  bottom: 48,
  zIndex: 20,
  width: 280,
};

const hpTrack: CSSProperties = {
  height: 10,
  borderRadius: 6,
  background: "rgba(0,0,0,0.5)",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.15)",
};

const hpFill: CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg,#3d9e5a,#7dff9a)",
};

const skillChip: CSSProperties = {
  flex: 1,
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "6px 4px",
  textAlign: "center",
  fontSize: 11,
};

const killFeed: CSSProperties = {
  position: "absolute",
  top: 56,
  right: 16,
  zIndex: 20,
  fontSize: 12,
  textAlign: "right",
  textShadow: "0 1px 4px #000",
  maxWidth: 280,
};

const warnBanner: CSSProperties = {
  position: "absolute",
  top: 52,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 22,
  background: "rgba(120,40,20,0.85)",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 12,
  maxWidth: 480,
  textAlign: "center",
};

const helpBar: CSSProperties = {
  position: "absolute",
  bottom: 10,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 20,
  fontSize: 11,
  opacity: 0.55,
  whiteSpace: "nowrap",
};
