/**
 * Worldbuilder — Unity-like voxel map editor shell.
 *
 * Layout: menu bar · left project/assets · center scene · right inspector ·
 * bottom console/AI script. Hierarchy always visible. Professional dark chrome.
 */
import { useEffect, useMemo, useState } from "react";
import type { CreatePostPayload } from "@workspace/api-client-react";
import {
  Box,
  Bot,
  Braces,
  ChevronRight,
  Copy,
  Crosshair,
  Eraser,
  Eye,
  FolderTree,
  Layers,
  Move,
  Package,
  Play,
  RotateCcw,
  RotateCw,
  Scaling,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
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
  type PropCategory,
  type PropId,
} from "../three/voxel/types";
import {
  BEHAVIOR_CATALOG,
  formatBehaviorReport,
  getBehaviorForNpc,
  setBehaviorForNpc,
  type BehaviorId,
  type NpcBehavior,
} from "../three/voxel/voxelBehavior";
import { PostToGallery } from "./PostToGallery";
import "./voxelEditor.css";

const GIZMO_MODES: { id: GizmoMode; label: string; Icon: typeof Move; key: string }[] = [
  { id: "translate", label: "Move", Icon: Move, key: "G" },
  { id: "rotate", label: "Rotate", Icon: RotateCw, key: "R" },
  { id: "scale", label: "Scale", Icon: Scaling, key: "E" },
];

const SHAPES: { id: PieceShape; label: string; glyph: string }[] = [
  { id: "block", label: "Block", glyph: "▦" },
  { id: "slab", label: "Slab", glyph: "▭" },
  { id: "wall", label: "Wall", glyph: "▯" },
  { id: "pillar", label: "Pillar", glyph: "❘" },
  { id: "ramp", label: "Ramp", glyph: "◣" },
];

export const PALETTE = PLACEABLE_TERRAIN.map((b: (typeof PLACEABLE_TERRAIN)[number]) => ({
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

const PROP_CATS: { id: PropCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bench", label: "Benches" },
  { id: "build", label: "Build" },
  { id: "farm", label: "Farm" },
  { id: "camp", label: "Camp" },
  { id: "road", label: "Roads" },
];

type LeftTab = "blocks" | "props" | "deploy" | "project";
type RightTab = "inspector" | "behavior" | "script";
type BottomTab = "console" | "shortcuts";

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
  getMapPayload: () => CreatePostPayload | null;
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

export function VoxelEditorUI(props: Props) {
  const {
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
  } = props;

  const [leftTab, setLeftTab] = useState<LeftTab>("blocks");
  const [rightTab, setRightTab] = useState<RightTab>("inspector");
  const [bottomTab, setBottomTab] = useState<BottomTab>("console");
  const [assetQ, setAssetQ] = useState("");
  const [propCat, setPropCat] = useState<PropCategory | "all">("all");
  const [log, setLog] = useState<string[]>(() => [
    "Worldbuilder ready — Unity-style map authoring",
    "Tip: place ✦ Player Start, then ▶ Play for Danger Room combat UX",
    "AI: open Companion dock — Forge tools (set_block_type, set_npc_behavior, …)",
  ]);
  const [behaviorTick, setBehaviorTick] = useState(0);

  const canTest = !!stats?.hasStart;
  const selectedNode = tree.find((n) => n.id === selectedId) ?? null;

  const pushLog = (line: string) =>
    setLog((L) => [`${new Date().toLocaleTimeString()}  ${line}`, ...L].slice(0, 40));

  useEffect(() => {
    if (selectedNode) {
      pushLog(`Selected ${selectedNode.kind}: ${selectedNode.label}`);
      if (selectedNode.kind === "npc") setRightTab("behavior");
      else setRightTab("inspector");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const filteredBlocks = useMemo(() => {
    const q = assetQ.trim().toLowerCase();
    if (!q) return PALETTE;
    return PALETTE.filter(
      (b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q),
    );
  }, [assetQ]);

  const filteredProps = useMemo(() => {
    const q = assetQ.trim().toLowerCase();
    return PROP_LIST.filter((p) => {
      if (propCat !== "all" && p.category !== propCat) return false;
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.file.toLowerCase().includes(q)
      );
    });
  }, [assetQ, propCat]);

  const behavior: NpcBehavior | null =
    selectedNode?.kind === "npc"
      ? getBehaviorForNpc(selectedNode.id)
      : null;
  // re-read when behaviorTick bumps
  void behaviorTick;

  const applyBehavior = (patch: Partial<NpcBehavior> & { id?: BehaviorId }) => {
    if (!selectedNode || selectedNode.kind !== "npc") return;
    const base = getBehaviorForNpc(selectedNode.id);
    const next = { ...base, ...patch };
    if (patch.id) {
      const catalog = BEHAVIOR_CATALOG.find((c) => c.id === patch.id);
      if (catalog) Object.assign(next, catalog, patch);
    }
    setBehaviorForNpc(selectedNode.id, next);
    setBehaviorTick((t) => t + 1);
    pushLog(`AI behavior → ${next.label} on ${selectedNode.label}`);
  };

  return (
    <div className="wb-shell" data-testid="worldbuilder-shell">
      {/* ── Menu bar ─────────────────────────────────────────────── */}
      <header className="wb-menubar">
        <div className="wb-brand">
          <Layers size={16} />
          <span>
            WORLD<span className="wb-brand-accent">BUILDER</span>
          </span>
          <span className="wb-badge">Voxel · Production</span>
        </div>

        <nav className="wb-menu-groups">
          <div className="wb-menu-group">
            <button type="button" className="wb-mbtn" onClick={onNew} title="New from template">
              File · New
            </button>
            <button
              type="button"
              className={`wb-mbtn ${mapsOpen ? "on" : ""}`}
              onClick={onToggleMaps}
            >
              Maps
            </button>
            <PostToGallery
              kind="dungeon"
              getPayload={getMapPayload}
              defaultName="My Map"
              label="Export · Post"
              className="wb-mbtn"
            />
          </div>
          <div className="wb-menu-group">
            <label className={`wb-toggle ${dungeon ? "on" : ""}`}>
              <input
                type="checkbox"
                checked={dungeon}
                onChange={(e) => onDungeon(e.target.checked)}
              />
              Dungeon mode
            </label>
            <label className={`wb-toggle ${snap ? "on" : ""}`}>
              <input type="checkbox" checked={snap} onChange={(e) => onSnap(e.target.checked)} />
              Snap
            </label>
          </div>
        </nav>

        <div className="wb-toolbar">
          {(
            [
              { id: "block" as const, label: "Build", Icon: Box },
              { id: "deploy" as const, label: "Deploy", Icon: Package },
              { id: "select" as const, label: "Select", Icon: Crosshair },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`wb-tool ${brush.tool === t.id ? "on" : ""}`}
              onClick={() => {
                onBrush({ tool: t.id });
                pushLog(`Tool → ${t.label}`);
              }}
              title={t.label}
            >
              <t.Icon size={15} />
              {t.label}
            </button>
          ))}
          <span className="wb-tool-sep" />
          {GIZMO_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`wb-tool wb-tool-icon ${gizmoMode === m.id && brush.tool === "select" ? "on" : ""}`}
              disabled={brush.tool !== "select" || !selectedNode}
              onClick={() => {
                onBrush({ tool: "select" });
                onGizmoMode(m.id);
              }}
              title={`${m.label} (${m.key})`}
            >
              <m.Icon size={15} />
            </button>
          ))}
        </div>

        <div className="wb-menubar-right">
          <button type="button" className="wb-mbtn danger" onClick={onClear}>
            <Eraser size={14} /> Clear
          </button>
          <button
            type="button"
            className="wb-mbtn play"
            onClick={onTest}
            disabled={!canTest}
            title={canTest ? "Play map (Danger Room UX)" : "Place Player Start first"}
          >
            <Play size={14} /> Play
          </button>
          <button type="button" className="wb-mbtn" onClick={onExit}>
            Exit
          </button>
        </div>
      </header>

      {/* ── Workspace ───────────────────────────────────────────── */}
      <div className="wb-workspace">
        {/* LEFT — Project / Assets */}
        <aside className="wb-dock wb-dock-left">
          <div className="wb-dock-tabs">
            {(
              [
                { id: "blocks" as const, label: "Blocks", Icon: Square },
                { id: "props" as const, label: "Props", Icon: Package },
                { id: "deploy" as const, label: "Actors", Icon: Bot },
                { id: "project" as const, label: "Scene", Icon: FolderTree },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`wb-dock-tab ${leftTab === t.id ? "on" : ""}`}
                onClick={() => setLeftTab(t.id)}
              >
                <t.Icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="wb-search">
            <Search size={13} />
            <input
              value={assetQ}
              onChange={(e) => setAssetQ(e.target.value)}
              placeholder="Filter assets…"
            />
          </div>

          <div className="wb-dock-body">
            {leftTab === "blocks" && (
              <>
                <div className="wb-section-label">Shapes</div>
                <div className="wb-shape-row">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`wb-chip ${brush.shape === s.id ? "on" : ""}`}
                      onClick={() => onBrush({ tool: "block", shape: s.id })}
                    >
                      <span>{s.glyph}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="wb-section-label">
                  Terrain · Voxel Realms
                  <a
                    href="https://mine-loader.vercel.app/#/defs"
                    target="_blank"
                    rel="noreferrer"
                    className="wb-link"
                  >
                    Codex
                  </a>
                </div>
                <div className="wb-block-grid">
                  {filteredBlocks.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`wb-block ${brush.blockType === c.id ? "on" : ""}`}
                      style={{ ["--swatch" as string]: c.css }}
                      onClick={() => {
                        onBrush({ tool: "block", blockType: c.id, color: c.hex });
                        pushLog(`Block → ${c.name}`);
                      }}
                      title={`${c.emoji} ${c.name} (${c.id})`}
                    >
                      <span className="wb-block-swatch" />
                      <span className="wb-block-name">
                        {c.emoji} {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {leftTab === "props" && (
              <>
                <div className="wb-prop-cats">
                  {PROP_CATS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`wb-mini-tab ${propCat === c.id ? "on" : ""}`}
                      onClick={() => setPropCat(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="wb-asset-list">
                  {filteredProps.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`wb-asset-row ${
                        brush.deployKind === "prop" && brush.prop === p.id ? "on" : ""
                      }`}
                      onClick={() => {
                        onBrush({ tool: "deploy", deployKind: "prop", prop: p.id as PropId });
                        pushLog(`Prop → ${p.label}`);
                      }}
                    >
                      <span className="wb-asset-glyph">{p.glyph}</span>
                      <span className="wb-asset-meta">
                        <strong>{p.label}</strong>
                        <em>
                          {p.category} · {p.file.split("/").pop()}
                        </em>
                      </span>
                      <ChevronRight size={12} className="wb-asset-chev" />
                    </button>
                  ))}
                  {filteredProps.length === 0 && (
                    <p className="wb-empty">No props match filter.</p>
                  )}
                </div>
              </>
            )}

            {leftTab === "deploy" && (
              <>
                <div className="wb-section-label">Deployables</div>
                <div className="wb-shape-row">
                  {DEPLOYABLES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`wb-chip ${brush.deployKind === d.id ? "on" : ""}`}
                      onClick={() => onBrush({ tool: "deploy", deployKind: d.id })}
                    >
                      <span>{d.glyph}</span>
                      {d.label}
                    </button>
                  ))}
                </div>
                {brush.deployKind === "npc" && (
                  <>
                    <div className="wb-section-label">Weapon</div>
                    <div className="wb-chip-wrap">
                      {WEAPONS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          className={`wb-chip sm ${brush.weapon === (w.id as WeaponId) ? "on" : ""}`}
                          onClick={() => onBrush({ weapon: w.id as WeaponId })}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                    {dungeon && (
                      <>
                        <div className="wb-section-label">Difficulty</div>
                        <div className="wb-chip-wrap">
                          {DIFFICULTIES.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              className={`wb-chip sm wb-diff-${d.id} ${
                                brush.difficulty === d.id ? "on" : ""
                              }`}
                              onClick={() => onBrush({ difficulty: d.id })}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {leftTab === "project" && (
              <>
                <div className="wb-section-label">Hierarchy · Deployables</div>
                <div className="wb-hier">
                  {tree.length === 0 ? (
                    <p className="wb-empty">Empty scene — deploy NPCs, bags, props, or Start.</p>
                  ) : (
                    tree.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`wb-hier-row ${n.id === selectedId ? "on" : ""}`}
                        onClick={() => {
                          onBrush({ tool: "select" });
                          onSelect(n.id);
                        }}
                      >
                        <span>{n.kind === "npc" ? "☻" : n.kind === "start" ? "✦" : "●"}</span>
                        <span className="wb-hier-label">{n.label}</span>
                        <span className="wb-hier-kind">{n.kind}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* CENTER — scene is under this chrome; floating hint */}
        <div className="wb-viewport-chrome">
          <div className="wb-viewport-hint">
            {brush.tool === "select" ? (
              <>
                <b>LMB</b> select · gizmo drag · <b>G/R/E</b> move/rotate/scale · <b>Del</b> delete
              </>
            ) : (
              <>
                <b>LMB</b> place · <b>RMB</b> orbit / erase · <b>R</b> rotate · <b>WASD</b> pan
              </>
            )}
          </div>
          {stats && (
            <div className="wb-status-pills">
              <span>▦ {stats.blocks}</span>
              <span>☻ {stats.npcs}</span>
              <span>▮ {stats.bags}</span>
              <span>📦 {stats.props}</span>
              <span className={stats.hasStart ? "ok" : "warn"}>
                ✦ {stats.hasStart ? "Start OK" : "Need Start"}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT — Inspector / Behavior / Script */}
        <aside className="wb-dock wb-dock-right">
          <div className="wb-dock-tabs">
            <button
              type="button"
              className={`wb-dock-tab ${rightTab === "inspector" ? "on" : ""}`}
              onClick={() => setRightTab("inspector")}
            >
              <Eye size={13} /> Inspector
            </button>
            <button
              type="button"
              className={`wb-dock-tab ${rightTab === "behavior" ? "on" : ""}`}
              onClick={() => setRightTab("behavior")}
              disabled={selectedNode?.kind !== "npc"}
            >
              <Bot size={13} /> AI
            </button>
            <button
              type="button"
              className={`wb-dock-tab ${rightTab === "script" ? "on" : ""}`}
              onClick={() => setRightTab("script")}
            >
              <Braces size={13} /> Script
            </button>
          </div>

          <div className="wb-dock-body">
            {rightTab === "inspector" && (
              <>
                {!selectedNode ? (
                  <div className="wb-inspector-empty">
                    <Crosshair size={28} strokeWidth={1.25} />
                    <p>Select an object in the hierarchy or scene.</p>
                    <p className="dim">Blocks use the Build tool — deployables appear here.</p>
                  </div>
                ) : (
                  <>
                    <div className="wb-insp-head">
                      <h3>{selectedNode.label}</h3>
                      <span className="wb-pill">{selectedNode.kind}</span>
                    </div>
                    <div className="wb-insp-id">{selectedNode.id}</div>
                    <div className="wb-insp-actions">
                      <button type="button" className="wb-mbtn" onClick={onFocusSelected}>
                        <Eye size={13} /> Focus
                      </button>
                      <button
                        type="button"
                        className="wb-mbtn"
                        onClick={onDuplicateSelected}
                        disabled={selectedNode.kind === "start"}
                      >
                        <Copy size={13} /> Clone
                      </button>
                      <button type="button" className="wb-mbtn danger" onClick={onDeleteSelected}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                    <div className="wb-section-label">Transform gizmo</div>
                    <div className="wb-chip-wrap">
                      {GIZMO_MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`wb-chip sm ${gizmoMode === m.id ? "on" : ""}`}
                          onClick={() => {
                            onBrush({ tool: "select" });
                            onGizmoMode(m.id);
                          }}
                        >
                          <m.Icon size={12} /> {m.label}
                        </button>
                      ))}
                    </div>
                    {selectedNode.kind === "npc" && behavior && (
                      <div className="wb-insp-ai-preview">
                        <div className="wb-section-label">AI snapshot</div>
                        <p>
                          <b>{behavior.label}</b> — {behavior.blurb}
                        </p>
                        <button
                          type="button"
                          className="wb-mbtn"
                          onClick={() => setRightTab("behavior")}
                        >
                          <Sparkles size={13} /> Edit behavior
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {rightTab === "behavior" && selectedNode?.kind === "npc" && behavior && (
              <>
                <div className="wb-insp-head">
                  <h3>AI Behavior</h3>
                  <span className="wb-pill">NPC</span>
                </div>
                <div className="wb-section-label">Profile</div>
                <div className="wb-behavior-grid">
                  {BEHAVIOR_CATALOG.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`wb-behavior-card ${behavior.id === b.id ? "on" : ""}`}
                      onClick={() => applyBehavior({ id: b.id })}
                    >
                      <strong>{b.label}</strong>
                      <span>{b.blurb}</span>
                    </button>
                  ))}
                </div>
                <div className="wb-section-label">Parameters</div>
                <label className="wb-field">
                  Aggro range (m)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={behavior.aggroRange}
                    onChange={(e) => applyBehavior({ aggroRange: Number(e.target.value) || 1 })}
                  />
                </label>
                <label className="wb-field">
                  Patrol radius (m)
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={behavior.patrolRadius}
                    onChange={(e) => applyBehavior({ patrolRadius: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="wb-field">
                  Flee health %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(behavior.fleeHealth * 100)}
                    onChange={(e) =>
                      applyBehavior({
                        fleeHealth: Math.min(1, Math.max(0, Number(e.target.value) / 100)),
                      })
                    }
                  />
                </label>
                <label className="wb-check">
                  <input
                    type="checkbox"
                    checked={behavior.preferRanged}
                    onChange={(e) => applyBehavior({ preferRanged: e.target.checked })}
                  />
                  Prefer ranged
                </label>
              </>
            )}

            {rightTab === "script" && (
              <>
                <div className="wb-insp-head">
                  <h3>Policy script</h3>
                  <span className="wb-pill">
                    <Sparkles size={11} /> Forge AI
                  </span>
                </div>
                {selectedNode?.kind === "npc" && behavior ? (
                  <>
                    <p className="wb-script-hint">
                      Editable policy for <b>{selectedNode.label}</b>. Companion AI can rewrite this
                      via <code>set_npc_behavior</code>.
                    </p>
                    <textarea
                      className="wb-script"
                      value={behavior.policy}
                      onChange={(e) => applyBehavior({ policy: e.target.value })}
                      spellCheck={false}
                      rows={12}
                    />
                    <div className="wb-section-label">Designer notes</div>
                    <textarea
                      className="wb-script notes"
                      value={behavior.notes}
                      onChange={(e) => applyBehavior({ notes: e.target.value })}
                      placeholder="Notes for AI / co-designers…"
                      rows={4}
                    />
                    <button
                      type="button"
                      className="wb-mbtn"
                      onClick={() => {
                        const report = formatBehaviorReport(selectedNode.label, behavior);
                        void navigator.clipboard?.writeText(report);
                        pushLog("Copied behavior report");
                      }}
                    >
                      <Upload size={13} /> Copy report
                    </button>
                  </>
                ) : (
                  <div className="wb-inspector-empty">
                    <Braces size={28} strokeWidth={1.25} />
                    <p>Select an NPC to edit its AI policy script.</p>
                    <p className="dim">
                      Or ask Companion: “set all guards to patrol with aggro 16”.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ── Bottom console ───────────────────────────────────────── */}
      <footer className="wb-bottom">
        <div className="wb-dock-tabs">
          <button
            type="button"
            className={`wb-dock-tab ${bottomTab === "console" ? "on" : ""}`}
            onClick={() => setBottomTab("console")}
          >
            Console
          </button>
          <button
            type="button"
            className={`wb-dock-tab ${bottomTab === "shortcuts" ? "on" : ""}`}
            onClick={() => setBottomTab("shortcuts")}
          >
            Shortcuts
          </button>
        </div>
        <div className="wb-bottom-body">
          {bottomTab === "console" ? (
            <ul className="wb-console">
              {log.map((line, i) => (
                <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="wb-shortcuts">
              <span>
                <kbd>LMB</kbd> place / select
              </span>
              <span>
                <kbd>RMB</kbd> orbit · erase
              </span>
              <span>
                <kbd>G</kbd> <kbd>R</kbd> <kbd>E</kbd> gizmo
              </span>
              <span>
                <kbd>Del</kbd> delete
              </span>
              <span>
                <kbd>R</kbd> rotate piece
              </span>
              <span>
                <kbd>WASD</kbd> pan
              </span>
              <span>
                <RotateCcw size={12} /> Snap toggle in menu
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
