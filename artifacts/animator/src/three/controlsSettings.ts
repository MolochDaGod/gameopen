/**
 * Device-local persistence for the controller / camera / mouse "feel" settings
 * (the `EditorParams` block surfaced in the Editor panel).
 *
 * **Fleet SSOT storage keys** live in `@workspace/grudge-physics`
 * (`grudge:controls`). All Open native modes (Danger, Play, Brawler, …) share
 * the same blob so updating sensitivity on one surface updates the rest.
 */

import {
  CONTROLS_SCHEMA,
  readControlsRaw,
  writeControlsRaw,
} from "@workspace/grudge-physics";
import { DEFAULT_EDITOR, type EditorParams } from "./types";

/**
 * Inclusive [min, max] bounds for each persisted numeric field, kept in lockstep
 * with the slider ranges in `EditorPanel.tsx`. Anything outside the range (or
 * non-finite) falls back to the default on load.
 */
export const CONTROL_RANGES: Record<string, readonly [number, number]> = {
  moveSpeed: [1, 10],
  sprintMultiplier: [1, 3],
  jumpHeight: [0.5, 5],
  gravity: [8, 40],
  cameraDistance: [2.5, 10],
  cameraHeight: [0.5, 3],
  mouseSensitivity: [0.2, 3],
  fov: [40, 100],
  turnResponsiveness: [2, 25],
  blendTime: [0.05, 0.6],
  dashDistance: [2, 12],
  aoeRadius: [1.5, 8],
  skillForce: [4, 30],
  skyfallBolts: [1, 12],
  attackSteer: [0, 1.5],
};

const clampNum = (v: unknown, [min, max]: readonly [number, number], d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);

/**
 * Load the persisted control settings, falling back to `DEFAULT_EDITOR` for any
 * missing/invalid field. `modelYaw` is intentionally NOT persisted — it is a
 * per-character facing offset, so a value tuned for one rig must not leak onto
 * the next one; it always resets to the default.
 */
export function loadControls(): EditorParams {
  const d = DEFAULT_EDITOR;
  try {
    const raw = readControlsRaw();
    if (!raw) return { ...d };
    const o = JSON.parse(raw) as Partial<EditorParams> & { schema?: number };
    if (o.schema !== CONTROLS_SCHEMA) return { ...d };
    return {
      moveSpeed: clampNum(o.moveSpeed, CONTROL_RANGES.moveSpeed, d.moveSpeed),
      sprintMultiplier: clampNum(o.sprintMultiplier, CONTROL_RANGES.sprintMultiplier, d.sprintMultiplier),
      jumpHeight: clampNum(o.jumpHeight, CONTROL_RANGES.jumpHeight, d.jumpHeight),
      gravity: clampNum(o.gravity, CONTROL_RANGES.gravity, d.gravity),
      cameraDistance: clampNum(o.cameraDistance, CONTROL_RANGES.cameraDistance, d.cameraDistance),
      cameraHeight: clampNum(o.cameraHeight, CONTROL_RANGES.cameraHeight, d.cameraHeight),
      mouseSensitivity: clampNum(o.mouseSensitivity, CONTROL_RANGES.mouseSensitivity, d.mouseSensitivity),
      fov: clampNum(o.fov, CONTROL_RANGES.fov, d.fov),
      turnResponsiveness: clampNum(o.turnResponsiveness, CONTROL_RANGES.turnResponsiveness, d.turnResponsiveness),
      blendTime: clampNum(o.blendTime, CONTROL_RANGES.blendTime, d.blendTime),
      showSkeleton: bool(o.showSkeleton, d.showSkeleton),
      modelYaw: d.modelYaw,
      invertY: bool(o.invertY, d.invertY),
      dashDistance: clampNum(o.dashDistance, CONTROL_RANGES.dashDistance, d.dashDistance),
      aoeRadius: clampNum(o.aoeRadius, CONTROL_RANGES.aoeRadius, d.aoeRadius),
      skillForce: clampNum(o.skillForce, CONTROL_RANGES.skillForce, d.skillForce),
      skyfallBolts: clampNum(o.skyfallBolts, CONTROL_RANGES.skyfallBolts, d.skyfallBolts),
      attackSteer: clampNum(o.attackSteer, CONTROL_RANGES.attackSteer, d.attackSteer),
    };
  } catch {
    return { ...d };
  }
}

export function saveControls(p: EditorParams): void {
  try {
    writeControlsRaw(JSON.stringify({ ...p, modelYaw: undefined, schema: CONTROLS_SCHEMA }));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

/**
 * Lightweight subset read used by non-combat modes (e.g. the Voxel Editor) that
 * only need the shared mouse feel so the global Mouse Sens / Invert Y settings
 * apply uniformly everywhere, not just in the Danger Room controller.
 */
export function loadMouseFeel(): { sensitivity: number; invertY: boolean } {
  const c = loadControls();
  return { sensitivity: c.mouseSensitivity, invertY: c.invertY };
}
