/**
 * Steam / Roblox–style game library for open.grudge-studio.com
 *
 * - Browse / filter fleet titles
 * - Launch native modes or external / Mine-Loader worlds
 * - Surface deploy stack + treaty entry points
 */
import { useMemo, useState, type CSSProperties } from "react";
import {
  GAME_LIBRARY,
  MINE_LOADER,
  featuredGames,
  gameLaunchUrl,
  getGame,
  iconUrl,
  libraryByCategory,
  posterUrl,
  type GameCategory,
  type GameEntry,
} from "../game/gameLibrary";
import { getStoredToken } from "../lib/grudgeAuth";
import { gameSession } from "../game/GameSession";
import {
  embedSessionForGame,
  nativeModeForGame,
  type InAppEmbedSession,
} from "../lib/inAppLaunch";
import "./gameLibrary.css";

export type LibraryNavigateMode =
  | "danger"
  | "brawl"
  | "mimic"
  | "genesis"
  | "voxgrudge-native"
  | "voxel"
  | "editor"
  | "lobby"
  | "zones"
  | "ledmask"
  | "account"
  | "doors"
  | "minegrudge"
  | "survival";

type FilterId = "all" | "featured" | GameCategory;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All Games" },
  { id: "featured", label: "Featured" },
  { id: "open-world", label: "Worlds" },
  { id: "combat", label: "Combat" },
  { id: "rts", label: "RTS" },
  { id: "survival", label: "Survival" },
  { id: "editor", label: "Create" },
  { id: "social", label: "Social" },
  { id: "arcade", label: "Arcade" },
  { id: "account", label: "Account" },
];

interface Props {
  onNavigate: (mode: LibraryNavigateMode) => void;
  onOpenAccount?: () => void;
  /** Open external fleet titles inside Open (no new browser page). */
  onOpenInApp?: (session: InAppEmbedSession) => void;
}

export function GameLibrary({ onNavigate, onOpenAccount, onOpenInApp }: Props) {
  const [filter, setFilter] = useState<FilterId>("featured");
  const [selectedId, setSelectedId] = useState<string>(() => featuredGames()[0]?.id ?? GAME_LIBRARY[0].id);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let base =
      filter === "featured"
        ? featuredGames()
        : filter === "all"
          ? [...GAME_LIBRARY]
          : libraryByCategory(filter as GameCategory);
    const s = q.trim().toLowerCase();
    if (s) {
      base = base.filter(
        (g) =>
          g.title.toLowerCase().includes(s) ||
          g.blurb.toLowerCase().includes(s) ||
          g.tags.some((t) => t.toLowerCase().includes(s)) ||
          g.engines.some((e) => e.includes(s)),
      );
    }
    return base;
  }, [filter, q]);

  const selected: GameEntry = getGame(selectedId) ?? list[0] ?? GAME_LIBRARY[0];

  const launchCtx = () => {
    const snap = gameSession.snapshot;
    const ch = gameSession.selectedCharacter();
    return {
      token: getStoredToken(),
      characterId: snap.selectedCharacterId,
      baseId:
        (typeof ch?.config?.baseId === "string" && ch.config.baseId) ||
        (ch?.raceId ? `race-${ch.raceId}` : null),
      raceId: ch?.raceId ?? null,
      characterName: ch?.name ?? null,
    };
  };

  /** Prefer native mode, else in-app canvas — never force a new page. */
  const launch = (game: GameEntry) => {
    const native = nativeModeForGame(game);
    if (native) {
      onNavigate(native as LibraryNavigateMode);
      return;
    }
    const session = embedSessionForGame(game, launchCtx(), "doors");
    if (session && onOpenInApp) {
      onOpenInApp(session);
      return;
    }
    // Fallback if host did not wire canvas (should be rare)
    if (session) window.open(session.url, "_blank", "noopener,noreferrer");
  };

  const popOut = (game: GameEntry) => {
    const url = gameLaunchUrl(game, launchCtx());
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="gl-root">
      <header className="gl-top">
        <div className="gl-brand">
          <span className="brand">
            GRUDGE<span className="brand-accent"> LIBRARY</span>
          </span>
          <p className="gl-sub">
            Steam-style launcher · Roblox-like create & deploy · Mine-Loader worlds · Treaty & fleet SSO
          </p>
        </div>
        <div className="gl-top-actions">
          <input
            className="gl-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games, engines, tags…"
            aria-label="Search library"
          />
          <button type="button" className="gl-btn ghost" onClick={() => onOpenAccount?.() || onNavigate("account")}>
            Account
          </button>
          <button type="button" className="gl-btn ghost" onClick={() => onNavigate("doors")}>
            Doors
          </button>
        </div>
      </header>

      <div className="gl-mine-banner">
        <div>
          <strong>World engine: Mine-Loader</strong>
          <span>
            {" "}
            — local {MINE_LOADER.localPath.split("\\").slice(-2).join("/")} · deploy Vercel + Railway (1
            replica) + CF · never Replit
          </span>
        </div>
        <button type="button" className="gl-btn primary" onClick={() => launch(getGame("mine-loader-realms")!)}>
          Open Realms
        </button>
      </div>

      <div className="gl-body">
        <aside className="gl-rail">
          <nav className="gl-filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`gl-filter${filter === f.id ? " on" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </nav>
          <div className="gl-list">
            {list.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`gl-row${selected.id === g.id ? " on" : ""}`}
                onClick={() => setSelectedId(g.id)}
                style={{ "--row-tone": g.tone } as CSSProperties}
              >
                <img className="gl-row-thumb" src={posterUrl(g.posterKey)} alt="" draggable={false} />
                <div className="gl-row-meta">
                  <div className="gl-row-title">{g.title}</div>
                  <div className="gl-row-short">{g.short}</div>
                  <div className="gl-row-status">{g.status}</div>
                </div>
                {g.icon && (
                  <img className="gl-row-ico" src={iconUrl(g.icon)} alt="" width={22} height={22} draggable={false} />
                )}
              </button>
            ))}
            {list.length === 0 && <p className="gl-empty">No games match.</p>}
          </div>
        </aside>

        <main className="gl-detail">
          <div
            className="gl-hero"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(6,10,18,0.92) 0%, rgba(6,10,18,0.55) 45%, rgba(6,10,18,0.25) 100%), url(${posterUrl(selected.posterKey)})`,
            }}
          >
            <div className="gl-hero-inner">
              <div className="gl-status-pill" style={{ borderColor: selected.tone, color: selected.tone }}>
                {selected.status.toUpperCase()} · {selected.category}
              </div>
              <h1 style={{ color: selected.tone }}>{selected.title}</h1>
              <p className="gl-hero-blurb">{selected.blurb}</p>
              <div className="gl-tags">
                {selected.tags.map((t) => (
                  <span key={t} className="gl-tag">
                    {t}
                  </span>
                ))}
                {selected.engines.map((e) => (
                  <span key={e} className="gl-tag eng">
                    {e}
                  </span>
                ))}
              </div>
              <div className="gl-cta-row">
                <button type="button" className="gl-btn primary large" onClick={() => launch(selected)}>
                  {selected.launch === "mine-loader"
                    ? "Play Realms in app"
                    : selected.launch === "external"
                      ? "Play in app"
                      : selected.launch === "editor"
                        ? "Open Editor"
                        : "Play"}
                </button>
                {(selected.launch === "external" || selected.launch === "mine-loader") && (
                  <button type="button" className="gl-btn ghost large" onClick={() => popOut(selected)}>
                    Pop out ↗
                  </button>
                )}
                {selected.engines.includes("mine-loader") && selected.id !== "mine-loader-realms" && (
                  <button
                    type="button"
                    className="gl-btn ghost large"
                    onClick={() => launch(getGame("mine-loader-realms")!)}
                  >
                    World server (Mine-Loader)
                  </button>
                )}
                <button type="button" className="gl-btn ghost large" onClick={() => onNavigate("account")}>
                  Treaty / Account
                </button>
              </div>
            </div>
          </div>

          <section className="gl-panels">
            <div className="gl-panel">
              <h3>Deploy stack</h3>
              <ul>
                <li>
                  <strong>Client</strong> {selected.deploy.client}
                </li>
                <li>
                  <strong>Server</strong> {selected.deploy.server || "none"}
                  {selected.deploy.singleReplica ? " · single replica (world authority)" : ""}
                </li>
                <li>
                  <strong>Edge</strong> {selected.deploy.edge || "none"}
                </li>
                <li>
                  <strong>Launch</strong> {selected.launch}
                  {selected.url ? ` · ${selected.url}` : selected.nativeMode ? ` · mode=${selected.nativeMode}` : ""}
                </li>
              </ul>
            </div>
            <div className="gl-panel">
              <h3>Sources (local fleet)</h3>
              <ul className="gl-sources">
                {selected.sources.map((s) => (
                  <li key={s}>
                    <code>{s}</code>
                  </li>
                ))}
              </ul>
            </div>
            <div className="gl-panel">
              <h3>Mine-Loader world rules</h3>
              <ul>
                {MINE_LOADER.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="gl-featured-strip">
            <h3>Featured</h3>
            <div className="gl-cards">
              {featuredGames().map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="gl-card"
                  onClick={() => setSelectedId(g.id)}
                  style={{ "--card-tone": g.tone } as CSSProperties}
                >
                  <img src={posterUrl(g.posterKey)} alt="" draggable={false} />
                  <div>
                    <strong>{g.title}</strong>
                    <span>{g.short}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
