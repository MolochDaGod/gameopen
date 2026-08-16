/**
 * Portal → dungeon VoxelMap. Cave/mine uses Shader.lab #voxel tunnel + end room.
 * Other themes keep existing MAP_TEMPLATES (arena / parkour).
 */
import { SHADER_LAB_CAVE_TEMPLATE } from "@workspace/voxel-canonical";
import { MAP_TEMPLATES } from "./templates";
import { assembleShaderLabCaveMap } from "./shaderLabCavePlay";
import type { VoxelMap } from "./types";

export function assemblePortalDungeonMap(opts: {
  seed: number;
  templateId?: string;
  theme?: string;
}): VoxelMap {
  const id = opts.templateId || (opts.theme === "cave" || opts.theme === "mine"
    ? SHADER_LAB_CAVE_TEMPLATE
    : "arena1");
  if (id === SHADER_LAB_CAVE_TEMPLATE) return assembleShaderLabCaveMap(opts.seed);
  const tpl = MAP_TEMPLATES.find((t) => t.id === id);
  return tpl ? tpl.build() : assembleShaderLabCaveMap(opts.seed);
}
