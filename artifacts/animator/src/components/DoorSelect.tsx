import { assetUrl } from "../lib/fleet";
import {
  type AppMode,
  type OpenSurface,
  hubDoorSurfaces,
  HUB_GROUP_ORDER,
  SURFACE_GROUP_LABEL,
  pathForMode,
} from "../lib/openRoutes";

/** Resolve a room poster from public/rooms/<name>-scene.png (CDN-aware). */
const poster = (name: string) => assetUrl(`rooms/${name}-scene.png`);

interface Props {
  onEnter: (mode: Exclude<AppMode, "doors" | "play">) => void;
}

/** One door card — poster image on top, info below. Slug shown for deep-link discoverability. */
function Door({
  surface,
  onEnter,
}: {
  surface: OpenSurface;
  onEnter: Props["onEnter"];
}) {
  const mode = surface.mode as Exclude<AppMode, "doors" | "play">;
  const img = surface.poster ? poster(surface.poster) : poster("lobby");
  const path = pathForMode(surface.mode);
  const tags = surface.tags ?? (["Open", "Lab"] as const);
  const accent = surface.accent ?? "#d4a843";

  return (
    <button
      className="door door-img"
      style={{ "--door-accent": accent } as React.CSSProperties}
      onClick={() => onEnter(mode)}
      title={`${surface.title} · open.grudge-studio.com${path}`}
      data-mode={surface.mode}
      data-slug={surface.slug || "hub"}
    >
      <div className="door-art-wrap">
        <img className="door-art" src={img} alt={surface.title} draggable={false} />
        <div className="door-art-badge">{tags[0]}</div>
      </div>
      <div className="door-info">
        <h3>{surface.title}</h3>
        <p>{surface.blurb}</p>
        <div className="door-tags">
          <span className="door-tag" style={{ color: accent }}>
            {tags[0]}
          </span>
          <span className="door-tag">{tags[1]}</span>
          <span className="door-tag door-slug">{path}</span>
        </div>
      </div>
    </button>
  );
}

/**
 * Facility entrance: poster door cards grouped by system family.
 * Catalog SSOT: `lib/openRoutes.ts` (OPEN_SURFACES).
 */
export function DoorSelect({ onEnter }: Props) {
  const doors = hubDoorSurfaces();
  const byGroup = HUB_GROUP_ORDER.map((g) => ({
    group: g,
    label: SURFACE_GROUP_LABEL[g],
    items: doors.filter((d) => d.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="doors">
      <div className="doors-head">
        <span className="brand">
          GRUDGE<span className="brand-accent">OPEN</span>
        </span>
        <p className="doors-sub">Choose your arena · deep-link any door via path slug</p>
        <p className="doors-slugs-hint">
          e.g. <code>/danger</code> <code>/voxel</code> <code>/brawl</code>{" "}
          <code>/world</code> <code>/dressing</code> <code>/lobby</code>
        </p>
      </div>

      {byGroup.map(({ group, label, items }) => (
        <section key={group} className="doors-section" data-group={group}>
          <h2 className="doors-section-title">{label}</h2>
          <div className="doors-row">
            {items.map((surface) => (
              <Door key={surface.mode} surface={surface} onEnter={onEnter} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
