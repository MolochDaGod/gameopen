/**
 * GRUDOX Zones launcher — open.grudge-studio.com/zones
 *
 * Primary path: stay **in-app** (native Open engine or embedded canvas).
 * Pop-out to a new browser tab is secondary only.
 *
 * Cards use fleet poster art (rooms/* via assetUrl) — no Meshy placeholders.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import { GRUDOX_ZONES } from "../game/grudoxZones";
import { getStoredToken } from "../lib/grudgeAuth";
import {
  embedSessionForZone,
  nativeModeForZone,
  zonePosterUrl,
  type InAppEmbedSession,
} from "../lib/inAppLaunch";
import { DataShapeStage } from "./DataShapeStage";

interface Props {
  /** Launch a native Open surface (brawl, minegrudge, account, …). */
  onEnterNative: (zoneId: string) => void;
  /** Open external fleet game inside the in-app canvas (not a new page). */
  onOpenInApp: (session: InAppEmbedSession) => void;
  /** Return to the door select. */
  onExit: () => void;
}

export function GrudoxZones({ onEnterNative, onOpenInApp, onExit }: Props) {
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);
  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const character = snap.characters.find((c) => c.id === snap.selectedCharacterId) ?? null;

  const launchCtx = () => ({
    token: getStoredToken(),
    characterId: snap.selectedCharacterId,
  });

  /** Preferred: native engine or in-app embed. */
  const playInApp = (zoneId: string) => {
    const native = nativeModeForZone(zoneId);
    if (native) {
      onEnterNative(zoneId);
      return;
    }
    const session = embedSessionForZone(zoneId, launchCtx(), "zones");
    if (session) onOpenInApp(session);
  };

  /** Secondary: real browser tab (only when user asks). */
  const popOut = (zoneId: string) => {
    const session = embedSessionForZone(zoneId, launchCtx(), "zones");
    if (session) window.open(session.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="doors" style={{ overflowY: "auto" }}>
      <div className="doors-head">
        <span className="brand">
          GRUDOX<span className="brand-accent">ZONES</span>
        </span>
        <p className="doors-sub">
          Play fleet games <b>inside Open</b> — native engines first, then in-app canvas. SSO
          carries your Grudge character. Graph stage: spline VFX + data shape.
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
                " · no character selected (pick one in Account)"
              )}
            </>
          ) : (
            "Guest — sign in with Grudge ID to carry your character across zones."
          )}
        </p>
        <div style={{ marginTop: 12, marginBottom: 4 }}>
          <DataShapeStage height={200} />
          <p style={{ fontSize: 11, opacity: 0.65, marginTop: 6, color: "#9fe8ff" }}>
            Spline graph + Another shape of data · Catmull–Rom streams · postprocessing stack in
            combat
          </p>
        </div>
      </div>

      <div className="doors-row" style={{ flexWrap: "wrap" }}>
        {GRUDOX_ZONES.map((zone) => {
          const native = nativeModeForZone(zone.id);
          const poster = zonePosterUrl(zone.id);
          return (
            <div
              key={zone.id}
              className="door"
              style={{
                borderColor: zone.tone,
                cursor: "default",
                backgroundImage: `linear-gradient(165deg, rgba(6,10,18,0.92) 20%, rgba(6,10,18,0.55)), url(${poster})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="door-frame">
                <div className="door-glyph" style={{ color: zone.tone }}>
                  ◆
                </div>
              </div>
              <h3>{zone.title}</h3>
              <p>{zone.blurb}</p>
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                {native ? "Native Open surface" : "In-app canvas · fleet deploy"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" style={btnPrimary(zone.tone)} onClick={() => playInApp(zone.id)}>
                  {native ? "Play here" : "Play in app"}
                </button>
                <button type="button" style={btnStyle} onClick={() => popOut(zone.id)}>
                  Pop out ↗
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" style={btnStyle} onClick={onExit}>
          ⏎ Back
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

const btnPrimary = (tone: string): CSSProperties => ({
  ...btnStyle,
  background: tone,
  color: "#0a101c",
  border: "none",
  fontWeight: 700,
});
