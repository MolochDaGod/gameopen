/**
 * Worldbuilder (Voxel Editor) AI tools — Forge-like authoring surface.
 * Tools close over a live VoxelEditor accessor + brush/map callbacks.
 */
import type { VoxelEditor } from "../three/voxel/VoxelEditor";
import type { BrushState, DeployableKind, Difficulty, GizmoMode, PieceShape, PropId } from "../three/voxel/types";
import { PLACEABLE_TERRAIN, PROP_LIST, colorForBlockType } from "../three/voxel/types";
import {
  BEHAVIOR_CATALOG,
  behaviorById,
  formatBehaviorReport,
  getBehaviorForNpc,
  setBehaviorForNpc,
  type BehaviorId,
} from "../three/voxel/voxelBehavior";
import type { AiTool } from "./types";
import type { WeaponId } from "../three/types";
import { AI_WORLD_TRAINING_PROMPT } from "../three/world/productionWorldRules";

export type VoxelAiContext = {
  getEditor: () => VoxelEditor | null;
  getBrush: () => BrushState;
  setBrush: (patch: Partial<BrushState>) => void;
  getSelectedId: () => string | null;
  getTree: () => { id: string; kind: string; label: string }[];
  getStats: () => { blocks: number; npcs: number; bags: number; props: number; hasStart: boolean } | null;
  select: (id: string | null) => void;
  clearMap: () => void;
  playMap: () => void;
  focusSelected: () => void;
  deleteSelected: () => void;
};

const SHAPES: PieceShape[] = ["block", "slab", "wall", "pillar", "ramp"];
const TOOLS = ["block", "deploy", "select"] as const;
const GIZMOS: GizmoMode[] = ["translate", "rotate", "scale"];
const DIFFS: Difficulty[] = ["easy", "normal", "hard", "elite"];

export function buildVoxelAiTools(ctx: VoxelAiContext): AiTool[] {
  const ed = () => {
    const e = ctx.getEditor();
    if (!e) throw new Error("Worldbuilder is not ready.");
    return e;
  };

  return [
    {
      name: "get_map_status",
      description: "Summarize map stats, brush, selection, and hierarchy.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        const s = ctx.getStats();
        const b = ctx.getBrush();
        const tree = ctx.getTree();
        const sel = ctx.getSelectedId();
        return [
          `blocks=${s?.blocks ?? 0} npcs=${s?.npcs ?? 0} bags=${s?.bags ?? 0} props=${s?.props ?? 0} start=${s?.hasStart ? "yes" : "NO"}`,
          `tool=${b.tool} shape=${b.shape} blockType=${b.blockType} deploy=${b.deployKind}`,
          `selected=${sel ?? "none"} hierarchy=${tree.length}`,
          tree
            .slice(0, 12)
            .map((n) => `  ${n.id} ${n.kind} ${n.label}`)
            .join("\n") || "  (empty hierarchy)",
        ].join("\n");
      },
    },
    {
      name: "set_tool",
      description: "Switch brush tool: block (build), deploy, or select.",
      parameters: {
        type: "object",
        properties: { tool: { type: "string", enum: [...TOOLS] } },
        required: ["tool"],
      },
      execute: (args) => {
        const tool = String(args.tool) as BrushState["tool"];
        if (!(TOOLS as readonly string[]).includes(tool)) throw new Error("bad tool");
        ctx.setBrush({ tool });
        return `Tool → ${tool}`;
      },
    },
    {
      name: "set_block_type",
      description: "Set placeable terrain block type (grass, stone, woodPlanks, …).",
      parameters: {
        type: "object",
        properties: { type: { type: "string", description: "Canonical block type id" } },
        required: ["type"],
      },
      execute: (args) => {
        const type = String(args.type);
        const entry = PLACEABLE_TERRAIN.find((t) => t.id === type);
        if (!entry) {
          throw new Error(
            `Unknown block "${type}". Try: ${PLACEABLE_TERRAIN.map((t) => t.id).slice(0, 12).join(", ")}…`,
          );
        }
        const hex = colorForBlockType(entry.id);
        ctx.setBrush({ tool: "block", blockType: entry.id, color: hex });
        return `Block type → ${entry.emoji} ${entry.name} (${entry.id})`;
      },
    },
    {
      name: "set_shape",
      description: "Set piece shape: block, slab, wall, pillar, ramp.",
      parameters: {
        type: "object",
        properties: { shape: { type: "string", enum: SHAPES } },
        required: ["shape"],
      },
      execute: (args) => {
        const shape = String(args.shape) as PieceShape;
        if (!SHAPES.includes(shape)) throw new Error("bad shape");
        ctx.setBrush({ tool: "block", shape });
        return `Shape → ${shape}`;
      },
    },
    {
      name: "set_deployable",
      description: "Prepare deploy brush: npc, heavyBag, physicsBag, start, or prop.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["npc", "heavyBag", "physicsBag", "prop", "start"] },
          propId: { type: "string", description: "Prop id when kind=prop" },
          weapon: { type: "string", description: "Weapon id for npc" },
          difficulty: { type: "string", enum: DIFFS },
        },
        required: ["kind"],
      },
      execute: (args) => {
        const kind = String(args.kind) as DeployableKind;
        const patch: Partial<BrushState> = { tool: "deploy", deployKind: kind };
        if (kind === "prop" && args.propId) {
          const p = PROP_LIST.find((x) => x.id === args.propId);
          if (!p) throw new Error(`Unknown prop ${args.propId}`);
          patch.prop = p.id as PropId;
        }
        if (args.weapon) patch.weapon = String(args.weapon) as WeaponId;
        if (args.difficulty && (DIFFS as string[]).includes(String(args.difficulty))) {
          patch.difficulty = args.difficulty as Difficulty;
        }
        ctx.setBrush(patch);
        return `Deploy → ${kind}${patch.prop ? ` (${patch.prop})` : ""}`;
      },
    },
    {
      name: "list_assets",
      description: "List block types and prop assets available in the Worldbuilder palette.",
      parameters: {
        type: "object",
        properties: { category: { type: "string", enum: ["blocks", "props", "all"] } },
      },
      execute: (args) => {
        const cat = String(args.category || "all");
        const lines: string[] = [];
        if (cat === "blocks" || cat === "all") {
          lines.push("BLOCKS:");
          for (const t of PLACEABLE_TERRAIN) lines.push(`  ${t.id} ${t.emoji} ${t.name}`);
        }
        if (cat === "props" || cat === "all") {
          lines.push("PROPS:");
          for (const p of PROP_LIST) lines.push(`  ${p.id} [${p.category}] ${p.label} → ${p.file}`);
        }
        return lines.join("\n");
      },
    },
    {
      name: "select_object",
      description: "Select hierarchy object by id (null to clear).",
      parameters: {
        type: "object",
        properties: { id: { type: ["string", "null"] } },
        required: ["id"],
      },
      execute: (args) => {
        const id = args.id == null ? null : String(args.id);
        ctx.select(id);
        ed().select(id);
        return id ? `Selected ${id}` : "Selection cleared";
      },
    },
    {
      name: "set_gizmo",
      description: "Select tool gizmo: translate, rotate, scale.",
      parameters: {
        type: "object",
        properties: { mode: { type: "string", enum: GIZMOS } },
        required: ["mode"],
      },
      execute: (args) => {
        const mode = String(args.mode) as GizmoMode;
        ed().setGizmoMode(mode);
        ctx.setBrush({ tool: "select" });
        return `Gizmo → ${mode}`;
      },
    },
    {
      name: "inspect_npc_behavior",
      description: "Show AI behavior policy for a selected or named NPC.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Deployable id; omit to use selection" } },
      },
      execute: (args) => {
        const id = args.id ? String(args.id) : ctx.getSelectedId();
        if (!id) throw new Error("No NPC selected.");
        const node = ctx.getTree().find((n) => n.id === id);
        if (!node || node.kind !== "npc") throw new Error("Target is not an NPC.");
        const b = getBehaviorForNpc(id);
        return formatBehaviorReport(node.label, b);
      },
    },
    {
      name: "set_npc_behavior",
      description: "Assign a behavior profile to an NPC (guard, patrol, aggressive, …).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          behavior: {
            type: "string",
            enum: BEHAVIOR_CATALOG.map((b) => b.id),
          },
          policy: { type: "string", description: "Optional policy script override" },
          notes: { type: "string" },
          aggroRange: { type: "number" },
          patrolRadius: { type: "number" },
        },
        required: ["behavior"],
      },
      execute: (args) => {
        const id = args.id ? String(args.id) : ctx.getSelectedId();
        if (!id) throw new Error("No NPC id.");
        const base = behaviorById(String(args.behavior) as BehaviorId);
        if (typeof args.policy === "string") base.policy = args.policy;
        if (typeof args.notes === "string") base.notes = args.notes;
        if (typeof args.aggroRange === "number") base.aggroRange = args.aggroRange;
        if (typeof args.patrolRadius === "number") base.patrolRadius = args.patrolRadius;
        setBehaviorForNpc(id, base);
        return `Behavior on ${id} → ${base.label}`;
      },
    },
    {
      name: "list_behaviors",
      description: "List available NPC AI behavior profiles.",
      parameters: { type: "object", properties: {} },
      execute: () =>
        BEHAVIOR_CATALOG.map((b) => `${b.id}: ${b.label} — ${b.blurb}`).join("\n"),
    },
    {
      name: "focus_selected",
      description: "Frame the camera on the current selection.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        ctx.focusSelected();
        return "Focused selection";
      },
    },
    {
      name: "delete_selected",
      description: "Delete the currently selected deployable.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        ctx.deleteSelected();
        return "Deleted selection";
      },
    },
    {
      name: "clear_map",
      description: "Clear all blocks and deployables (destructive).",
      parameters: { type: "object", properties: { confirm: { type: "boolean" } }, required: ["confirm"] },
      execute: (args) => {
        if (!args.confirm) throw new Error("Pass confirm:true to clear.");
        ctx.clearMap();
        return "Map cleared";
      },
    },
    {
      name: "play_map",
      description: "Launch Danger Room play mode on this map (requires Player Start).",
      parameters: { type: "object", properties: {} },
      execute: () => {
        const s = ctx.getStats();
        if (!s?.hasStart) throw new Error("Place a Player Start first.");
        ctx.playMap();
        return "Entering Map Play…";
      },
    },
  ];
}

export function voxelWorldbuilderSystemPrompt(ctx: {
  brush: BrushState;
  stats: { blocks: number; npcs: number; bags: number; props: number; hasStart: boolean } | null;
  selectedId: string | null;
}): string {
  return [
    "You are the Worldbuilder Forge AI — a Unity-style voxel map co-author inside open.grudge-studio.com/voxel.",
    "Help place blocks, deploy NPCs/props, inspect AI behaviors, and prepare maps for Danger Room Play.",
    "Prefer tools over guessing. Canonical blocks: mine-loader / @workspace/voxel-canonical placeables.",
    "Play requires a Player Start (✦). Behaviors are authoring intent for NPCs (guard/patrol/etc).",
    "PRODUCTION ONLY: author for live open.grudge-studio.com + CDN assets — not localhost-only stubs.",
    "",
    AI_WORLD_TRAINING_PROMPT,
    "",
    "Live state:",
    `  tool=${ctx.brush.tool} shape=${ctx.brush.shape} block=${ctx.brush.blockType}`,
    `  blocks=${ctx.stats?.blocks ?? 0} npcs=${ctx.stats?.npcs ?? 0} start=${ctx.stats?.hasStart ? "yes" : "no"}`,
    `  selected=${ctx.selectedId ?? "none"}`,
  ].join("\n");
}
