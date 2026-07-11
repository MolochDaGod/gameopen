import { assetUrl } from "../lib/fleet";

/** Resolve a room poster from public/rooms/<name>-scene.png (CDN-aware). */
const poster = (name: string) => assetUrl(`rooms/${name}-scene.png`);

interface Props {
  onEnter: (
    mode:
      | "danger" | "voxel" | "editor" | "lobby" | "ledmask"
      | "zones" | "brawl" | "mimic" | "genesis" | "voxgrudge-native",
  ) => void;
}

/** One door card — poster image on top, info below. */
function Door({
  mode, label, img, blurb, tags, accent, onEnter,
}: {
  mode: Parameters<Props["onEnter"]>[0];
  label: string;
  img: string;
  blurb: string;
  tags: [string, string];
  accent: string;
  onEnter: Props["onEnter"];
}) {
  return (
    <button
      className={`door door-img`}
      style={{ "--door-accent": accent } as React.CSSProperties}
      onClick={() => onEnter(mode)}
      title={label}
    >
      <div className="door-art-wrap">
        <img className="door-art" src={img} alt={label} draggable={false} />
        <div className="door-art-badge">{tags[0]}</div>
      </div>
      <div className="door-info">
        <h3>{label}</h3>
        <p>{blurb}</p>
        <div className="door-tags">
          <span className="door-tag" style={{ color: accent }}>{tags[0]}</span>
          <span className="door-tag">{tags[1]}</span>
        </div>
      </div>
    </button>
  );
}

/**
 * The facility entrance: 10 poster-image door cards.
 * Each card shows a full-bleed dark scene poster (rooms/*-scene.png) at top,
 * with title + blurb + tags in the info strip below.
 */
export function DoorSelect({ onEnter }: Props) {
  return (
    <div className="doors">
      <div className="doors-head">
        <span className="brand">
          GRUDGE<span className="brand-accent">OPEN</span>
        </span>
        <p className="doors-sub">Choose your arena</p>
      </div>

      <div className="doors-row">
        <Door mode="danger"         label="Danger Room"      img={poster("danger")}    blurb="Live combat sandbox — fight training targets with every weapon and skill."                              tags={["★ Combat",   "PvP"]}        accent="#ff7a7a" onEnter={onEnter} />
        <Door mode="genesis"        label="Warlord Genesis"  img={poster("genesis")}   blurb="Choose your race. Human, Orc, Elf, Dwarf, Barbarian or Undead — survive 4 waves to claim the title." tags={["★ New",      "Boss Rush"]}  accent="#ffd24d" onEnter={onEnter} />
        <Door mode="brawl"          label="Ruins Brawler"    img={poster("brawl")}     blurb="3D twin-stick co-op survival — live multiplayer in the GRUDOX ruins arena."                           tags={["3D Live",    "Co-op"]}      accent="#4fc3ff" onEnter={onEnter} />
        <Door mode="mimic"          label="Test Dungeon"     img={poster("mimic")}     blurb="Vol scene — open a barrel and fight the Mimic (fast melee lunge + arcing acid AoE)."                  tags={["Encounter",  "Boss"]}       accent="#9cff5a" onEnter={onEnter} />
        <Door mode="voxel"          label="Voxel Editor"     img={poster("voxel")}     blurb="Build a custom map — voxel blocks, deployable NPCs & bags, and dungeon authoring."                    tags={["Build",      "Create"]}     accent="#7ee0a0" onEnter={onEnter} />
        <Door mode="voxgrudge-native" label="VoxGrudge"      img={poster("voxgrudge")} blurb="Open voxel world — explore, build, and party up with the multiplayer open world server."              tags={["★ New",      "Open World"]} accent="#5fe0ff" onEnter={onEnter} />
        <Door mode="editor"         label="Dressing Room"    img={poster("dressing")}  blurb="Dress up a character — swap models & skins, attach weapons & gear, preview animations and effects."   tags={["Customize",  "Preview"]}    accent="#ffb24d" onEnter={onEnter} />
        <Door mode="lobby"          label="The Lobby"        img={poster("lobby")}     blurb="Join a multiplayer room, or browse community maps & scenes to play instantly."                        tags={["Multiplayer","Community"]}  accent="#9d8bff" onEnter={onEnter} />
        <Door mode="zones"          label="GRUDOX Zones"     img={poster("zones")}     blurb="Enter the shared GRUDOX world — brawler, racer, sword survival & the open world."                     tags={["External",   "GRUDOX"]}     accent="#5fe0ff" onEnter={onEnter} />
        <Door mode="ledmask"        label="LED Mask"         img={poster("avatar")}    blurb="Drive a cube voxel head with an LED visor — pick expressions, run a scrolling banner, trigger poses." tags={["AI Face",    "LED"]}        accent="#a78bff" onEnter={onEnter} />
      </div>
    </div>
  );
}
