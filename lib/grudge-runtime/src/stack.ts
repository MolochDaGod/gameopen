/**
 * Pinned dependency + host versions for all Warlords-era games.
 * Agents and package.json files should align to these.
 */

export const WARLORDS_STACK = {
  node: ">=20",
  three: "^0.184.0",
  rapier: "^0.19.3",
  meshBvh: "^0.8.3",
  /** Optional peer ranges */
  yuka: "^0.7.8",
  packages: {
    physics: "@workspace/grudge-physics",
    runtime: "@workspace/grudge-runtime",
    animator: "@workspace/animator",
    epicfight: "@workspace/epicfight",
    assets: "@workspace/assets",
    voxel: "@workspace/voxel-canonical",
  },
} as const;

/** Semantic version of this runtime contract (bump when location/script shape breaks). */
export const GRUDGE_RUNTIME_CONTRACT = "1.0.0";
