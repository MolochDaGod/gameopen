import type { CreatePostPayload } from "@workspace/api-client-react";
import { WEAPONS } from "../three/assets";
import type { WeaponId } from "../three/types";
import {
  PLACEABLE_TERRAIN,
  PROP_LIST,
  type BrushState,
  type DeployableKind,
  type DeployableNode,
  type Difficulty,
  type EditorStats,
  type GizmoMode,
  type PieceShape,
} from "../three/voxel/types";
import { PostToGallery } from "./PostToGallery";
import { VoxelHierarchyPanel } from "./VoxelHierarchyPanel";

const GIZMO_MODES: { id: GizmoMode; label: string; glyph: string; key: string }[] = [
  { id: "translate", label: "Move", glyph: "✥", key: "G" },
  { id: "rotate", label: "Rotate", glyph: "↻", key: "R" },
  { id: "scale", label: "Scale", glyph: "⤢", key: "E" },
];

const SHAPES: { id: PieceShape; label: string; glyph: string }[] = [
  { id: "block", label: "Block", glyph: "▦" },
  { id: "slab", label: "Slab", glyph: "▭" },
  { id: "wall", label: "Wall", glyph: "▯" },
  { id: "pillar", label: "Pillar", glyph: "❘" },
  { id: "ramp", label: "Ramp", glyph: "◣" },
];

/** Canonical Voxel Realms place palette (mine-loader `dV` / `#/defs` terrain). */
export const PALETTE = PLACEABLE_TERRAIN.map((b) => ({
  id: b.id,
  hex: b.color,
  css: b.css,
  name: b.name,
  emoji: b.emoji,
}));

const DEPLOYABLES: { id: DeployableKind; label: string; glyph: string }[] = [
  { id: "npc", label: "NPC", glyph: "☻" },
  { id: "heavyBag", label: "Heavy Bag", glyph: "▮" },
  { id: "physicsBag", label: "Physics Bag", glyph: "⬤" },
  { id: "start", label: "Player Start", glyph: "✦" },
];

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
  { id: "elite", label: "Elite" },
];

interface Props {
  brush: BrushState;
  stats: EditorStats | null;
  dungeon: boolean;
  mapsOpen: boolean;
  onBrush: (patch: Partial<BrushState>) => void;
  onDungeon: (on: boolean) => void;
  onToggleMaps: () => void;
  onNew: () => void;
  onClear: () => void;
  onTest: () => void;
  onExit: () => void;
  /** Serialize the current map for posting to the gallery (null = empty). */
  getMapPayload: () => CreatePostPayload | null;
  // ── Select tool / hierarchy ──
  tree: DeployableNode[];
  selectedId: string | null;
  gizmoMode: GizmoMode;
  snap: boolean;
  onSelect: (id: string | null) => void;
  onGizmoMode: (mode: GizmoMode) => void;
  onSnap: (on: boolean) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onFocusSelected: () => void;
}

export function VoxelEditorUI({
  brush,
  stats,
  dungeon,
  mapsOpen,
  onBrush,
  onDungeon,
  onToggleMaps,
  onNew,
  onClear,
  onTest,
  onExit,
  getMapPayload,
  tree,
  selectedId,
  gizmoMode,
  snap,
  onSelect,
  onGizmoMode,
  onSnap,
  onDeleteSelected,
  onDuplicateSelected,
  onFocusSelected,
}: Props) {
  const canTest = !!stats?.hasStart;
  const selectedNode = tree.find((n) => n.id === selectedId) ?? null;
  return (
    <>
      <div className="ve-topbar">
        <span className="brand">
          WORLD<span className="brand-accent">BUILDER</span>
        </span>
        <label className={`ve-dungeon ${dungeon ? "on" : ""}`}>
          <input type="checkbox" checked={dungeon} onChange={(e) => onDungeon(e.target.checked)} />
          Custom Dungeon
        </label>
        <div className="ve-top-actions">
          <button className="ve-btn" onClick={onNew} title="Pick a starting map">
            New
          </button>
          <button className={`ve-btn ${mapsOpen ? "on" : ""}`} onClick={onToggleMaps}>
            Maps
          </button>
          <button className="ve-btn ve-danger" onClick={onClear}>
            Clear
          </button>
          <PostToGallery
            kind="dungeon"
            getPayload={getMapPayload}
            defaultName="My Map"
            label="Post"
            className="ve-btn"
          />
          <button
            className="ve-btn ve-play"
            onClick={onTest}
            disabled={!canTest}
            title={
              canTest
                ? "Play — same Danger Room camera, loco, weapons, skills, FX & anims (no admin tools)"
                : "Place a Player Start first"
            }
          >
            ▶ Play
          </button>
          <button className="ve-btn" onClick={onExit}>
            ⬑ Doors
          </button>
        </div>
      </div>

      <div className="ve-panel">
        <div className="ve-tabs">
          <button
            className={`ve-tab ${brush.tool === "block" ? "on" : ""}`}
            onClick={() => onBrush({ tool: "block" })}
          >
            Build
          </button>
          <button
            className={`ve-tab ${brush.tool === "deploy" ? "on" : ""}`}
            onClick={() => onBrush({ tool: "deploy" })}
          >
            Deploy
          </button>
          <button
            className={`ve-tab ${brush.tool === "select" ? "on" : ""}`}
            onClick={() => onBrush({ tool: "select" })}
          >
            Select
          </button>
        </div>

        {brush.tool === "block" && (
          <>
            <div className="ve-section">
              <h4>Shape</h4>
              <div className="ve-grid">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    className={`ve-opt ${brush.shape === s.id ? "active" : ""}`}
                    onClick={() => onBrush({ shape: s.id })}
                  >
                    <span className="ve-glyph">{s.glyph}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ve-section">
              <h4>Block type</h4>
              <p className="ve-hint" style={{ fontSize: 11, opacity: 0.7, margin: "0 0 6px" }}>
                Voxel Realms canonical ·{" "}
                <a
                  href="https://mine-loader.vercel.app/#/defs"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit" }}
                >
                  Codex
                </a>
              </p>
              <div className="ve-swatches">
                {PALETTE.map((c) => (
                  <button
                    key={c.id}
                    className={`ve-swatch ${brush.blockType === c.id ? "active" : ""}`}
                    style={{ background: c.css }}
                    onClick={() => onBrush({ blockType: c.id, color: c.hex })}
                    aria-label={c.name}
                    title={`${c.emoji} ${c.name} (${c.id})`}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {brush.tool === "deploy" && (
          <>
            <div className="ve-section">
              <h4>Deployable</h4>
              <div className="ve-grid">
                {DEPLOYABLES.map((d) => (
                  <button
                    key={d.id}
                    className={`ve-opt ${brush.deployKind === d.id ? "active" : ""}`}
                    onClick={() => onBrush({ deployKind: d.id })}
                  >
                    <span className="ve-glyph">{d.glyph}</span>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ve-section">
              <h4>Benches</h4>
              <div className="ve-grid">
                {PROP_LIST.filter((p) => p.category === "bench").map((p) => (
                  <button
                    key={p.id}
                    className={`ve-opt ${
                      brush.deployKind === "prop" && brush.prop === p.id ? "active" : ""
                    }`}
                    onClick={() => onBrush({ deployKind: "prop", prop: p.id })}
                  >
                    <span className="ve-glyph">{p.glyph}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ve-section">
              <h4>Build Helpers</h4>
              <div className="ve-grid">
                {PROP_LIST.filter((p) => p.category === "build").map((p) => (
                  <button
                    key={p.id}
                    className={`ve-opt ${
                      brush.deployKind === "prop" && brush.prop === p.id ? "active" : ""
                    }`}
                    onClick={() => onBrush({ deployKind: "prop", prop: p.id })}
                  >
                    <span className="ve-glyph">{p.glyph}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {brush.deployKind === "npc" && (
              <>
                <div className="ve-section">
                  <h4>Weapon</h4>
                  <div className="ve-grid ve-grid-3">
                    {WEAPONS.map((w) => (
                      <button
                        key={w.id}
                        className={`ve-opt ve-opt-sm ${brush.weapon === (w.id as WeaponId) ? "active" : ""}`}
                        onClick={() => onBrush({ weapon: w.id as WeaponId })}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
                {dungeon && (
                  <div className="ve-section">
                    <h4>Difficulty</h4>
                    <div className="ve-grid">
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d.id}
                          className={`ve-opt ve-diff ve-diff-${d.id} ${
                            brush.difficulty === d.id ? "active" : ""
                          }`}
                          onClick={() => onBrush({ difficulty: d.id })}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {brush.tool === "select" && (
          <>
            <div className="ve-section">
              <h4>Transform</h4>
              <div className="ve-grid ve-grid-3">
                {GIZMO_MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`ve-opt ve-opt-sm ${gizmoMode === m.id ? "active" : ""}`}
                    onClick={() => onGizmoMode(m.id)}
                    disabled={!selectedNode}
                    title={`${m.label} (${m.key})`}
                  >
                    <span className="ve-glyph">{m.glyph}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ve-section">
              <label className={`ve-snap ${snap ? "on" : ""}`}>
                <input type="checkbox" checked={snap} onChange={(e) => onSnap(e.target.checked)} />
                Snap to grid
              </label>
            </div>
            <div className="ve-section">
              <h4>Selection</h4>
              {selectedNode ? (
                <>
                  <p className="ve-sel-name">{selectedNode.label}</p>
                  <div className="ve-grid ve-grid-3">
                    <button className="ve-opt ve-opt-sm" onClick={onFocusSelected} title="Frame camera">
                      Focus
                    </button>
                    <button
                      className="ve-opt ve-opt-sm"
                      onClick={onDuplicateSelected}
                      disabled={selectedNode.kind === "start"}
                      title="Clone this object"
                    >
                      Clone
                    </button>
                    <button
                      className="ve-opt ve-opt-sm ve-diff-elite"
                      onClick={onDeleteSelected}
                      title="Delete (Del)"
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <p className="dim">Click an object in the scene to select it.</p>
              )}
            </div>
          </>
        )}

        <div className="ve-hint">
          {brush.tool === "select" ? (
            <>
              <p>
                <b>LMB</b> select · drag the gizmo to move/rotate/scale · <b>RMB drag</b> orbit · <b>wheel</b> zoom
              </p>
              <p className="dim">
                <b>G</b> move · <b>R</b> rotate · <b>E</b> scale · <b>Del</b> delete · <b>Esc</b> deselect
              </p>
            </>
          ) : (
            <>
              <p>
                <b>LMB</b> build (hold to stack/wall/ramp) · <b>RMB drag</b> orbit · <b>RMB click</b> erase · <b>wheel</b> zoom
              </p>
              <p className="dim">
                <b>R</b> rotate piece · <b>WASD</b> pan · <b>Shift+drag</b> / middle-drag pan
              </p>
            </>
          )}
        </div>
      </div>

      {brush.tool === "select" && (
        <VoxelHierarchyPanel
          tree={tree}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={(id) => {
            onSelect(id);
            onDeleteSelected();
          }}
          onFocus={(id) => {
            onSelect(id);
            onFocusSelected();
          }}
        />
      )}

      {stats && (
        <div className="ve-stats">
          <span>▦ {stats.blocks}</span>
          <span>☻ {stats.npcs}</span>
          <span>▮ {stats.bags}</span>
          <span>⚗ {stats.props}</span>
          <span className={stats.hasStart ? "ok" : "warn"}>✦ {stats.hasStart ? "set" : "none"}</span>
        </div>
      )}
    </>
  );
}
