/**
 * Fleet character picker.
 *
 * Lists the signed-in Grudge account's characters (from
 * `grudgeAuth.fetchCharacters()` via {@link ../game/GameSession}) and lets the
 * player pick the active one. The selection is persisted in the session and
 * drives BOTH the in-gameopen avatar (its race resolves to a grudge6 FBX) and
 * the `characterId` carried on GRUDOX deep-links, so one character is shared
 * across gameopen and the GRUDOX zones.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import { loginWithGrudgeId } from "../lib/grudgeAuth";
import { resolveRaceModel } from "../lib/raceModel";
import { RACE_ASSETS } from "../three/grudge";

export function CharacterPicker() {
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);
  const [reloading, setReloading] = useState(false);
  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const character = snap.characters.find((c) => c.id === snap.selectedCharacterId) ?? null;
  const resolved = resolveRaceModel(character);
  const raceName = RACE_ASSETS[resolved.raceId].name;

  const reload = async () => {
    setReloading(true);
    try {
      await gameSession.refreshCharacters();
    } finally {
      setReloading(false);
    }
  };

  return (
    <section style={wrapStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="brand" style={{ fontSize: 15 }}>
          YOUR<span className="brand-accent">CHARACTER</span>
        </span>
        {snap.account ? (
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            {snap.account.displayName || snap.account.grudgeId}
          </span>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.75 }}>Guest</span>
        )}
      </div>

      {!snap.account ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>
            Sign in with Grudge ID to bring your character into gameopen and the GRUDOX zones.
          </p>
          <button type="button" style={btnPrimary} onClick={() => loginWithGrudgeId()}>
            Grudge ID
          </button>
        </div>
      ) : snap.characters.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>
            No characters found on this account.
          </p>
          <button type="button" style={btnStyle} onClick={reload} disabled={reloading}>
            {reloading ? "Reloading…" : "Reload"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            value={snap.selectedCharacterId || ""}
            onChange={(e) => gameSession.selectCharacter(e.target.value || null)}
            style={selectStyle}
          >
            {snap.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.raceId ? ` · ${c.raceId}` : ""}
                {c.level ? ` · L${c.level}` : ""}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, opacity: 0.85, color: "#aef5c4" }}>
            Avatar: {raceName} ({resolved.presetId})
          </span>
          <button type="button" style={btnStyle} onClick={reload} disabled={reloading}>
            {reloading ? "Reloading…" : "Reload"}
          </button>
        </div>
      )}
    </section>
  );
}

const wrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 14px",
  margin: "0 0 12px",
  borderRadius: 12,
  background: "rgba(7,11,20,0.6)",
  border: "1px solid rgba(79,195,255,0.22)",
  color: "#cfe0fa",
};

const selectStyle: CSSProperties = {
  background: "rgba(7,11,20,0.92)",
  border: "1px solid rgba(79,195,255,0.28)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 13,
  maxWidth: 220,
};

const btnStyle: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.35)",
  background: "rgba(7,11,20,0.6)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 12,
};

const btnPrimary: CSSProperties = {
  ...btnStyle,
  background: "#4f7bff",
  color: "#fff",
  border: "none",
};
