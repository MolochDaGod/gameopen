/**
 * GRUDOX Zones launcher.
 *
 * Lists the selected GRUDOX modes as cards. Each card deep-links into the GRUDOX
 * arcade cabinet carrying the fleet SSO token + the active fleet character
 * (`grudge_token` + `characterId` + `open=1`), so identity and the chosen
 * character persist across the handoff. The `brawler` zone additionally offers a
 * native in-gameopen surface (Ruins Brawler) wired to the GRUDOX `/api/brawl`
 * room.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import { GRUDOX_ZONES, grudoxDeepLink } from "../game/grudoxZones";
import { getStoredToken } from "../lib/grudgeAuth";

interface Props {
  /** Launch the native in-gameopen Ruins Brawler surface. */
  onEnterNative: () => void;
  /** Return to the door select. */
  onExit: () => void;
}

export function GrudoxZones({ onEnterNative, onExit }: Props) {
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);
  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const character = snap.characters.find((c) => c.id === snap.selectedCharacterId) ?? null;

  const launch = (zoneId: string) => {
    const url = grudoxDeepLink(zoneId, {
      token: getStoredToken(),
      characterId: snap.selectedCharacterId,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="doors" style={{ overflowY: "auto" }}>
      <div className="doors-head">
        <span className="brand">
          GRUDOX<span className="brand-accent">ZONES</span>
        </span>
        <p className="doors-sub">
          Jump into the shared GRUDOX game world — your Grudge character comes with you.
        </p>
        <p style={identStyle}>
          {snap.account ? (
            <>
              Signed in as{" "}
              <b style={{ color: "#8ec3ff" }}>
                {snap.account.displayName || snap.account.grudgeId}
              </b>
              {character ? (
                <>
                  {" · playing "}
                  <b style={{ color: "#aef5c4" }}>{character.name}</b>
                  {character.raceId ? ` (${character.raceId})` : ""}
                </>
              ) : (
                " · no character selected (pick one in the Lobby)"
              )}
            </>
          ) : (
            "Guest — sign in with Grudge ID to carry your character across zones."
          )}
        </p>
      </div>

      <div className="doors-row" style={{ flexWrap: "wrap" }}>
        {GRUDOX_ZONES.map((zone) => (
          <div
            key={zone.id}
            className="door"
            style={{ borderColor: zone.tone, cursor: "default" }}
          >
            <div className="door-frame">
              <div className="door-glyph" style={{ color: zone.tone }}>
                ◆
              </div>
            </div>
            <h3>{zone.title}</h3>
            <p>{zone.blurb}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {zone.native && (
                <button type="button" style={btnPrimary} onClick={onEnterNative}>
                  Play here
                </button>
              )}
              <button type="button" style={btnStyle} onClick={() => launch(zone.id)}>
                Open in GRUDOX ↗
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" style={btnStyle} onClick={onExit}>
          ⮐ Back
        </button>
      </div>
    </div>
  );
}

const identStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.85,
  color: "#cfe0fa",
};

const btnStyle: CSSProperties = {
  border: "1px solid rgba(79,195,255,0.35)",
  background: "rgba(7,11,20,0.6)",
  color: "#eaf4ff",
  borderRadius: 8,
  padding: "7px 12px",
  cursor: "pointer",
  fontSize: 13,
};

const btnPrimary: CSSProperties = {
  ...btnStyle,
  background: "#4f7bff",
  color: "#fff",
  border: "none",
};
