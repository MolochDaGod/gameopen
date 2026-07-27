/**
 * Player head bridge — applies a saved Avatar Edit build onto the Explorer
 * rig's box head in-game.
 *
 * Avatar Edit's "Save to Character" persists one {@link AvatarConfig} under
 * {@link PLAYER_HEAD_KEY}; when the player's Explorer character builds its
 * body, the rig calls {@link applyAvatarHead} to swap the plain skin-coloured
 * head cube for the six composed pixel faces + protrusion boxes (ears / nose /
 * tusks / hair / horns). Everything created here is owned by the returned
 * handle and freed via its `dispose()` — the rig's shared materials are never
 * touched.
 */
import * as THREE from "three";
import { FACE, type Grid, cssHex } from "./pixels";
import { defaultConfig, sanitizeConfig, type AvatarConfig, type RaceId as AvatarRaceId } from "./catalog";
import { composeHead, composeTalkFrames, type FaceName } from "./composeHead";
import { createHairBoxMaterial, createHairFx, type HairBoxMaterial } from "./hairStrands";
import { createHairMotionRig } from "./hairMotion";
import { mountHat, resolveMountedHatId } from "./hats";

/** Talk-loop playback rate (frames per second). */
const TALK_FPS = 8;

/** localStorage key for the player's saved in-game head. */
export const PLAYER_HEAD_KEY = "avatarEdit:playerHead:v1";
/** Per lobby seat (0–3) — 4 locations on /lobby campfire. */
export const PLAYER_HEAD_SLOT_PREFIX = "avatarEdit:playerHead:slot:";
/** Per fleet/grudox character id. */
export const PLAYER_HEAD_CHAR_PREFIX = "avatarEdit:playerHead:char:";
/** Avatar Edit race builds (same key as AvatarEditMode). */
export const AVATAR_BUILDS_KEY = "avatarEdit:builds:v1";
/** sessionStorage: which lobby seat Avatar Edit should write. */
export const LOBBY_AVATAR_SLOT_KEY = "grudge.lobby.avatarSlot";

export const AVATAR_HEAD_EVENT = "avatarHead:saved";

/** Empty lobby seat races — distinct mannequins until user saves. */
export const LOBBY_SEAT_RACES: AvatarRaceId[] = [
  "human",
  "orc",
  "elf",
  "barbarian",
];

/** The saved player head, validated; null when unset/corrupt/unavailable. */
export function loadPlayerHeadConfig(): AvatarConfig | null {
  try {
    const raw = localStorage.getItem(PLAYER_HEAD_KEY);
    if (!raw) return null;
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadPlayerHeadForSlot(slot: number): AvatarConfig | null {
  const i = Math.max(0, Math.min(3, slot | 0));
  try {
    const raw = localStorage.getItem(`${PLAYER_HEAD_SLOT_PREFIX}${i}`);
    if (!raw) return null;
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadPlayerHeadForCharacter(characterId: string | null | undefined): AvatarConfig | null {
  if (!characterId) return null;
  try {
    const raw = localStorage.getItem(`${PLAYER_HEAD_CHAR_PREFIX}${characterId}`);
    if (!raw) return null;
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Race builds from Avatar Edit left panel (per race last design). */
export function loadAvatarRaceBuilds(): Partial<Record<AvatarRaceId, AvatarConfig>> {
  try {
    const raw = JSON.parse(localStorage.getItem(AVATAR_BUILDS_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    const out: Partial<Record<AvatarRaceId, AvatarConfig>> = {};
    for (const id of ["human", "barbarian", "orc", "undead", "dwarf", "elf"] as AvatarRaceId[]) {
      const cfg = sanitizeConfig(raw[id]);
      if (cfg && cfg.race === id) out[id] = cfg;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Resolve the Avatar Edit head for a lobby seat (priority):
 * 1. Per-character save
 * 2. Per-slot save (0–3)
 * 3. Race build from Avatar Edit
 * 4. Global "Save to character" head (only when character bound)
 * 5. Race default (always has a painted face)
 */
export function resolveLobbySeatAvatar(
  slot: number,
  opts?: { characterId?: string | null; raceKey?: string | null },
): AvatarConfig {
  const i = Math.max(0, Math.min(3, slot | 0));
  const byChar = loadPlayerHeadForCharacter(opts?.characterId);
  if (byChar) return byChar;
  const bySlot = loadPlayerHeadForSlot(i);
  if (bySlot) return bySlot;
  const race = raceKeyToAvatarRace(opts?.raceKey) ?? LOBBY_SEAT_RACES[i] ?? "human";
  const builds = loadAvatarRaceBuilds();
  if (builds[race]) return builds[race]!;
  if (opts?.characterId) {
    const global = loadPlayerHeadConfig();
    if (global) return global;
  }
  return defaultConfig(race);
}

export function raceKeyToAvatarRace(raceKey: string | null | undefined): AvatarRaceId | null {
  const r = (raceKey || "").toLowerCase().replace(/_/g, "-");
  if (r === "human" || r === "barbarian" || r === "orc" || r === "undead" || r === "dwarf") {
    return r;
  }
  if (r === "elf" || r === "high-elf" || r === "highelf") return "elf";
  return null;
}

/**
 * Head config for in-game Explorer face. If the player never saved Avatar Edit,
 * seed a race-default head so the cube always has a real painted face (Mine-Loader
 * / play-shell parity) rather than a blank skin block.
 */
export function ensurePlayerHeadConfig(race: AvatarRaceId = "human"): AvatarConfig {
  const existing = loadPlayerHeadConfig();
  if (existing) return existing;
  const cfg = defaultConfig(race);
  savePlayerHeadConfig(cfg);
  return cfg;
}

/** Persist the player's in-game head (best-effort). */
export function savePlayerHeadConfig(cfg: AvatarConfig): void {
  try {
    localStorage.setItem(PLAYER_HEAD_KEY, JSON.stringify(cfg));
    // Notify live Danger Room / Explorer to re-paint the face without full respawn.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AVATAR_HEAD_EVENT, { detail: cfg }));
    }
  } catch {
    /* storage full/blocked — the editor still works, it just won't persist */
  }
}

/**
 * Save head for a lobby seat (and optional character). Also updates global key
 * so Danger/Explorer pick up the latest face.
 */
export function savePlayerHeadForLobbySlot(
  slot: number,
  cfg: AvatarConfig,
  characterId?: string | null,
): void {
  const i = Math.max(0, Math.min(3, slot | 0));
  const clean = sanitizeConfig(cfg);
  if (!clean) return;
  try {
    localStorage.setItem(`${PLAYER_HEAD_SLOT_PREFIX}${i}`, JSON.stringify(clean));
    if (characterId) {
      localStorage.setItem(`${PLAYER_HEAD_CHAR_PREFIX}${characterId}`, JSON.stringify(clean));
    }
    localStorage.setItem(PLAYER_HEAD_KEY, JSON.stringify(clean));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(AVATAR_HEAD_EVENT, {
          detail: { ...clean, lobbySlot: i, characterId: characterId ?? undefined },
        }),
      );
    }
  } catch {
    /* storage full/blocked */
  }
}

export function setLobbyAvatarSlotTarget(slot: number | null): void {
  try {
    if (slot == null || slot < 0) sessionStorage.removeItem(LOBBY_AVATAR_SLOT_KEY);
    else sessionStorage.setItem(LOBBY_AVATAR_SLOT_KEY, String(Math.max(0, Math.min(3, slot | 0))));
  } catch {
    /* ignore */
  }
}

export function getLobbyAvatarSlotTarget(): number | null {
  try {
    const raw = sessionStorage.getItem(LOBBY_AVATAR_SLOT_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(3, n | 0));
  } catch {
    return null;
  }
}

/** Remove the saved head (revert to the default box head). */
export function clearPlayerHeadConfig(): void {
  try {
    localStorage.removeItem(PLAYER_HEAD_KEY);
  } catch {
    /* ignore */
  }
}

/** BoxGeometry material index order: +x, -x, +y, -y, +z, -z. */
const FACE_ORDER: FaceName[] = ["right", "left", "top", "bottom", "front", "back"];

/** Handle owning every GPU resource {@link applyAvatarHead} created. */
export interface AvatarHeadHandle {
  /** Per-frame hair-strand wind sway + talk-loop mouth; `timeSec` is absolute seconds. */
  update(timeSec: number): void;
  /**
   * Toggle the looping talking mouth (used while the character speaks
   * in-game). Frames are composed lazily on first use; turning it off
   * restores the saved face.
   */
  setTalking(on: boolean): void;
  dispose(): void;
}

/** Blit a 16×16 grid into a canvas (1px per cell). */
function drawGrid(canvas: HTMLCanvasElement, grid: Grid): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  for (let y = 0; y < FACE; y++)
    for (let x = 0; x < FACE; x++) {
      ctx.fillStyle = cssHex(grid[y * FACE + x]);
      ctx.fillRect(x, y, 1, 1);
    }
}

/**
 * Dress an existing box-head mesh with the composed avatar: replaces its
 * material with six nearest-filtered pixel faces and parents a protrusion
 * group (scaled from head-unit space by `size`). The caller keeps ownership
 * of the mesh + its geometry; call the returned handle's `dispose()` when the
 * rig is torn down (it does NOT restore the previous material — the rig is
 * expected to be discarded with it).
 */
export function applyAvatarHead(
  head: THREE.Mesh,
  cfg: AvatarConfig,
  size: number,
): AvatarHeadHandle {
  const composed = composeHead(cfg);

  const textures: THREE.CanvasTexture[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  for (const name of FACE_ORDER) {
    const canvas = document.createElement("canvas");
    canvas.width = FACE;
    canvas.height = FACE;
    drawGrid(canvas, composed.faces[name]);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.push(tex);
    materials.push(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 }));
  }
  head.material = materials;

  // Protrusions live in head-unit space (head = unit cube); scale to world.
  const group = new THREE.Group();
  group.name = "AvatarHead";
  group.scale.setScalar(size);
  const protGeo = new THREE.BoxGeometry(1, 1, 1);
  const protMats = new Map<number, THREE.MeshStandardMaterial>();
  const hairMats: HairBoxMaterial[] = [];
  // Hanging hair/beard boxes swing from pivot groups (wind + gravity).
  const motionRig = createHairMotionRig();
  composed.protrusions.forEach((p, i) => {
    // Hair boxes get per-box pixel strand textures; fine instanced strands
    // overlay them. Plain (non-hair) boxes pool flat materials by colour.
    let mat: THREE.MeshStandardMaterial;
    // Hair AND beard boxes get the realistic strand material; only ears,
    // noses, tusks etc. stay pooled flat colours.
    if (p.hair || p.slot === "facialHair") {
      const hm = createHairBoxMaterial(p, i);
      hairMats.push(hm);
      mat = hm.mat;
    } else {
      let pooled = protMats.get(p.color);
      if (!pooled) {
        pooled = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9, metalness: 0 });
        protMats.set(p.color, pooled);
      }
      mat = pooled;
    }
    const mesh = new THREE.Mesh(protGeo, mat);
    mesh.scale.set(p.w, p.h, p.d);
    mesh.castShadow = true;
    if (p.motion) {
      group.add(motionRig.wrap(p as typeof p & { motion: NonNullable<typeof p.motion> }, mesh));
    } else {
      mesh.position.set(p.x, p.y, p.z);
      group.add(mesh);
    }
  });

  // Fine hair strands: one InstancedMesh in the same head-unit group. Kept a
  // little leaner than the editor stage — this renders per character in-game.
  const hairFx = createHairFx(
    composed.protrusions.filter((p) => p.hair || p.slot === "facialHair"),
    { maxStrands: 5000, castShadow: true },
  );
  if (hairFx) group.add(hairFx.object);
  head.add(group);

  // 3D GLB hat rides in the same head-unit group (async; clones share the
  // cached template's geometry/materials — dispose only detaches).
  const mountedHat = resolveMountedHatId(cfg);
  const hatAdjust =
    mountedHat === "horns" && cfg.hat === "none" ? cfg.adjust?.headgear : cfg.adjust?.hat;
  const hat = mountHat(group, mountedHat, hatAdjust);

  // --- talking loop: flip the front-face texture between talk frames ---
  const frontIdx = FACE_ORDER.indexOf("front");
  const frontCanvas = materials[frontIdx].map!.image as HTMLCanvasElement;
  const frontTex = textures[frontIdx];
  let talkFrames: Grid[] | null = null; // composed lazily on first setTalking
  let talking = false;
  let shownFrame = -1; // -1 = the saved (non-talking) face is on the canvas

  let disposed = false;
  const worldQuat = new THREE.Quaternion();
  const handle: AvatarHeadHandle = {
    update(timeSec: number) {
      if (disposed) return;
      hairFx?.update(timeSec);
      if (motionRig.size > 0) {
        // World-down in head space: dreads/beards keep hanging down while
        // the character animates (nods, rolls, sprints).
        group.getWorldQuaternion(worldQuat);
        motionRig.update(timeSec, worldQuat);
      }
      if (talking && talkFrames) {
        const frame = Math.floor(timeSec * TALK_FPS) % talkFrames.length;
        if (frame !== shownFrame) {
          shownFrame = frame;
          drawGrid(frontCanvas, talkFrames[frame]);
          frontTex.needsUpdate = true;
        }
      }
    },
    setTalking(on: boolean) {
      if (disposed || on === talking) return;
      talking = on;
      if (on) {
        talkFrames ??= composeTalkFrames(cfg);
      } else if (shownFrame !== -1) {
        shownFrame = -1;
        drawGrid(frontCanvas, composed.faces.front);
        frontTex.needsUpdate = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      hat.dispose();
      hairFx?.dispose();
      head.remove(group);
      protGeo.dispose();
      for (const m of protMats.values()) m.dispose();
      for (const hm of hairMats) hm.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
  // A head saved with the talking expression loops its speech animation
  // in-game automatically — that's what the expression means on a live rig.
  if (cfg.expression === "talking") handle.setTalking(true);
  return handle;
}
