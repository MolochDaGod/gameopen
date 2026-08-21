/**
 * Fleet identity strip — account, chars, island, logout + mode/hero selects.
 * `inline` = sits inside the unified shell header (no fixed positioning).
 * `fixed`  = legacy floating chip (only when shell is hidden, e.g. rare modes).
 */
import { useEffect, useState, type CSSProperties } from "react";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import { GAME_MODES, type GameModeId } from "../game/modes";
import { loginWithGrudgeId, logoutGrudge, getStoredToken } from "../lib/grudgeAuth";
import { characterGameEra } from "../lib/characterPortrait";
import { assetUrl } from "../lib/fleet";
import { lobbyIslandDeepLink } from "../game/grudoxZones";

/** Icon filename for each combat game mode. */
const MODE_ICON: Partial<Record<GameModeId, string>> = {
  "danger-room": "combat-pad",
  "boss-rush": "siege",
  horde: "ambush",
  duel: "attack",
  "coop-assault": "rally",
  sparring: "defend",
  "arena-war": "charge",
  "dungeon-crawl": "explore",
  "pirate-siege": "loot",
  "warlord-genesis": "skill-vfx-lab",
};

function ModeIcon({ id }: { id: GameModeId }) {
  const icon = MODE_ICON[id];
  if (!icon) return null;
  return (
    <img
      src={assetUrl(`icons/${icon}.png`)}
      alt=""
      width={14}
      height={14}
      draggable={false}
      style={{ objectFit: "contain", verticalAlign: "middle", marginRight: 3 }}
    />
  );
}

const btnStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(79,195,255,0.28)",
  color: "#cfe0fa",
  borderRadius: 8,
  padding: "4px 9px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnPrimary: CSSProperties = {
  ...btnStyle,
  background: "rgba(40, 90, 150, 0.45)",
  borderColor: "rgba(102,192,244,0.45)",
};

type Props = {
  /** inline = shell header row; fixed = absolute float (legacy) */
  variant?: "inline" | "fixed";
  /**
   * Danger Room match catalog (Sparring / Horde / …).
   * Off on product hubs — it is not the current app surface.
   */
  showModeSelect?: boolean;
};

export function FleetBar({ variant = "inline", showModeSelect = false }: Props) {
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);

  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const body = (
    <>
      <div className="fleet-chip fleet-chip--account">
        {snap.account ? (
          <>
            <span className="fleet-user" title={snap.account.grudgeId}>
              {snap.account.displayName || snap.account.grudgeId}
            </span>
            <span className="fleet-meta">{snap.characters.length} chars</span>
            {snap.walletAddress && (
              <span
                className="fleet-wallet"
                title={snap.walletAddress}
              >
                ◈ {snap.walletAddress.slice(0, 4)}…{snap.walletAddress.slice(-4)}
              </span>
            )}
            <a href="/?door=account" className="fleet-link" title="Account hub">
              Account
            </a>
            <button
              type="button"
              className="fleet-btn"
              onClick={() => {
                const url = lobbyIslandDeepLink({
                  token: getStoredToken(),
                  characterId: snap.selectedCharacterId,
                });
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              title="Open GRUDOX Island"
            >
              Island ↗
            </button>
            <button
              type="button"
              className="fleet-btn fleet-btn--ghost"
              onClick={() => {
                logoutGrudge();
                void loginWithGrudgeId(true);
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <span className="fleet-meta">Guest</span>
            <button
              type="button"
              className="fleet-btn fleet-btn--primary"
              onClick={() => void loginWithGrudgeId(false)}
            >
              Grudge ID
            </button>
          </>
        )}
      </div>

      {showModeSelect && (
        <div className="fleet-chip fleet-chip--mode" title={snap.mode.blurb}>
          <ModeIcon id={snap.mode.id} />
          <span className="fleet-label">Mode</span>
          <select
            className="fleet-select"
            value={snap.mode.id}
            onChange={(e) => gameSession.setMode(e.target.value as GameModeId)}
          >
            {GAME_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {snap.characters.length > 0 && (
        <div className="fleet-chip fleet-chip--hero">
          <span className="fleet-label">Hero</span>
          <select
            className="fleet-select"
            value={snap.selectedCharacterId || ""}
            onChange={(e) => gameSession.selectCharacter(e.target.value || null)}
            title="Active hero (all eras)"
          >
            {snap.characters.map((c) => {
              const era = characterGameEra(c) || "warlords";
              return (
                <option key={c.id} value={c.id}>
                  {c.name} · {era}
                  {c.raceId ? ` · ${c.raceId}` : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {snap.account && snap.characters.length === 0 && (
        <a
          href="https://character.grudge-studio.com?era=warlords&from=open&returnTo=https://open.grudge-studio.com/account"
          target="_blank"
          rel="noopener noreferrer"
          className="fleet-btn fleet-btn--primary"
        >
          Create character →
        </a>
      )}
    </>
  );

  if (variant === "fixed") {
    return (
      <div className="fleet-bar fleet-bar--fixed" style={{ maxWidth: "min(520px, 92vw)" }}>
        {body}
      </div>
    );
  }

  return <div className="fleet-bar fleet-bar--inline">{body}</div>;
}

// Keep legacy style objects available for any external copy-paste references
export const fleetBarLegacyStyles = { btnStyle, btnPrimary };
