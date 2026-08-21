/**
 * CraftPix top-down magic-buff sprite as an under-feet ground ring.
 * Used by StatusAura (warlords + voxel / explorer) so every character gets
 * the same foot FX when buffs/debuffs apply.
 *
 * Plane already lies on XZ (same as unitGroundPlane): rotation.x = -PI/2.
 * Frames: /vfx/craftpix-magic-buff/{folder}/PNG/{prefix}_Frame_NN.png
 */
import * as THREE from "three";
// Catalog only — not @workspace/vfx index (that pulls three.quarks).
import {
  FOOT_AURA_DEFS,
  footAuraFrameUrl,
  footAuraIconUrl,
  type FootAuraId,
} from "@workspace/vfx/footAuraCatalog";
import type { StatusId } from "../types";

/** Map Danger Room status ids → CraftPix foot aura pack. */
export const STATUS_TO_FOOT_AURA: Partial<Record<StatusId, FootAuraId>> = {
  empowered: "strength",
  rage: "strength",
  burning: "debuff",
  poisoned: "debuff",
  cursed: "debuff",
  frozen: "debuff",
  shocked: "debuff",
  rooted: "debuff",
  sleep: "debuff",
  shielded: "immunity",
  absorb: "immunity",
  regen: "life",
  blessed: "life",
  haste: "mana",
};

const frameCache = new Map<FootAuraId, Promise<THREE.Texture[]>>();
const loader = new THREE.TextureLoader();

function assetBase(): string {
  // Vite BASE_PATH (e.g. "/" or "/animator/")
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env
    ?.BASE_URL;
  if (base && base !== "/") return base.replace(/\/$/, "");
  return "";
}

export function loadCraftpixFrames(id: FootAuraId): Promise<THREE.Texture[]> {
  const hit = frameCache.get(id);
  if (hit) return hit;
  const def = FOOT_AURA_DEFS[id];
  const p = (async () => {
    const out: THREE.Texture[] = [];
    const base = assetBase();
    for (let i = 1; i <= def.frameCount; i++) {
      const url = footAuraFrameUrl(base, id, i);
      try {
        const tex = await loader.loadAsync(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        out.push(tex);
      } catch {
        /* skip missing frame */
      }
    }
    return out;
  })();
  frameCache.set(id, p);
  return p;
}

export function craftpixIconForStatus(id: StatusId): string | null {
  const aura = STATUS_TO_FOOT_AURA[id];
  if (!aura) return null;
  return footAuraIconUrl(assetBase(), aura);
}

/**
 * Animated ground plane (XZ) for one CraftPix aura id.
 * Call {@link ready} before first show; {@link update} advances frames.
 */
export class CraftpixFootRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private frames: THREE.Texture[] = [];
  private frame = 0;
  private acc = 0;
  private fps = 12;
  private readyP: Promise<void>;

  constructor(auraId: FootAuraId, diameterM = 1.55) {
    const def = FOOT_AURA_DEFS[auraId];
    this.fps = def.fps;
    this.mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.92,
      color: def.tint ? new THREE.Color(def.tint) : new THREE.Color(0xffffff),
      toneMapped: false,
    });
    // Own geometry so we can scale W/H for 640×800 art
    const aspect = 640 / 800;
    const h = diameterM / Math.max(0.55, aspect * 0.85);
    const w = h * aspect;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateX(-Math.PI / 2); // under feet — correct angle
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.y = 0.035;
    this.mesh.renderOrder = -2;
    this.mesh.name = `craftpixFoot:${auraId}`;
    this.mesh.visible = false;

    this.readyP = loadCraftpixFrames(auraId).then((frames) => {
      this.frames = frames;
      if (frames[0]) {
        this.mat.map = frames[0];
        this.mat.needsUpdate = true;
        this.mesh.visible = true;
      }
    });
  }

  ready(): Promise<void> {
    return this.readyP;
  }

  update(dt: number) {
    if (this.frames.length < 2) return;
    this.acc += dt;
    const spf = 1 / this.fps;
    while (this.acc >= spf) {
      this.acc -= spf;
      this.frame = (this.frame + 1) % this.frames.length;
      this.mat.map = this.frames[this.frame]!;
      this.mat.needsUpdate = true;
    }
  }

  dispose() {
    this.mat.map = null;
    this.mat.dispose();
    this.mesh.geometry.dispose();
  }
}
