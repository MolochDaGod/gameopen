/**
 * Dressing Room tool catalog. Every tool maps 1:1 to an existing `EditorScene`
 * setter — no new engine behaviour is introduced. Scoped to the Dressing Room:
 * character/gear/animation/effect operations plus selection, transform and
 * camera framing. The generic scene-authoring tools (primitives, structural
 * build brushes, colliders) were intentionally dropped along with their UI. The
 * system prompt embeds a fresh scene snapshot each turn so the model can target
 * real object ids in a single round-trip.
 */
import type { EditorScene } from "../three/editor/EditorScene";
import type {
  EditorSnapshot,
  GizmoMode,
} from "../three/editor/types";
import type { VoxelPart } from "../three/explorer/rig";
import type { AiTool } from "./types";

const GIZMO_MODES: GizmoMode[] = ["translate", "rotate", "scale"];
/** Voxel-character parts the AI may recolour / pattern (subset of VoxelPart). */
const VOXEL_PARTS = ["skin", "shirt", "pants", "boot", "hat"] as const;
type VoxelPartArg = (typeof VOXEL_PARTS)[number];
const VFX_IDS = [
  "impact",
  "burst",
  "shockwave",
  "aoeBlast",
  "nova",
  "lightning",
  "muzzle",
  "impactExplode",
  "flame",
  "legFlame",
  "coneFlame",
  "stunMark",
  "shieldBreak",
];

/** Parse a "#rrggbb" / "rrggbb" / 0x-prefixed / decimal colour into 0xRRGGBB. */
function parseColor(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input & 0xffffff;
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/^#/, "").replace(/^0x/i, "");
  if (/^[0-9a-f]{6}$/i.test(s)) return parseInt(s, 16);
  const n = Number(input);
  return Number.isFinite(n) ? n & 0xffffff : null;
}

function asVec3(v: unknown): [number, number, number] | undefined {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number")) {
    return [v[0], v[1], v[2]];
  }
  return undefined;
}

/**
 * Build the editor tool registry bound to a live engine accessor. Tools close
 * over `getEngine` so they always act on the current engine instance.
 */
export function buildEditorTools(
  getEngine: () => EditorScene | null,
  generatePattern?: (prompt: string) => Promise<string>,
): AiTool[] {
  const engine = (): EditorScene => {
    const e = getEngine();
    if (!e) throw new Error("The editor is not ready.");
    return e;
  };

  const asPart = (input: unknown): VoxelPart => {
    const p = String(input);
    if (!(VOXEL_PARTS as readonly string[]).includes(p)) throw new Error(`Unknown part "${input}".`);
    return p as VoxelPartArg;
  };

  return [
    {
      name: "select_object",
      description: "Select an object by its id (pass null to clear selection).",
      parameters: {
        type: "object",
        properties: { id: { type: ["string", "null"] } },
        required: ["id"],
      },
      execute: (args) => {
        const id = (args.id as string | null) ?? null;
        engine().select(id);
        return id ? `Selected ${id}` : "Cleared selection";
      },
    },
    {
      name: "delete_selected",
      description: "Delete the currently selected object.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        engine().deleteSelected();
        return "Deleted the selection";
      },
    },
    {
      name: "duplicate_selected",
      description: "Duplicate the currently selected object.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        engine().duplicateSelected();
        return "Duplicated the selection";
      },
    },
    {
      name: "rename_object",
      description: "Rename an object by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
        required: ["id", "name"],
      },
      execute: (args) => {
        engine().rename(String(args.id), String(args.name));
        return `Renamed to "${args.name}"`;
      },
    },
    {
      name: "set_object_color",
      description: "Set an object's material colour. Accepts a hex string like #ff3344.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, color: { type: "string" } },
        required: ["id", "color"],
      },
      execute: (args) => {
        const color = parseColor(args.color);
        if (color === null) throw new Error("Could not parse that colour.");
        engine().setObjectColor(String(args.id), color);
        return `Set colour of ${args.id}`;
      },
    },
    {
      name: "set_transform",
      description:
        "Set an object's position, rotation (degrees XYZ), and/or scale. Provide only the fields to change.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          position: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          rotation: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          scale: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
        },
        required: ["id"],
      },
      execute: (args) => {
        engine().setTransform(String(args.id), {
          position: asVec3(args.position),
          rotation: asVec3(args.rotation),
          scale: asVec3(args.scale),
        });
        return `Transformed ${args.id}`;
      },
    },
    {
      name: "focus_selected",
      description: "Frame the camera on the currently selected object.",
      parameters: { type: "object", properties: {} },
      execute: () => {
        engine().focusSelected();
        return "Focused the selection";
      },
    },
    {
      name: "set_gizmo_mode",
      description: "Switch the transform gizmo between translate, rotate, and scale.",
      parameters: {
        type: "object",
        properties: { mode: { type: "string", enum: GIZMO_MODES } },
        required: ["mode"],
      },
      execute: (args) => {
        const mode = args.mode as GizmoMode;
        if (!GIZMO_MODES.includes(mode)) throw new Error(`Unknown gizmo mode "${mode}".`);
        engine().setGizmoMode(mode);
        return `Gizmo: ${mode}`;
      },
    },
    {
      name: "toggle_grid",
      description: "Show or hide the ground grid.",
      parameters: {
        type: "object",
        properties: { on: { type: "boolean" } },
        required: ["on"],
      },
      execute: (args) => {
        const on = Boolean(args.on);
        engine().toggleGrid(on);
        return on ? "Grid on" : "Grid off";
      },
    },
    {
      name: "set_bloom",
      description: "Enable or disable the bloom post-processing pass.",
      parameters: {
        type: "object",
        properties: { on: { type: "boolean" } },
        required: ["on"],
      },
      execute: (args) => {
        const on = Boolean(args.on);
        engine().setBloom(on);
        return on ? "Bloom on" : "Bloom off";
      },
    },
    {
      name: "play_vfx",
      description: "Play a one-shot visual effect preset at the scene focus point.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", enum: VFX_IDS } },
        required: ["id"],
      },
      execute: (args) => {
        const id = String(args.id);
        if (!VFX_IDS.includes(id)) throw new Error(`Unknown effect "${id}".`);
        engine().playVfx(id);
        return `Played ${id}`;
      },
    },
    {
      name: "recolor_character_part",
      description:
        "Recolour one part of the voxel character (the procedural blocky rig). Parts: skin, shirt, pants, boot, hat (use 'hat' for head wraps / hoods / caps). Colour is a hex string like #3aa0ff. Only works when a voxel character is loaded.",
      parameters: {
        type: "object",
        properties: {
          part: { type: "string", enum: [...VOXEL_PARTS] },
          color: { type: "string" },
        },
        required: ["part", "color"],
      },
      execute: (args) => {
        const part = asPart(args.part);
        const color = parseColor(args.color);
        if (color === null) throw new Error("Could not parse that colour.");
        engine().recolorRigPart(part, color);
        return `Recoloured the ${part}`;
      },
    },
    {
      name: "generate_character_pattern",
      description:
        "Generate a tiling pattern IMAGE from a text description and apply it as a texture to one part of the voxel character. Use for head wraps, clothing prints, camo, fabric, etc. Parts: skin, shirt, pants, boot, hat (use 'hat' for head wraps/hoods). Write a vivid, specific description of the motif and colours. Only works when a voxel character is loaded.",
      parameters: {
        type: "object",
        properties: {
          part: { type: "string", enum: [...VOXEL_PARTS] },
          prompt: { type: "string" },
        },
        required: ["part", "prompt"],
      },
      execute: async (args) => {
        if (!generatePattern) throw new Error("Pattern generation is unavailable.");
        const part = asPart(args.part);
        const desc = String(args.prompt ?? "").trim();
        if (!desc) throw new Error("Describe the pattern to generate.");
        const dataUrl = await generatePattern(
          `Seamless tileable flat pattern texture, top-down, no perspective, no shadows, no borders: ${desc}`,
        );
        await engine().applyRigPattern(part, dataUrl);
        return `Generated & applied a pattern to the ${part}`;
      },
    },
    {
      name: "clear_character_pattern",
      description:
        "Remove any generated pattern from a voxel character part, returning it to a flat colour. Parts: skin, shirt, pants, boot, hat.",
      parameters: {
        type: "object",
        properties: { part: { type: "string", enum: [...VOXEL_PARTS] } },
        required: ["part"],
      },
      execute: (args) => {
        const part = asPart(args.part);
        engine().clearRigPattern(part);
        return `Cleared the ${part} pattern`;
      },
    },
  ];
}

/** A compact, model-friendly description of the live scene for this turn. */
export function editorSystemPrompt(snap: EditorSnapshot | null): string {
  const lines: string[] = [
    "You are the AI assistant embedded in the browser-based Dressing Room — a 3D character studio for loading rigs, dressing them in skins & gear, and previewing animations and effects.",
    "You can ANSWER questions about the editor and EXECUTE edits by calling the provided tools.",
    "Only act through the tools given to you; never claim to do anything outside them.",
    "When an action targets an object, use an exact id from the scene listing below — never invent ids.",
    "After performing actions, ALWAYS reply with one short, natural sentence confirming what you did.",
    "If a request is unsafe, out of scope, or impossible with the available tools, politely decline and say why in one sentence.",
    "",
  ];

  if (!snap) {
    lines.push("Scene state: (the Dressing Room is still loading).");
    return lines.join("\n");
  }

  lines.push(
    `Tools/state: gizmo=${snap.gizmo}, grid=${snap.showGrid ? "on" : "off"}, bloom=${
      snap.bloom ? "on" : "off"
    }.`,
  );
  lines.push(`Selected: ${snap.selectedId ?? "(none)"}.`);
  lines.push(
    snap.rigIsVoxel
      ? "A procedural voxel character is loaded. You can recolour its parts (recolor_character_part) and GENERATE & apply pattern textures to its parts (generate_character_pattern) — parts: skin, shirt, pants, boot, hat (use 'hat' for head wraps/hoods). Use clear_character_pattern to remove a pattern."
      : "No procedural voxel character is loaded, so the voxel recolour/pattern tools won't apply until one is.",
  );

  if (snap.objects.length === 0) {
    lines.push("Objects: (the scene is empty).");
  } else {
    lines.push(`Objects (${snap.objects.length}):`);
    for (const o of snap.objects.slice(0, 80)) {
      const [x, y, z] = o.position;
      const color = o.color !== null ? ` #${o.color.toString(16).padStart(6, "0")}` : "";
      const sel = o.selected ? " [selected]" : "";
      lines.push(
        `  ${o.id} — "${o.name}" — ${o.kind} @ (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})${color}${sel}`,
      );
    }
    if (snap.objects.length > 80) lines.push(`  …and ${snap.objects.length - 80} more.`);
  }

  return lines.join("\n");
}
