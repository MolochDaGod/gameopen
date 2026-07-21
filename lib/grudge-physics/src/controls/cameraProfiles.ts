/**
 * Dynamic third-person camera profiles — fleet SSOT for Controller.setCameraOpts.
 *
 * Hosts (Studio, Brawler, islands) pick a profile key from loco + activity + focus
 * state; only re-apply when the key changes (avoid thrashing each frame).
 */

export type CameraProfileKey =
  | "fp"
  | "swim"
  | "climb"
  | "harvest"
  | "build"
  | "combat-hard"
  | "combat-soft";

/** Fields match ControllerCameraOpts in Open Controller. */
export interface CameraProfileOpts {
  enableSpringCamera?: boolean;
  springCameraTime?: number;
  enableOverShoulderView?: boolean;
  camOverShoulderOffsetRatio?: number;
  camLookAtHeightRatio?: number;
  enableZoom?: boolean;
  cameraDistance?: number;
  cameraHeight?: number;
  pitch?: number;
}

export const CAMERA_PROFILES: Record<CameraProfileKey, CameraProfileOpts> = {
  fp: {
    enableSpringCamera: true,
    springCameraTime: 0.04,
    enableOverShoulderView: false,
    enableZoom: false,
    camLookAtHeightRatio: 1,
  },
  swim: {
    enableSpringCamera: true,
    springCameraTime: 0.1,
    enableOverShoulderView: true,
    camOverShoulderOffsetRatio: 0.1,
    camLookAtHeightRatio: 0.55,
    enableZoom: true,
    cameraDistance: 5.4,
    cameraHeight: 1.2,
    pitch: 0.22,
  },
  climb: {
    enableSpringCamera: true,
    springCameraTime: 0.07,
    enableOverShoulderView: true,
    camOverShoulderOffsetRatio: 0.08,
    camLookAtHeightRatio: 0.85,
    enableZoom: true,
    cameraDistance: 4.0,
    cameraHeight: 1.7,
    pitch: 0.18,
  },
  harvest: {
    enableSpringCamera: true,
    springCameraTime: 0.08,
    enableOverShoulderView: true,
    camOverShoulderOffsetRatio: 0.18,
    camLookAtHeightRatio: 0.72,
    enableZoom: true,
    cameraDistance: 5.2,
    cameraHeight: 1.55,
    pitch: 0.36,
  },
  build: {
    enableSpringCamera: true,
    springCameraTime: 0.08,
    enableOverShoulderView: true,
    camOverShoulderOffsetRatio: 0.2,
    camLookAtHeightRatio: 0.72,
    enableZoom: true,
    cameraDistance: 5.8,
    cameraHeight: 1.55,
    pitch: 0.42,
  },
  "combat-hard": {
    enableSpringCamera: true,
    springCameraTime: 0.045,
    enableOverShoulderView: true,
    camOverShoulderOffsetRatio: 0.16,
    camLookAtHeightRatio: 0.94,
    enableZoom: true,
    cameraDistance: 4.1,
    cameraHeight: 1.68,
    pitch: 0.26,
  },
  "combat-soft": {
    enableSpringCamera: true,
    springCameraTime: 0.055,
    enableOverShoulderView: true,
    camOverShoulderOffsetRatio: 0.14,
    camLookAtHeightRatio: 0.9,
    enableZoom: true,
    cameraDistance: 4.6,
    cameraHeight: 1.65,
    pitch: 0.28,
  },
};

export interface ResolveCameraProfileInput {
  firstPerson?: boolean;
  swimming?: boolean;
  climbing?: boolean;
  /** combat | harvest | build */
  activity?: string;
  hardFocus?: boolean;
}

/** Resolve which profile key to apply. */
export function resolveCameraProfileKey(input: ResolveCameraProfileInput): CameraProfileKey {
  if (input.firstPerson) return "fp";
  if (input.swimming) return "swim";
  if (input.climbing) return "climb";
  if (input.activity === "harvest") return "harvest";
  if (input.activity === "build") return "build";
  if (input.hardFocus) return "combat-hard";
  return "combat-soft";
}

export function cameraProfileOpts(key: CameraProfileKey): CameraProfileOpts {
  return { ...CAMERA_PROFILES[key] };
}
