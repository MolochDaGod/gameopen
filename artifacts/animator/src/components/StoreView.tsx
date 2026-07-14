/**
 * Dark Steam-style Store — fleet games & tools from one catalog.
 */
import { useMemo, useState } from "react";
import { ExternalLink, Play, Search, Sparkles } from "lucide-react";
import { assetUrl } from "../lib/fleet";
import {
  storeCatalog,
  STORE_CATEGORY_LABEL,
  STORE_CATEGORY_ORDER,
  type StoreCategory,
  type StoreItem,
} from "../lib/fleetStore";
import type { AppMode } from "../lib/openRoutes";

const poster = (name: string) => assetUrl(`rooms/${name}-scene.png`);

interface Props {
  onPlayNative: (mode: Exclude<AppMode, "doors" | "play">) => void;
}

export function StoreView({ onPlayNative }: Props) {
  const catalog = useMemo(() => storeCatalog(), []);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<StoreCategory | "all">("all");
  const [selected, setSelected] = useState<StoreItem | null>(
    () => catalog.find((i) => i.featured) ?? catalog[0] ?? null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (cat === "featured" && !item.featured) return false;
      if (cat !== "all" && cat !== "featured" && item.category !== cat) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.blurb.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [catalog, cat, query]);

  const featured = selected ?? filtered[0] ?? null;

  const launch = (item: StoreItem) => {
    if (item.nativeMode) {
      onPlayNative(item.nativeMode);
      return;
    }
    if (item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="steam-store">
      <div className="steam-store-toolbar">
        <div className="steam-store-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search store…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search store"
          />
        </div>
        <div className="steam-store-cats" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={cat === "all"}
            className={cat === "all" ? "active" : ""}
            onClick={() => setCat("all")}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cat === "featured"}
            className={cat === "featured" ? "active" : ""}
            onClick={() => setCat("featured")}
          >
            <Sparkles size={12} /> Featured
          </button>
          {STORE_CATEGORY_ORDER.filter((c) => c !== "featured").map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              className={cat === c ? "active" : ""}
              onClick={() => setCat(c)}
            >
              {STORE_CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {featured && (
        <section
          className="steam-store-hero"
          style={{ "--hero-accent": featured.tone } as React.CSSProperties}
        >
          <div className="steam-store-hero-art">
            <img
              src={featured.poster ? poster(featured.poster) : poster("lobby")}
              alt=""
              draggable={false}
            />
            <div className="steam-store-hero-fade" />
          </div>
          <div className="steam-store-hero-body">
            <div className="steam-hero-tags">
              {featured.tags.map((t) => (
                <span key={t} className="steam-pill">
                  {t}
                </span>
              ))}
              <span className="steam-pill steam-pill--price">{featured.priceLabel}</span>
            </div>
            <h1>{featured.title}</h1>
            <p>{featured.blurb}</p>
            <div className="steam-hero-actions">
              <button type="button" className="steam-play" onClick={() => launch(featured)}>
                {featured.nativeMode ? (
                  <>
                    <Play size={16} fill="currentColor" /> Play
                  </>
                ) : (
                  <>
                    <ExternalLink size={16} /> Launch
                  </>
                )}
              </button>
              {featured.nativeMode && featured.href && (
                <a className="steam-secondary steam-secondary-link" href={featured.href} target="_blank" rel="noreferrer">
                  Open fleet page
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {STORE_CATEGORY_ORDER.map((category) => {
        const items =
          category === "featured"
            ? filtered.filter((i) => i.featured)
            : filtered.filter((i) => i.category === category && cat !== "featured");
        // When browsing a single non-featured cat, only show that shelf
        if (cat !== "all" && cat !== "featured" && category !== cat) return null;
        if (cat === "featured" && category !== "featured") return null;
        if (cat === "all" && category === "featured") {
          // featured shelf only when items exist
        }
        if (items.length === 0) return null;
        return (
          <section key={category} className="steam-shelf">
            <h2 className="steam-shelf-title">{STORE_CATEGORY_LABEL[category]}</h2>
            <div className="steam-grid steam-store-grid">
              {items.map((item) => {
                const active = featured?.id === item.id;
                return (
                  <article
                    key={item.id}
                    className={`steam-card steam-store-card ${active ? "active" : ""}`}
                    style={{ "--card-accent": item.tone } as React.CSSProperties}
                    onClick={() => setSelected(item)}
                    onDoubleClick={() => launch(item)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(item);
                      }
                    }}
                  >
                    <div className="steam-card-art">
                      <img
                        src={item.poster ? poster(item.poster) : poster("lobby")}
                        alt=""
                        draggable={false}
                      />
                      <span className="steam-card-badge">{item.priceLabel}</span>
                    </div>
                    <div className="steam-card-meta">
                      <h3>{item.title}</h3>
                      <p>{item.blurb}</p>
                      <div className="steam-card-foot">
                        <span className="steam-card-ready" style={{ color: item.tone }}>
                          {item.tags[0]}
                        </span>
                        <button
                          type="button"
                          className="steam-card-launch"
                          style={{ opacity: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            launch(item);
                          }}
                        >
                          {item.nativeMode ? "Play" : "Launch"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="steam-empty">
          <p>No store items match your search.</p>
          <button type="button" className="steam-secondary" onClick={() => { setQuery(""); setCat("all"); }}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
