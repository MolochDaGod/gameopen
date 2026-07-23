/**
 * Pure bone-name mapping for the unified animation retargeting pipeline.
 *
 * The shared FBX weapon library is authored on Mixamo's `mixamorig*` skeleton.
 * Real GLB fighters (e.g. Racalvin) carry their own bone names — usually the
 * Mixamo SUFFIXES with no `mixamorig` prefix, plus a handful of rig-specific
 * spelling quirks (`Spine01`/`Spine02`, lowercase `neck`, extra `head_end` /
 * `headfront` leaves). To drive a library clip onto such a rig with three's
 * `SkeletonUtils.retargetClip`, we need an `options.names` map keyed by the
 * TARGET bone name whose value is the SOURCE (`mixamorig*`) bone name.
 *
 * This module is intentionally three-free string logic so it can be unit-tested
 * in the sandbox (no WebGL): {@link canonicalSuffix} reduces any raw bone name to
 * its canonical Mixamo suffix, and {@link buildRetargetNameMap} assembles the
 * target→source map from a rig's actual bone names.
 */

/**
 * The 22 canonical Mixamo bone suffixes the shared library animates. A library
 * clip only drives a rig bone whose name reduces (via {@link canonicalSuffix}) to
 * one of these. Source bone names are `mixamorig${suffix}`.
 */
export const CANONICAL_SUFFIXES = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
] as const;

export type CanonicalSuffix = (typeof CANONICAL_SUFFIXES)[number];

const SUFFIX_BY_LOWER = new Map<string, CanonicalSuffix>(
  CANONICAL_SUFFIXES.map((s) => [s.toLowerCase(), s]),
);

/** The source skeleton's hip bone name (`options.hip` for `retargetClip`). */
export const SOURCE_HIP = "mixamorigHips";

/** Build the `mixamorig*` source bone name for a canonical suffix. */
export function sourceBoneName(suffix: CanonicalSuffix): string {
  return `mixamorig${suffix}`;
}

/**
 * Unity Toon RTS / grudge6 **Bip001** bone → Mixamo canonical suffix.
 * Spaces or underscores (`Bip001 R Hand` / `Bip001_R_Hand`) both work after
 * normalize. Hand bones map to Mixamo LeftHand/RightHand so library weapon
 * clips drive grudge6 kits (weapons mount on R_hand_container separately).
 */
const BIP001_TO_MIXAMO: Record<string, CanonicalSuffix> = {
  // Hips / spine / head
  pelvis: "Hips",
  bip001: "Hips",
  bip001pelvis: "Hips",
  spine: "Spine",
  bip001spine: "Spine",
  spine1: "Spine1",
  bip001spine1: "Spine1",
  spine2: "Spine2",
  bip001spine2: "Spine2",
  neck: "Neck",
  bip001neck: "Neck",
  head: "Head",
  bip001head: "Head",
  // Arms (Bip001 uses Clavicle / UpperArm / Forearm / Hand)
  lclavicle: "LeftShoulder",
  bip001lclavicle: "LeftShoulder",
  rclavicle: "RightShoulder",
  bip001rclavicle: "RightShoulder",
  lupperarm: "LeftArm",
  bip001lupperarm: "LeftArm",
  rupperarm: "RightArm",
  bip001rupperarm: "RightArm",
  lforearm: "LeftForeArm",
  bip001lforearm: "LeftForeArm",
  rforearm: "RightForeArm",
  bip001rforearm: "RightForeArm",
  lhand: "LeftHand",
  bip001lhand: "LeftHand",
  rhand: "RightHand",
  bip001rhand: "RightHand",
  // Legs (Thigh / Calf / Foot / Toe0)
  lthigh: "LeftUpLeg",
  bip001lthigh: "LeftUpLeg",
  rthigh: "RightUpLeg",
  bip001rthigh: "RightUpLeg",
  lcalf: "LeftLeg",
  bip001lcalf: "LeftLeg",
  rcalf: "RightLeg",
  bip001rcalf: "RightLeg",
  lfoot: "LeftFoot",
  bip001lfoot: "LeftFoot",
  rfoot: "RightFoot",
  bip001rfoot: "RightFoot",
  ltoe0: "LeftToeBase",
  bip001ltoe0: "LeftToeBase",
  rtoe0: "RightToeBase",
  bip001rtoe0: "RightToeBase",
  ltoe: "LeftToeBase",
  rtoe: "RightToeBase",
};

/** Normalize bone name for BIP001 / Mixamo comparison (no separators). */
export function normalizeBoneKey(raw: string): string {
  return String(raw || "")
    .replace(/^mixamorig:?/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Reduce a raw target bone name to its canonical Mixamo suffix, or `null` when it
 * has no library equivalent (and should be left un-driven). Supports:
 * - Mixamo suffixes (`RightHand`, `Spine01` → `Spine1`)
 * - `mixamorig*` / `mixamorig:*` prefixes
 * - **grudge6 Bip001** (`Bip001 R Hand`, `Bip001_R_Hand`, `Bip001 Pelvis`, …)
 *
 * Container / finger / leaf bones (`R_hand_container`, `head_end`, `*_End`) return
 * `null` — weapons attach via sockets, not Mixamo tracks.
 */
export function canonicalSuffix(raw: string): CanonicalSuffix | null {
  // Hand/weapon containers are sockets — never retarget Mixamo onto them.
  if (/container|socket|attach|weapon_r|weapon_l|shield_container|quiver|bone_bag|bone_wood/i.test(raw)) {
    return null;
  }
  // Fingers / toes beyond Toe0 — leave at rest
  if (/finger|thumb|index|middle|ring|pinky|pinkie|toe1|toe2|nub|end/i.test(raw) && !/toe0|toebase/i.test(raw)) {
    return null;
  }

  let n = raw.replace(/^mixamorig:?/i, "");

  // Bip001 (spaces or underscores) → Mixamo before generic suffix fold
  const bipKey = normalizeBoneKey(n);
  if (bipKey.startsWith("bip001") || BIP001_TO_MIXAMO[bipKey]) {
    const mapped = BIP001_TO_MIXAMO[bipKey];
    if (mapped) return mapped;
    // Strip bip001 prefix and retry (e.g. bip001rhand already in table)
    const stripped = bipKey.replace(/^bip001/, "");
    if (BIP001_TO_MIXAMO[stripped]) return BIP001_TO_MIXAMO[stripped];
  }

  if (/^Spine0*1$|^Spine11$/i.test(n)) n = "Spine1";
  else if (/^Spine0*2$|^Spine21$/i.test(n)) n = "Spine2";
  else if (/^Spine$/i.test(n)) n = "Spine";
  else if (/^Neck\d*$/i.test(n)) n = "Neck";
  else if (/^Head\d*$/i.test(n)) n = "Head";
  else if (/^Hips\d*$/i.test(n)) n = "Hips";
  else n = n.replace(/\d+$/, "");
  return SUFFIX_BY_LOWER.get(n.toLowerCase()) ?? null;
}

/**
 * The result of {@link buildRetargetNameMap}: the `names` map handed straight to
 * `SkeletonUtils.retargetClip` plus diagnostics for how complete the match was.
 */
export interface RetargetNameMap {
  /** TARGET bone name → SOURCE (`mixamorig*`) bone name. */
  names: Record<string, string>;
  /** Source hip bone name (`options.hip`). */
  hip: string;
  /** Canonical suffixes that found a target bone. */
  matched: CanonicalSuffix[];
  /** Canonical suffixes with no target bone (clip motion on these is dropped). */
  missing: CanonicalSuffix[];
}

/**
 * Build the target→source bone-name map for a rig from its actual bone names.
 *
 * Each target bone is reduced to a canonical suffix via {@link canonicalSuffix}
 * (an explicit `aliases` entry, keyed by the exact target bone name and valued by
 * a canonical suffix, wins) and mapped to the matching `mixamorig*` source bone.
 * Bones with no canonical equivalent are skipped — `retargetClip` leaves them at
 * their rest pose. The first target bone claiming a suffix wins, so duplicate /
 * leaf bones can't steal an already-mapped role.
 */
export function buildRetargetNameMap(
  targetBoneNames: readonly string[],
  aliases: Record<string, CanonicalSuffix> = {},
): RetargetNameMap {
  const names: Record<string, string> = {};
  const matched = new Set<CanonicalSuffix>();
  for (const bone of targetBoneNames) {
    const suffix = aliases[bone] ?? canonicalSuffix(bone);
    if (!suffix) continue;
    if (matched.has(suffix)) continue;
    names[bone] = sourceBoneName(suffix);
    matched.add(suffix);
  }
  const missing = CANONICAL_SUFFIXES.filter((s) => !matched.has(s));
  return { names, hip: SOURCE_HIP, matched: [...matched], missing };
}
