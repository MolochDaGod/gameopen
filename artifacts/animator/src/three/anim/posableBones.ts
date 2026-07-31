/**
 * The Mixamo bones the Animation Creator exposes for posing — the single source
 * of truth for both the hand editor and the AI skeleton-mover contract.
 *
 * The full rig has 25 core bones (incl. toes / HeadTop_End) but the creator only
 * poses these 20 controllable joints. Any AI-generated pose is filtered to this
 * exact set before it is allowed to touch the rig (see `aiClipContract.ts`).
 *
 * NOTE: this list must stay byte-identical to the copy bundled with the
 * Cloudflare Worker (`worker/src/clipContract.ts`) so validation is consistent
 * on both ends. If you change it here, change it there too.
 */
export const POSABLE_BONES = [
  "mixamorigHips",
  "mixamorigSpine",
  "mixamorigSpine1",
  "mixamorigSpine2",
  "mixamorigNeck",
  "mixamorigHead",
  "mixamorigLeftShoulder",
  "mixamorigLeftArm",
  "mixamorigLeftForeArm",
  "mixamorigLeftHand",
  "mixamorigRightShoulder",
  "mixamorigRightArm",
  "mixamorigRightForeArm",
  "mixamorigRightHand",
  "mixamorigLeftUpLeg",
  "mixamorigLeftLeg",
  "mixamorigLeftFoot",
  "mixamorigRightUpLeg",
  "mixamorigRightLeg",
  "mixamorigRightFoot",
] as const;

export type PosableBone = (typeof POSABLE_BONES)[number];
