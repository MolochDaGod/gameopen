import type { CSSProperties } from "react";

const TAG_STYLE: CSSProperties = {
  fontSize: 11,
  opacity: 0.8,
  padding: "2px 7px",
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)",
};

interface Props {
  onEnter: (
    mode: "danger" | "voxel" | "editor" | "lobby" | "ledmask" | "zones" | "brawl" | "mimic" | "genesis" | "voxgrudge-native",
  ) => void;
}

/**
 * The facility entrance: gradient door cards into every surface.
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
        <p className="doors-sub">Choose your arena</p>
      </div>

      <div className="doors-row">
        <button className="door door-combat" onClick={() => onEnter("danger")} title="Danger Room">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #1a0808 0%, #2d0f0f 100%)" }}>
            <div className="door-glyph" style={{ color: "#ff7a7a", fontSize: 48 }}>⚔</div>
          </div>
          <h3>Danger Room</h3>
          <p>Live combat sandbox — fight training targets with every weapon and skill.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#ff7a7a" }}>★ Combat</span>
            <span style={TAG_STYLE}>PvP</span>
          </div>
        </button>

        <button className="door door-genesis" onClick={() => onEnter("genesis")} title="Warlord Genesis">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #1a1400 0%, #2d2200 100%)" }}>
            <div className="door-glyph" style={{ color: "#ffd24d", fontSize: 40 }}>⚜</div>
          </div>
          <h3>Warlord Genesis</h3>
          <p>Choose your race — Human, Orc, Elf, Dwarf, Barbarian or Undead. Survive 4 waves to claim the title.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#ffd24d" }}>★ New</span>
            <span style={TAG_STYLE}>Boss Rush</span>
          </div>
        </button>

        <button className="door door-brawl" onClick={() => onEnter("brawl")} title="Ruins Brawler">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #0d1018 0%, #182030 100%)" }}>
            <div className="door-glyph" style={{ color: "#4fc3ff", fontSize: 40 }}>⛨</div>
          </div>
          <h3>Ruins Brawler</h3>
          <p>3D twin-stick co-op survival — live multiplayer in the GRUDOX ruins arena.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#4fc3ff" }}>3D Live</span>
            <span style={TAG_STYLE}>Co-op</span>
          </div>
        </button>

        <button className="door door-mimic" onClick={() => onEnter("mimic")} title="Test Dungeon">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #0a1008 0%, #0f2010 100%)" }}>
            <div className="door-glyph" style={{ color: "#9cff5a", fontSize: 40 }}>🛢</div>
          </div>
          <h3>Test Dungeon</h3>
          <p>Vol scene — open a barrel and fight the Mimic (fast melee lunge + arcing acid AoE).</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#9cff5a" }}>Encounter</span>
            <span style={TAG_STYLE}>Boss</span>
          </div>
        </button>

        <button className="door door-editor" onClick={() => onEnter("voxel")} title="Voxel Editor">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #081408 0%, #0e2014 100%)" }}>
            <div className="door-glyph" style={{ color: "#7ee0a0", fontSize: 40 }}>▦</div>
          </div>
          <h3>Voxel Editor</h3>
          <p>Build a custom map — voxel blocks, deployable NPCs &amp; bags, and dungeon authoring.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#7ee0a0" }}>Build</span>
            <span style={TAG_STYLE}>Create</span>
          </div>
        </button>

        <button className="door door-voxgrudge" onClick={() => onEnter("voxgrudge-native")} title="VoxGrudge Open World">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #081418 0%, #0e2028 100%)" }}>
            <div className="door-glyph" style={{ color: "#5fe0ff", fontSize: 40 }}>◈</div>
          </div>
          <h3>VoxGrudge</h3>
          <p>Open voxel world — explore, build, and party up with the multiplayer open world server.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#5fe0ff" }}>★ New</span>
            <span style={TAG_STYLE}>Open World</span>
          </div>
        </button>

        <button className="door door-scene" onClick={() => onEnter("editor")} title="Dressing Room">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #140c04 0%, #241808 100%)" }}>
            <div className="door-glyph" style={{ color: "#ffb24d", fontSize: 40 }}>♟</div>
          </div>
          <h3>Dressing Room</h3>
          <p>Dress up a character — swap models &amp; skins, attach weapons &amp; gear, preview animations and effects.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#ffb24d" }}>Customize</span>
            <span style={TAG_STYLE}>Preview</span>
          </div>
        </button>

        <button className="door door-lobby" onClick={() => onEnter("lobby")} title="The Lobby">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #0e0814 0%, #180e26 100%)" }}>
            <div className="door-glyph" style={{ color: "#9d8bff", fontSize: 40 }}>☰</div>
          </div>
          <h3>The Lobby</h3>
          <p>Join a multiplayer room, or browse community maps &amp; scenes to play instantly.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#9d8bff" }}>Multiplayer</span>
            <span style={TAG_STYLE}>Community</span>
          </div>
        </button>

        <button className="door door-zones" onClick={() => onEnter("zones")} title="GRUDOX Zones">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #081018 0%, #0e1e30 100%)" }}>
            <div className="door-glyph" style={{ color: "#5fe0ff", fontSize: 40 }}>◆</div>
          </div>
          <h3>GRUDOX Zones</h3>
          <p>Enter the shared GRUDOX world — brawler, racer, sword survival &amp; the open world.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#5fe0ff" }}>External</span>
            <span style={TAG_STYLE}>GRUDOX</span>
          </div>
        </button>

        <button className="door door-ledmask" onClick={() => onEnter("ledmask")} title="Voxel LED Mask">
          <div className="door-frame" style={{ background: "linear-gradient(135deg, #040c14 0%, #081826 100%)" }}>
            <div className="door-glyph" style={{ color: "#5fe0ff", fontSize: 40 }}>▥</div>
          </div>
          <h3>Voxel LED Mask</h3>
          <p>Drive a cube voxel head with an LED visor — pick expressions, run a scrolling banner, trigger poses.</p>
          <div className="door-tags">
            <span style={{ ...TAG_STYLE, color: "#5fe0ff" }}>AI Face</span>
            <span style={TAG_STYLE}>LED</span>
          </div>
        </button>
      </div>
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
