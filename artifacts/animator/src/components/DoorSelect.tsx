interface Props {
  onEnter: (
    mode: "danger" | "voxel" | "editor" | "lobby" | "ledmask" | "zones" | "brawl" | "mimic",
  ) => void;
}

/**
 * The facility entrance: glowing doors into every surface. Danger Room (live
 * combat sandbox), Voxel Map Editor, Dressing Room (models, weapons, anims &
 * effects), the multiplayer / community Lobby, GRUDOX Zones (the shared GRUDOX
 * world), the native Ruins Brawler co-op mode, and the Voxel LED Mask studio.
 */
export function DoorSelect({ onEnter }: Props) {
  return (
    <div className="doors">
      <div className="doors-head">
        <span className="brand">
          DANGER<span className="brand-accent">ROOM</span>
        </span>
        <p className="doors-sub">Choose a door</p>
      </div>

      <div className="doors-row">
        <button className="door door-combat" onClick={() => onEnter("danger")}>
          <div className="door-frame">
            <div className="door-glyph">⚔</div>
          </div>
          <h3>Danger Room</h3>
          <p>Live combat sandbox — fight training targets with every weapon and skill.</p>
        </button>

        <button className="door door-editor" onClick={() => onEnter("voxel")}>
          <div className="door-frame">
            <div className="door-glyph">▦</div>
          </div>
          <h3>Voxel Editor</h3>
          <p>Build a custom map — voxel blocks, deployable NPCs &amp; bags, and dungeon authoring.</p>
        </button>

        <button className="door door-scene" onClick={() => onEnter("editor")}>
          <div className="door-frame">
            <div className="door-glyph">♟</div>
          </div>
          <h3>Dressing Room</h3>
          <p>Dress up a character — swap models &amp; skins, attach weapons &amp; gear, preview animations and effects.</p>
        </button>

        <button className="door door-lobby" onClick={() => onEnter("lobby")}>
          <div className="door-frame">
            <div className="door-glyph">☰</div>
          </div>
          <h3>The Lobby</h3>
          <p>Join a multiplayer room, or browse community maps &amp; scenes to play instantly.</p>
        </button>

        <button className="door door-zones" onClick={() => onEnter("zones")}>
          <div className="door-frame">
            <div className="door-glyph">◆</div>
          </div>
          <h3>GRUDOX Zones</h3>
          <p>Enter the shared GRUDOX world — brawler, racer, sword survival &amp; the open world, character in tow.</p>
        </button>

        <button className="door door-brawl" onClick={() => onEnter("brawl")}>
          <div className="door-frame">
            <div className="door-glyph">⛨</div>
          </div>
          <h3>Ruins Brawler</h3>
          <p>Top-down twin-stick co-op survival — live multiplayer in the GRUDOX ruins.</p>
        </button>

        <button className="door door-mimic" onClick={() => onEnter("mimic")}>
          <div className="door-frame">
            <div className="door-glyph">🛢</div>
          </div>
          <h3>Test Dungeon</h3>
          <p>Vol scene — open a barrel and fight the Mimic (fast melee lunge + arcing acid AoE).</p>
        </button>

        <button className="door door-ledmask" onClick={() => onEnter("ledmask")}>
          <div className="door-frame">
            <div className="door-glyph">▥</div>
          </div>
          <h3>Voxel LED Mask</h3>
          <p>Drive a cube voxel head with an LED visor — pick expressions, run a scrolling banner, trigger poses.</p>
        </button>
      </div>
    </div>
  );
}
