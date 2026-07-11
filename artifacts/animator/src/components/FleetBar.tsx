/**
 * Compact fleet identity + mode strip.
 * Grudge ID login, character count, current game mode.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import { GAME_MODES, type GameModeId } from "../game/modes";
import { loginWithGrudgeId, logoutGrudge } from "../lib/grudgeAuth";


export function FleetBar() {
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);

  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 50,
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        maxWidth: "min(520px, 92vw)",
        pointerEvents: "auto",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 10,
          background: "rgba(7,11,20,0.88)",
          border: "1px solid rgba(79,195,255,0.22)",
          color: "#cfe0fa",
        }}
      >
        {snap.account ? (
          <>
            <span style={{ color: "#8ec3ff" }}>{snap.account.displayName || snap.account.grudgeId}</span>
            <span style={{ opacity: 0.7 }}>{snap.characters.length} chars</span>
            <button type="button" onClick={() => logoutGrudge()} style={btnStyle}>
              Log out
            </button>
          </>
        ) : (
          <>
            <span style={{ opacity: 0.75 }}>Guest</span>
            <button type="button" onClick={() => loginWithGrudgeId()} style={btnPrimary}>
              Grudge ID
            </button>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "0 4px 0 8px",
          borderRadius: 10,
          background: "rgba(7,11,20,0.88)",
          border: "1px solid rgba(79,195,255,0.22)",
        }}
      >
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#5d80a8", whiteSpace: "nowrap" }}>Mode</span>
        <select
          value={snap.mode.id}
          onChange={(e) => gameSession.setMode(e.target.value as GameModeId)}
          style={{
            background: "transparent",
            border: "none",
            color: "#eaf4ff",
            fontSize: 12,
            padding: "6px 4px",
            cursor: "pointer",
            maxWidth: 160,
            outline: "none",
          }}
          title={snap.mode.blurb}
        >
          {GAME_MODES.map((m) => (
            <option key={m.id} value={m.id} style={{ background: "#0a0e1a" }}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      {snap.account && snap.characters.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 10,
            background: "rgba(7,11,20,0.88)",
            border: "1px solid rgba(79,195,255,0.22)",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.75, color: "#cfe0fa" }}>No characters</span>
          <a
            href="https://character.grudge-studio.com?era=warlords&from=gameopen"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}
          >
            Create character →
          </a>
        </div>
      )}

      {snap.characters.length > 0 && (
        <select
          value={snap.selectedCharacterId || ""}
          onChange={(e) => gameSession.selectCharacter(e.target.value || null)}
          style={{
            ...btnStyle,
            background: "rgba(7,11,20,0.92)",
            border: "1px solid rgba(79,195,255,0.28)",
            color: "#eaf4ff",
            maxWidth: 160,
          }}
        >
          {snap.characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.raceId ? ` (${c.raceId})` : ""}
              {c.level ? ` lv${c.level}` : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

const btnStyle: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.25)",
  background: "transparent",
  color: "#cfe0fa",
  borderRadius: 8,
  padding: "4px 8px",
  cursor: "pointer",
  fontSize: 12,
};

const btnPrimary: CSSProperties = {
  ...btnStyle,
  background: "#4f7bff",
  color: "#fff",
  border: "none",
};

