import { useEffect, useMemo, useState } from "react";
import { Download, Library, Swords, Hammer, Users, Wrench, Search, Play, ExternalLink } from "lucide-react";
import { assetUrl } from "../lib/fleet";
import {
  type AppMode,
  type OpenSurface,
  type SurfaceGroup,
  hubDoorSurfaces,
  HUB_GROUP_ORDER,
  SURFACE_GROUP_LABEL,
  pathForMode,
} from "../lib/openRoutes";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import { loginWithGrudgeId, logoutGrudge } from "../lib/grudgeAuth";
import { InstallAppButton } from "./InstallAppButton";
import "./steamLibrary.css";

/** Resolve a room poster from public/rooms/<name>-scene.png (CDN-aware). */
const poster = (name: string) => assetUrl(`rooms/${name}-scene.png`);

interface Props {
  onEnter: (mode: Exclude<AppMode, "doors" | "play">) => void;
}

const GROUP_ICON: Record<SurfaceGroup, typeof Swords> = {
  hub: Library,
  combat: Swords,
  create: Hammer,
  multiplayer: Users,
  tools: Wrench,
  external: ExternalLink,
};

type FilterId = "all" | SurfaceGroup;

/**
 * Steam-style library home: top chrome, left nav, featured banner, game grid.
 * Catalog SSOT: `lib/openRoutes.ts` (OPEN_SURFACES).
 */
export function DoorSelect({ onEnter }: Props) {
  const doors = hubDoorSurfaces();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OpenSurface | null>(doors[0] ?? null);
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);

  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doors.filter((d) => {
      if (filter !== "all" && d.group !== filter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.blurb.toLowerCase().includes(q) ||
        d.slug.includes(q) ||
        (d.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
      );
    });
  }, [doors, filter, query]);

  const byGroup = HUB_GROUP_ORDER.map((g) => ({
    group: g,
    label: SURFACE_GROUP_LABEL[g],
    items: filtered.filter((d) => d.group === g),
  })).filter((g) => g.items.length > 0);

  // Keep selection valid when filtering
  useEffect(() => {
    if (!selected || !filtered.some((d) => d.mode === selected.mode)) {
      setSelected(filtered[0] ?? null);
    }
  }, [filtered, selected]);

  const featured = selected ?? filtered[0] ?? doors[0] ?? null;
  const account = snap.account;
  const charCount = snap.characters.length;

  const launch = (surface: OpenSurface) => {
    const mode = surface.mode as Exclude<AppMode, "doors" | "play">;
    onEnter(mode);
  };

  return (
    <div className="steam-lib" data-testid="steam-library">
      {/* ── Top bar (Steam chrome) ── */}
      <header className="steam-top">
        <div className="steam-top-left">
          <img className="steam-logo" src={assetUrl("logo.svg")} alt="" width={28} height={28} draggable={false} />
          <span className="steam-brand">
            GRUDGE<span className="steam-brand-accent">OPEN</span>
          </span>
          <nav className="steam-top-nav" aria-label="Primary">
            <button type="button" className="steam-top-link active">
              Library
            </button>
            <a className="steam-top-link" href="https://grudge-studio.com" target="_blank" rel="noreferrer">
              Store
            </a>
            <a className="steam-top-link" href="https://grudox.grudge-studio.com" target="_blank" rel="noreferrer">
              Community
            </a>
          </nav>
        </div>
        <div className="steam-top-right">
          <InstallAppButton variant="steam" />
          {account ? (
            <div className="steam-user">
              <span className="steam-user-name">{account.displayName || account.grudgeId}</span>
              <span className="steam-user-meta">{charCount} characters</span>
              <button
                type="button"
                className="steam-user-btn"
                onClick={() => {
                  logoutGrudge();
                  void loginWithGrudgeId(true);
                }}
              >
                Log out
              </button>
            </div>
          ) : (
            <button type="button" className="steam-user-btn steam-user-btn--primary" onClick={() => void loginWithGrudgeId(false)}>
              Grudge ID
            </button>
          )}
        </div>
      </header>

      <div className="steam-body">
        {/* ── Left sidebar ── */}
        <aside className="steam-side">
          <div className="steam-side-search">
            <Search size={14} className="steam-side-search-icon" />
            <input
              type="search"
              placeholder="Search library…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search library"
            />
          </div>

          <div className="steam-side-section">
            <div className="steam-side-label">Collections</div>
            <button
              type="button"
              className={`steam-side-item ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              <Library size={15} />
              <span>All titles</span>
              <span className="steam-side-count">{doors.length}</span>
            </button>
            {HUB_GROUP_ORDER.filter((g) => g !== "hub").map((g) => {
              const Icon = GROUP_ICON[g];
              const n = doors.filter((d) => d.group === g).length;
              if (!n) return null;
              return (
                <button
                  key={g}
                  type="button"
                  className={`steam-side-item ${filter === g ? "active" : ""}`}
                  onClick={() => setFilter(g)}
                >
                  <Icon size={15} />
                  <span>{SURFACE_GROUP_LABEL[g]}</span>
                  <span className="steam-side-count">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="steam-side-section steam-side-section--foot">
            <div className="steam-side-label">Download</div>
            <div className="steam-side-download">
              <Download size={16} />
              <div>
                <strong>Desktop / mobile app</strong>
                <p>Install Grudge Open for offline shell + home-screen launch</p>
              </div>
            </div>
            <InstallAppButton variant="sidebar" />
          </div>
        </aside>

        {/* ── Main library pane ── */}
        <main className="steam-main">
          {featured && (
            <section className="steam-hero" style={{ "--hero-accent": featured.accent ?? "#66c0f4" } as React.CSSProperties}>
              <div className="steam-hero-art">
                <img
                  src={featured.poster ? poster(featured.poster) : poster("lobby")}
                  alt=""
                  draggable={false}
                />
                <div className="steam-hero-fade" />
              </div>
              <div className="steam-hero-body">
                <div className="steam-hero-tags">
                  {(featured.tags ?? ["Open", "Lab"]).map((t) => (
                    <span key={t} className="steam-pill">
                      {t}
                    </span>
                  ))}
                  <span className="steam-pill steam-pill--muted">{pathForMode(featured.mode)}</span>
                </div>
                <h1>{featured.title}</h1>
                <p>{featured.blurb}</p>
                <div className="steam-hero-actions">
                  <button type="button" className="steam-play" onClick={() => launch(featured)}>
                    <Play size={16} fill="currentColor" />
                    Play
                  </button>
                  <button
                    type="button"
                    className="steam-secondary"
                    onClick={() => {
                      const path = pathForMode(featured.mode);
                      void navigator.clipboard?.writeText(`${window.location.origin}${path}`);
                    }}
                    title="Copy deep link"
                  >
                    Copy link
                  </button>
                </div>
              </div>
            </section>
          )}

          {byGroup.map(({ group, label, items }) => (
            <section key={group} className="steam-shelf" data-group={group}>
              <h2 className="steam-shelf-title">{label}</h2>
              <div className="steam-grid">
                {items.map((surface) => {
                  const active = featured?.mode === surface.mode;
                  const img = surface.poster ? poster(surface.poster) : poster("lobby");
                  const tags = surface.tags ?? (["Open", "Lab"] as const);
                  const accent = surface.accent ?? "#66c0f4";
                  return (
                    <article
                      key={surface.mode}
                      className={`steam-card ${active ? "active" : ""}`}
                      style={{ "--card-accent": accent } as React.CSSProperties}
                      onClick={() => setSelected(surface)}
                      onDoubleClick={() => launch(surface)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(surface);
                        }
                      }}
                      title={`${surface.title} · double-click to play`}
                      data-mode={surface.mode}
                      tabIndex={0}
                      role="button"
                      aria-pressed={active}
                    >
                      <div className="steam-card-art">
                        <img src={img} alt="" draggable={false} />
                        <span className="steam-card-badge">{tags[0]}</span>
                        <span className="steam-card-play" aria-hidden>
                          <Play size={18} fill="currentColor" />
                        </span>
                      </div>
                      <div className="steam-card-meta">
                        <h3>{surface.title}</h3>
                        <p>{surface.blurb}</p>
                        <div className="steam-card-foot">
                          <span className="steam-card-ready">Ready</span>
                          <span className="steam-card-slug">{pathForMode(surface.mode)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="steam-card-launch"
                        onClick={(e) => {
                          e.stopPropagation();
                          launch(surface);
                        }}
                      >
                        Play
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="steam-empty">
              <p>No titles match your search.</p>
              <button type="button" className="steam-secondary" onClick={() => { setQuery(""); setFilter("all"); }}>
                Clear filters
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Bottom status strip ── */}
      <footer className="steam-status">
        <span className="steam-status-dot" />
        <span>Ready</span>
        <span className="steam-status-sep">·</span>
        <span>Grudge Open library</span>
        <span className="steam-status-grow" />
        <span className="steam-status-hint">Double-click a title to launch · Install for home-screen app</span>
      </footer>
    </div>
  );
}
