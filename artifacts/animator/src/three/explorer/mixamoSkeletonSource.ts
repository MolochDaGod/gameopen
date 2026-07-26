/**
 * Procedural Mixamo 25-bone T-pose skeleton.
 *
 * Production Vercel deploys exclude **\/*.fbx (see .vercelignore) and the
 * Mixamo pack is not on R2 either — so Explorer's skeleton-source FBX
 * (`animations/bow/unarmed-idle-01`) 404s and hard-fails character load.
 *
 * This hierarchy uses the same bone names {@link VoxelCharacter} expects
 * (`mixamorigHips`, `mixamorigLeftArm`, …) with SI-metre bind offsets so the
 * box-rig segment builder still produces a ~1.8 m human.
 */
import * as THREE from "three";

type BoneDef = {
  name: string;
  /** Local position relative to parent (metres). */
  pos: [number, number, number];
  children?: BoneDef[];
};

/** Approximate Mixamo humanoid bind (Y-up, facing +Z, arms out in T-pose). */
const MIXAMO_TREE: BoneDef = {
  name: "mixamorigHips",
  pos: [0, 1.0, 0],
  children: [
    {
      name: "mixamorigSpine",
      pos: [0, 0.1, 0],
      children: [
        {
          name: "mixamorigSpine1",
          pos: [0, 0.14, 0],
          children: [
            {
              name: "mixamorigSpine2",
              pos: [0, 0.14, 0],
              children: [
                {
                  name: "mixamorigNeck",
                  pos: [0, 0.16, 0],
                  children: [
                    {
                      name: "mixamorigHead",
                      pos: [0, 0.12, 0],
                      children: [{ name: "mixamorigHeadTop_End", pos: [0, 0.2, 0] }],
                    },
                  ],
                },
                {
                  name: "mixamorigLeftShoulder",
                  pos: [0.08, 0.12, 0],
                  children: [
                    {
                      name: "mixamorigLeftArm",
                      pos: [0.14, 0, 0],
                      children: [
                        {
                          name: "mixamorigLeftForeArm",
                          pos: [0.28, 0, 0],
                          children: [
                            {
                              name: "mixamorigLeftHand",
                              pos: [0.26, 0, 0],
                              children: [
                                { name: "mixamorigLeftHandEnd", pos: [0.1, 0, 0] },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "mixamorigRightShoulder",
                  pos: [-0.08, 0.12, 0],
                  children: [
                    {
                      name: "mixamorigRightArm",
                      pos: [-0.14, 0, 0],
                      children: [
                        {
                          name: "mixamorigRightForeArm",
                          pos: [-0.28, 0, 0],
                          children: [
                            {
                              name: "mixamorigRightHand",
                              pos: [-0.26, 0, 0],
                              children: [
                                { name: "mixamorigRightHandEnd", pos: [-0.1, 0, 0] },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "mixamorigLeftUpLeg",
      pos: [0.1, -0.05, 0],
      children: [
        {
          name: "mixamorigLeftLeg",
          pos: [0, -0.42, 0],
          children: [
            {
              name: "mixamorigLeftFoot",
              pos: [0, -0.42, 0],
              children: [{ name: "mixamorigLeftToeBase", pos: [0, -0.04, 0.12] }],
            },
          ],
        },
      ],
    },
    {
      name: "mixamorigRightUpLeg",
      pos: [-0.1, -0.05, 0],
      children: [
        {
          name: "mixamorigRightLeg",
          pos: [0, -0.42, 0],
          children: [
            {
              name: "mixamorigRightFoot",
              pos: [0, -0.42, 0],
              children: [{ name: "mixamorigRightToeBase", pos: [0, -0.04, 0.12] }],
            },
          ],
        },
      ],
    },
  ],
};

function buildBone(def: BoneDef): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = def.name;
  bone.position.set(def.pos[0], def.pos[1], def.pos[2]);
  for (const child of def.children ?? []) {
    bone.add(buildBone(child));
  }
  return bone;
}

/**
 * Build a scene root containing a Mixamo T-pose hierarchy.
 * Same shape as FBXLoader output (Group with bones) so VoxelCharacter can clone it.
 */
export function createProceduralMixamoSkeleton(): THREE.Group {
  const root = new THREE.Group();
  root.name = "ProceduralMixamoSkeleton";
  root.userData.proceduralMixamo = true;
  const hips = buildBone(MIXAMO_TREE);
  root.add(hips);
  root.updateMatrixWorld(true);
  return root;
}
