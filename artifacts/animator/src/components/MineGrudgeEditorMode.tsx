/**
 * GRUDOX Realms menu — pick surface then enter in-app canvas (collection shell).
 * Does NOT force a new browser tab; optional pop-out remains available.
 */
import { useMemo, useState, useCallback } from "react";
import { readFleetToken } from "../auth/fleetCore";
import { readActiveHeroContext } from "../auth/characterHubLaunch";
import {
  MINE_LOADER_LIVE,
  MINE_LOADER_PILLARS,
  buildMineLoaderUrl,
  type MineLoaderSurface,
} from "../auth/mineLoaderConfig";
import type { InAppEmbedSession } from "../lib/inAppLaunch";
import { posterUrl } from "../game/gameLibrary";
import "./mineGrudgeEditor.css";

interface Props {
  onExit: () => void;
  surface?: MineLoaderSurface;
  /** Preferred: play inside Open collection canvas. */
  onOpenInApp?: (session: InAppEmbedSession) => void;
  /** Jump straight to /realms full surface. */
  onEnterRealms?: () => void;
}

const SURFACES: { id: MineLoaderSurface; label: string; blurb: string }[] = [
  { id: "lobby", label: "Worlds & friends", blurb: "Public/private worlds · invites · co-op" },
  { id: "play", label: "Play", blurb: "Survival · combat · adventure" },
  { id: "editor", label: "Build", blurb: "World editor · blocks · tools" },
  { id: "coop", label: "Party / PvP", blurb: "Party tags · no friendly fire · open PvP" },
  { id: "boss", label: "Boss fights", blurb: "Team-vs-boss arenas" },
  { id: "codex", label: "Codex", blurb: "Blocks · defs · systems wiki" },
  { id: "home", label: "Sign-in hub", blurb: "Grudge ID · account" },
];

export function MineGrudgeEditorMode({
  onExit,
  surface: initialSurface = "lobby",
  onOpenInApp,
  onEnterRealms,
}: Props) {
  const [surface, setSurface] = useState<MineLoaderSurface>(initialSurface);
  const [joinCode, setJoinCode] = useState("");
  const hero = useMemo(() => readActiveHeroContext(), []);

  const src = useMemo(() => {
    const token = readFleetToken();
    return buildMineLoaderUrl({
      surface: joinCode.trim() ? "join" : surface,
      token,
      characterId: hero.characterId,
      characterName: hero.name,
      baseId: hero.baseId,
      joinCode: joinCode.trim() || null,
    });
  }, [hero.baseId, hero.characterId, hero.name, joinCode, surface]);

  const playInApp = useCallback(() => {
    if (onEnterRealms && surface === "lobby" && !joinCode.trim()) {
      onEnterRealms();
      return;
    }
    if (onOpenInApp) {
      onOpenInApp({
        id: "realms",
        url: src,
        title: `Realms · ${surface}`,
        tone: "#7ee0a0",
        poster: posterUrl("library-mine"),
        returnMode: "doors",
      });
      return;
    }
    window.open(src, "_blank", "noopener,noreferrer");
  }, [joinCode, onEnterRealms, onOpenInApp, src, surface]);

  return (
    <div className="mg-root mg-root-native">
      <div className="mg-hero-bg" aria-hidden />

      <div className="mg-float">
        <div className="mg-brand">
          GRUDOX <span>REALMS</span>
          <em>In Open · fleet Mine-Loader</em>
          {hero.name && <b>{hero.name}</b>}
        </div>
        <div className="mg-actions">
          <button type="button" className="mg-btn primary" onClick={playInApp}>
            Play in app
          </button>
          <button
            type="button"
            className="mg-btn"
            onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
          >
            Pop out ↗
          </button>
          <button type="button" className="mg-btn" onClick={onExit}>
            ↩ Back
          </button>
        </div>
      </div>

      <aside className="mg-panel mg-panel-center" aria-label="Realms menu">
        <header className="mg-panel-head">
          <h2>Minecraft-like GRUDOX</h2>
          <p>
            Survival · combat · adventure · build · friends. Collection path{" "}
            <code>/realms</code> on open.grudge-studio.com · authority{" "}
            <a href={MINE_LOADER_LIVE} target="_blank" rel="noreferrer">
              mine-loader.vercel.app
            </a>
            .
          </p>
        </header>

        <section className="mg-pillars">
          {MINE_LOADER_PILLARS.map((p) => (
            <div key={p.id} className="mg-pillar">
              <strong>{p.label}</strong>
              <span>{p.blurb}</span>
            </div>
          ))}
        </section>

        <section className="mg-surfaces">
          <h3>Destination</h3>
          <div className="mg-surface-list">
            {SURFACES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`mg-dest ${surface === s.id ? "active" : ""}`}
                onClick={() => {
                  setJoinCode("");
                  setSurface(s.id);
                }}
              >
                <strong>{s.label}</strong>
                <span>{s.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mg-join">
          <h3>Join a friend</h3>
          <div className="mg-join-row">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Invite / room code"
              maxLength={12}
            />
            <button type="button" className="mg-btn primary" onClick={playInApp}>
              Join in app
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
