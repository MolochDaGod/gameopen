/**
 * Agama map fit — keep Sketchfab/FBX authored metres, size props to a 1.8 m
 * character, LOD far meshes, and pad a tiny fallback with battleground terrain.
 */
import * as THREE from "three";
import {
  AGAMA_FARM_PLOT,
  AGAMA_HARVEST_HEIGHT_M,
  AGAMA_LOD_CULL,
  AGAMA_LOD_FAR,
  AGAMA_LOD_MID,
  AGAMA_LOD_NEAR,
  AGAMA_ORE_HEIGHT_M,
  AGAMA_PLAYER_HEIGHT_M,
  AGAMA_TREE_HEIGHT_M,
  decideAgamaMapScale,
  type AgamaHarvestNode,
  type AgamaLayout,
  type AgamaZone,
} from "./agamaBattleground";

const FBX_SCALE_EPS = 0.004;

export function detectFbxCmChild(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (found) return;
    const n = (o.name || "").toLowerCase();
    const s = o.scale;
    const uniform =
      Math.abs(s.x - s.y) < 0.002 && Math.abs(s.y - s.z) < 0.002;
    if (!uniform) return;
    if (Math.abs(s.x - 0.01) < FBX_SCALE_EPS) {
      if (/fbx|sketchfab|rootnode|map/i.test(n) || s.x < 0.02) found = true;
    }
  });
  return found;
}

export function hideMapHelpers(root: THREE.Object3D): THREE.Object3D | null {
  let playerNode: THREE.Object3D | null = null;
  root.traverse((o) => {
    const n = (o.name || "").toLowerCase();
    if (n === "player" || n === "spawn" || n.endsWith("_player")) {
      playerNode = o;
      o.visible = false;
    }
    if (/^(camera|cam_|sun|light|helper|dummy_cam)/i.test(n)) {
      o.visible = false;
    }
  });
  return playerNode;
}

export function measureDoorHeight(root: THREE.Object3D): number {
  let best = 0;
  root.traverse((o) => {
    if (!/door/i.test(o.name || "")) return;
    const box = new THREE.Box3().setFromObject(o);
    const h = box.getSize(new THREE.Vector3()).y;
    if (h > 0.2 && h < 12 && Math.abs(h - AGAMA_PLAYER_HEIGHT_M) < Math.abs(best - AGAMA_PLAYER_HEIGHT_M)) {
      best = h;
    } else if (best === 0 && h > 0.05) {
      best = h;
    }
  });
  return best;
}

export interface AgamaFitResult {
  half: number;
  unitScale: number;
  playScale: number;
  reason: string;
  spawn: THREE.Vector3;
  extractHint: THREE.Vector3;
}

export function fitAgamaMap(root: THREE.Object3D, battleground: boolean): AgamaFitResult {
  const playerNode = hideMapHelpers(root);
  root.updateMatrixWorld(true);

  const spawnWorld = new THREE.Vector3();
  if (playerNode) playerNode.getWorldPosition(spawnWorld);

  let box = new THREE.Box3().setFromObject(root);
  let size = box.getSize(new THREE.Vector3());
  let spanXZ = Math.max(size.x, size.z) || 1;
  const doorHeight = measureDoorHeight(root);
  const hasFbxCmChild = detectFbxCmChild(root);

  const decision = decideAgamaMapScale(
    { spanXZ, height: size.y || 1, hasFbxCmChild, doorHeight },
    battleground,
  );
  const combined = decision.unitScale * decision.playScale;
  if (Math.abs(combined - 1) > 0.001) {
    root.scale.multiplyScalar(combined);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    size = box.getSize(new THREE.Vector3());
    spanXZ = Math.max(size.x, size.z) || 1;
    if (playerNode) playerNode.getWorldPosition(spawnWorld);
  }

  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);

  spawnWorld.x -= c.x;
  spawnWorld.z -= c.z;
  spawnWorld.y = 0;

  const finalBox = new THREE.Box3().setFromObject(root);
  const finalSize = finalBox.getSize(new THREE.Vector3());
  const half = Math.max(finalSize.x, finalSize.z) * 0.5;

  if (!playerNode) {
    spawnWorld.set(0, 0, -Math.min(half * 0.55, 220));
  }

  const extractHint = new THREE.Vector3(spawnWorld.x, 0, spawnWorld.z + Math.min(half * 0.82, half - 24));

  return {
    half,
    unitScale: decision.unitScale,
    playScale: decision.playScale,
    reason: decision.reason,
    spawn: spawnWorld,
    extractHint,
  };
}

export function applyAgamaMeshLod(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = true;
    m.receiveShadow = true;
    const n = (m.name || m.parent?.name || "").toLowerCase();
    const landmark = /barn|house|silo|wind|bridge|church|tower|mill/.test(n);
    m.userData.agamaLandmark = landmark;
    m.castShadow = landmark;
    meshes.push(m);
  });
  return meshes;
}

export function updateAgamaMeshLod(
  meshes: THREE.Mesh[],
  player: THREE.Vector3,
  scratch = new THREE.Vector3(),
): void {
  for (const m of meshes) {
    m.getWorldPosition(scratch);
    const d = Math.hypot(scratch.x - player.x, scratch.z - player.z);
    const landmark = !!m.userData.agamaLandmark;
    m.visible = landmark ? d < AGAMA_LOD_CULL * 1.4 : d < AGAMA_LOD_CULL;
    m.castShadow = landmark && d < AGAMA_LOD_MID;
    if (!landmark && d > AGAMA_LOD_FAR) {
      m.castShadow = false;
    }
    if (!landmark && d < AGAMA_LOD_NEAR) {
      m.castShadow = d < AGAMA_LOD_NEAR * 0.6;
    }
  }
}

export function buildPadTerrain(half: number): THREE.Group {
  const g = new THREE.Group();
  g.name = "agama-pad-terrain";
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(half + 8, 72),
    new THREE.MeshStandardMaterial({ color: 0x3d5a32, roughness: 0.94, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(half * 0.92, half + 2, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a3a28, roughness: 0.96 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  return g;
}

export function buildZoneMarkers(layout: AgamaLayout): THREE.Group {
  const g = new THREE.Group();
  g.name = "agama-zones";
  for (const z of layout.zones) {
    const color =
      z.kind === "extract"
        ? 0xffd24d
        : z.kind === "war"
          ? 0xff6a4a
          : z.kind === "safe"
            ? 0x7ee0a0
            : z.kind === "farm"
              ? 0x8ecf6a
              : 0x8ec3ff;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(1.2, z.r - 0.45), z.r, 48),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: z.kind === "extract" ? 0.55 : 0.28,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(z.x, 0.06, z.z);
    ring.userData.zoneId = z.id;
    g.add(ring);

    if (z.kind === "extract") {
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.55, 6.2, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffd24d,
          emissive: 0xaa8800,
          emissiveIntensity: 0.7,
        }),
      );
      beacon.position.set(z.x, 3.1, z.z);
      g.add(beacon);
    }
  }
  return g;
}

export function buildHarvestMeshes(nodes: AgamaHarvestNode[]): THREE.Group {
  const g = new THREE.Group();
  g.name = "agama-harvest";
  const cropGeo = new THREE.ConeGeometry(0.28, AGAMA_HARVEST_HEIGHT_M, 6);
  const cropMat = new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.85 });
  const woodGeo = new THREE.CylinderGeometry(0.22, 0.32, AGAMA_TREE_HEIGHT_M, 6);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const leafGeo = new THREE.SphereGeometry(1.1, 8, 6);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });
  const oreGeo = new THREE.DodecahedronGeometry(AGAMA_ORE_HEIGHT_M * 0.55);
  const oreMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.55, metalness: 0.35 });
  const fiberGeo = new THREE.ConeGeometry(0.22, AGAMA_HARVEST_HEIGHT_M * 0.85, 5);
  const fiberMat = new THREE.MeshStandardMaterial({ color: 0xc5e1a5, roughness: 0.88 });

  for (const n of nodes) {
    const wrap = new THREE.Group();
    wrap.position.set(n.x, 0, n.z);
    wrap.userData.harvestId = n.id;
    if (n.kind === "wood") {
      const trunk = new THREE.Mesh(woodGeo, woodMat);
      trunk.position.y = AGAMA_TREE_HEIGHT_M * 0.5;
      trunk.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = AGAMA_TREE_HEIGHT_M * 0.85;
      wrap.add(trunk, leaf);
    } else if (n.kind === "ore") {
      const ore = new THREE.Mesh(oreGeo, oreMat);
      ore.position.y = AGAMA_ORE_HEIGHT_M * 0.5;
      ore.castShadow = true;
      wrap.add(ore);
    } else if (n.kind === "fiber") {
      const f = new THREE.Mesh(fiberGeo, fiberMat);
      f.position.y = AGAMA_HARVEST_HEIGHT_M * 0.42;
      wrap.add(f);
    } else {
      const c = new THREE.Mesh(cropGeo, cropMat);
      c.position.y = AGAMA_HARVEST_HEIGHT_M * 0.5;
      wrap.add(c);
    }
    g.add(wrap);
  }
  return g;
}

export function buildFarmPlots(zones: AgamaZone[]): THREE.Group {
  const g = new THREE.Group();
  g.name = "agama-farm-plots";
  const mat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.92 });
  const geo = new THREE.BoxGeometry(AGAMA_FARM_PLOT.w, 0.08, AGAMA_FARM_PLOT.d);
  for (const z of zones) {
    if (z.kind !== "farm" && z.kind !== "safe") continue;
    const plot = new THREE.Mesh(geo, mat);
    plot.position.set(z.x, 0.04, z.z);
    plot.receiveShadow = true;
    g.add(plot);
  }
  return g;
}
