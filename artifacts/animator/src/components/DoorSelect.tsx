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
    </div>
  );
}
