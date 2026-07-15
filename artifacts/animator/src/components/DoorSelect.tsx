import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Library,
  Swords,
  Hammer,
  Users,
  Wrench,
  Search,
  Play,
  ExternalLink,
  Clock,
  Store,
} from "lucide-react";
import { assetUrl } from "../lib/fleet";
import {
  type AppMode,
  type OpenSurface,
  type SurfaceGroup,
  hubDoorSurfaces,
  HUB_GROUP_ORDER,
  SURFACE_GROUP_LABEL,
  pathForMode,
  surfaceForMode,
} from "../lib/openRoutes";
import { gameSession, type GameSessionSnapshot } from "../game/GameSession";
import { loginWithGrudgeId, logoutGrudge } from "../lib/grudgeAuth";
import {
  formatRecentAt,
  getRecentPlays,
  recordRecentPlay,
  type RecentEntry,
} from "../lib/recentLibrary";
import { InstallAppButton } from "./InstallAppButton";
import { FriendsPanel } from "./FriendsPanel";
import { StoreView } from "./StoreView";
import "./steamLibrary.css";

/** Resolve a room poster from public/rooms/<name>-scene.png (CDN-aware). */
const poster = (name: string) => assetUrl(`rooms/${name}-scene.png`);

interface Props {
  onEnter: (mode: Exclude<AppMode, "doors" | "play" | "landing">) => void;
}

const GROUP_ICON: Record<SurfaceGroup, typeof Swords> = {
  hub: Library,
  combat: Swords,
  create: Hammer,
  multiplayer: Users,
  tools: Wrench,
  external: ExternalLink,
};

type FilterId = "all" | "recent" | SurfaceGroup;
type HubTab = "library" | "store" | "community";

/**
 * Steam-style shell: Library (recents + catalog), Store (fleet), Community (friends/party).
 */
export function DoorSelect({ onEnter }: Props) {
  const doors = hubDoorSurfaces();
  const [tab, setTab] = useState<HubTab>("library");
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OpenSurface | null>(doors[0] ?? null);
  const [snap, setSnap] = useState<GameSessionSnapshot>(() => gameSession.snapshot);
  const [recents, setRecents] = useState<RecentEntry[]>(() => getRecentPlays());
  const [friendsOpen, setFriendsOpen] = useState(true);

  useEffect(() => gameSession.subscribe(() => setSnap(gameSession.snapshot)), []);

  const recentSurfaces = useMemo(() => {
    return recents
      .map((r) => {
        const s = surfaceForMode(r.mode);
        if (s.mode === "doors" || s.mode === "play") return null;
        return { surface: s, at: r.at };
      })
      .filter((x): x is { surface: OpenSurface; at: number } => !!x);
  }, [recents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = doors;
    if (filter === "recent") {
      const modes = new Set(recentSurfaces.map((r) => r.surface.mode));
      list = doors.filter((d) => modes.has(d.mode));
      // Keep recents order
      list = recentSurfaces.map((r) => r.surface).filter((s) => doors.some((d) => d.mode === s.mode));
    } else if (filter !== "all") {
      list = doors.filter((d) => d.group === filter);
    }
    if (!q) return list;
    return list.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.blurb.toLowerCase().includes(q) ||
        d.slug.includes(q) ||
        (d.tags?.some((t) => t.toLowerCase().includes(q)) ?? false),
    );
  }, [doors, filter, query, recentSurfaces]);

  const byGroup = HUB_GROUP_ORDER.map((g) => ({
    group: g,
    label: SURFACE_GROUP_LABEL[g],
    items: filtered.filter((d) => d.group === g),
  })).filter((g) => g.items.length > 0);

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
    recordRecentPlay(mode);
    setRecents(getRecentPlays());
    onEnter(mode);
  };

  const launchMode = (mode: Exclude<AppMode, "doors" | "play">) => {
    recordRecentPlay(mode);
    setRecents(getRecentPlays());
    onEnter(mode);
  };

  return (
    <div className="steam-lib" data-testid="steam-library" data-tab={tab}>
      {/* ── Top bar ── */}
      <header className="steam-top">
        <div className="steam-top-left">
          <img className="steam-logo" src={assetUrl("logo.svg")} alt="" width={28} height={28} draggable={false} />
          <span className="steam-brand">
            GRUDGE<span className="steam-brand-accent">OPEN</span>
          </span>
          <nav className="steam-top-nav" aria-label="Primary">
            <button
              type="button"
              className={`steam-top-link ${tab === "library" ? "active" : ""}`}
              onClick={() => setTab("library")}
            >
              Library
            </button>
            <button
              type="button"
              className={`steam-top-link ${tab === "store" ? "active" : ""}`}
              onClick={() => setTab("store")}
            >
              Store
            </button>
            <button
              type="button"
              className={`steam-top-link ${tab === "community" ? "active" : ""}`}
              onClick={() => setTab("community")}
            >
              Community
            </button>
          </nav>
        </div>
        <div className="steam-top-right">
          <button
            type="button"
            className={`steam-friends-toggle ${friendsOpen ? "active" : ""}`}
            onClick={() => setFriendsOpen((v) => !v)}
            title={friendsOpen ? "Hide friends" : "Show friends"}
          >
            <Users size={14} />
            <span>Friends</span>
          </button>
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

      {/* Mobile primary tabs (desktop uses top nav) */}
      <div className="steam-mobile-tabs" role="tablist" aria-label="Hub sections">
        {(["library", "store", "community"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "library" ? "Library" : t === "store" ? "Store" : "Community"}
          </button>
        ))}
      </div>

      <div className={`steam-body ${friendsOpen ? "steam-body--friends" : ""}`}>
        {/* ── Left sidebar (library only) ── */}
        {tab === "library" && (
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
              <button
                type="button"
                className={`steam-side-item ${filter === "recent" ? "active" : ""}`}
                onClick={() => setFilter("recent")}
              >
                <Clock size={15} />
                <span>Recently played</span>
                <span className="steam-side-count">{recentSurfaces.length}</span>
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
              <button type="button" className="steam-side-store-link" onClick={() => setTab("store")}>
                <Store size={14} />
                Browse fleet store
              </button>
            </div>
          </aside>
        )}

        {/* ── Main pane ── */}
        <main className="steam-main">
          {tab === "store" && <StoreView onPlayNative={launchMode} />}

          {tab === "community" && (
            <div className="steam-community">
              <section className="steam-community-hero">
                <h1>Community</h1>
                <p>
                  Your fleet party, multiplayer lobby, and GRUDOX arcade live here. Sign in with Grudge ID to
                  load characters as your party roster.
                </p>
                <div className="steam-hero-actions">
                  <button type="button" className="steam-play" onClick={() => launchMode("lobby")}>
                    <Play size={16} fill="currentColor" />
                    Open Lobby
                  </button>
                  <a
                    className="steam-secondary steam-secondary-link"
                    href="https://grudox.grudge-studio.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GRUDOX Arcade
                  </a>
                </div>
              </section>
              <div className="steam-community-grid">
                <FriendsPanel
                  account={account}
                  characters={snap.characters}
                  selectedCharacterId={snap.selectedCharacterId}
                  currentTitle="Grudge Open"
                  onOpenLobby={() => launchMode("lobby")}
                  onSelectCharacter={(id) => gameSession.selectCharacter(id)}
                />
                <section className="steam-community-links">
                  <h2 className="steam-shelf-title">Quick joins</h2>
                  <button type="button" className="steam-community-card" onClick={() => launchMode("brawl")}>
                    <strong>Ruins Brawler</strong>
                    <span>Live co-op survival</span>
                  </button>
                  <button type="button" className="steam-community-card" onClick={() => launchMode("zones")}>
                    <strong>GRUDOX Zones</strong>
                    <span>Fleet arcade launcher</span>
                  </button>
                  <button type="button" className="steam-community-card" onClick={() => launchMode("voxgrudge-native")}>
                    <strong>VoxGrudge World</strong>
                    <span>Open multiplayer world</span>
                  </button>
                  <a
                    className="steam-community-card"
                    href="https://character.grudge-studio.com?era=warlords&from=gameopen"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>Character Studio</strong>
                    <span>Create roster heroes</span>
                  </a>
                </section>
              </div>
            </div>
          )}

          {tab === "library" && (
            <>
              {/* Recently played strip */}
              {filter !== "recent" && recentSurfaces.length > 0 && (
                <section className="steam-recents">
                  <div className="steam-recents-head">
                    <h2 className="steam-shelf-title">
                      <Clock size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                      Recently played
                    </h2>
                    <button type="button" className="steam-text-btn" onClick={() => setFilter("recent")}>
                      View all
                    </button>
                  </div>
                  <div className="steam-recents-row">
                    {recentSurfaces.slice(0, 8).map(({ surface, at }) => (
                      <button
                        key={surface.mode}
                        type="button"
                        className="steam-recent-chip"
                        style={{ "--card-accent": surface.accent ?? "#66c0f4" } as React.CSSProperties}
                        onClick={() => setSelected(surface)}
                        onDoubleClick={() => launch(surface)}
                        title={`${surface.title} · ${formatRecentAt(at)}`}
                      >
                        <img
                          src={surface.poster ? poster(surface.poster) : poster("lobby")}
                          alt=""
                          draggable={false}
                        />
                        <span className="steam-recent-chip-meta">
                          <strong>{surface.title}</strong>
                          <em>{formatRecentAt(at)}</em>
                        </span>
                        <span
                          className="steam-recent-play"
                          onClick={(e) => {
                            e.stopPropagation();
                            launch(surface);
                          }}
                          role="presentation"
                        >
                          <Play size={12} fill="currentColor" />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

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

              {filter === "recent" ? (
                <section className="steam-shelf">
                  <h2 className="steam-shelf-title">Recently played</h2>
                  {recentSurfaces.length === 0 ? (
                    <div className="steam-empty">
                      <p>No recent launches yet — play a title to fill this list.</p>
                    </div>
                  ) : (
                    <div className="steam-grid">
                      {filtered.map((surface) => {
                        const at = recentSurfaces.find((r) => r.surface.mode === surface.mode)?.at;
                        return (
                          <LibraryCard
                            key={surface.mode}
                            surface={surface}
                            active={featured?.mode === surface.mode}
                            onSelect={() => setSelected(surface)}
                            onLaunch={() => launch(surface)}
                            readyLabel={at ? formatRecentAt(at) : "Ready"}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : (
                byGroup.map(({ group, label, items }) => (
                  <section key={group} className="steam-shelf" data-group={group}>
                    <h2 className="steam-shelf-title">{label}</h2>
                    <div className="steam-grid">
                      {items.map((surface) => (
                        <LibraryCard
                          key={surface.mode}
                          surface={surface}
                          active={featured?.mode === surface.mode}
                          onSelect={() => setSelected(surface)}
                          onLaunch={() => launch(surface)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}

              {filtered.length === 0 && filter !== "recent" && (
                <div className="steam-empty">
                  <p>No titles match your search.</p>
                  <button
                    type="button"
                    className="steam-secondary"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Friends rail ── */}
        {friendsOpen && tab !== "community" && (
          <FriendsPanel
            account={account}
            characters={snap.characters}
            selectedCharacterId={snap.selectedCharacterId}
            currentTitle={tab === "store" ? "Store" : featured?.title ?? "Library"}
            compact
            onOpenLobby={() => launchMode("lobby")}
            onSelectCharacter={(id) => gameSession.selectCharacter(id)}
          />
        )}
      </div>

      <footer className="steam-status">
        <span className="steam-status-dot" />
        <span>Ready</span>
        <span className="steam-status-sep">·</span>
        <span>
          {tab === "store" ? "Store" : tab === "community" ? "Community" : "Library"}
          {recentSurfaces[0] ? ` · Last: ${recentSurfaces[0].surface.title}` : ""}
        </span>
        <span className="steam-status-grow" />
        <span className="steam-status-hint">
          {charCount > 0 ? `${charCount} party characters` : "Sign in for party roster"} · Install for home-screen
        </span>
      </footer>
    </div>
  );
}

function LibraryCard({
  surface,
  active,
  onSelect,
  onLaunch,
  readyLabel = "Ready",
}: {
  surface: OpenSurface;
  active: boolean;
  onSelect: () => void;
  onLaunch: () => void;
  readyLabel?: string;
}) {
  const img = surface.poster ? poster(surface.poster) : poster("lobby");
  const tags = surface.tags ?? (["Open", "Lab"] as const);
  const accent = surface.accent ?? "#66c0f4";
  return (
    <article
      className={`steam-card ${active ? "active" : ""}`}
      style={{ "--card-accent": accent } as React.CSSProperties}
      onClick={onSelect}
      onDoubleClick={onLaunch}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
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
          <span className="steam-card-ready">{readyLabel}</span>
          <span className="steam-card-slug">{pathForMode(surface.mode)}</span>
        </div>
      </div>
      <button
        type="button"
        className="steam-card-launch"
        onClick={(e) => {
          e.stopPropagation();
          onLaunch();
        }}
      >
        Play
      </button>
    </article>
  );
}
