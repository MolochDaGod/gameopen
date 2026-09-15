/**
 * FootAuraSystem — CraftPix top-down magic buff sprites under characters' feet.
 *
 * Orientation (best practices for 3D SI worlds):
 * - **ground** (default): plane on XZ under the character
 *   `mesh.rotation.x = -Math.PI / 2` — same as fire cast rings in builders.ts.
 *   Correct for "around feet / ground aura" and elevated TPS/top-down cameras.
 * - **yBillboard**: upright plane, yaw-only face camera — better shows painted
 *   vertical spikes when camera is low (side-on TPS).
 * - **hybrid**: ground ring plane + lighter vertical billboard of the same sheet.
 *
 * Anchoring:
 * - Parent the aura root to the character (or a foot socket).
 * - Keep **world yaw independent** of character facing for rings (optional)
 *   so the ring doesn't spin with every turn.
 * - Y lift: +0.02…0.05 m above ground to avoid z-fight with terrain.
 *
 * Materials: transparent + AdditiveBlending, depthWrite false, renderOrder low
 * so the body draws over the aura.
 *
 * Alerts: {@link FootAuraHandle.iconUrl} + `onChange` for HUD buff icons.
 */
import * as THREE from "three";
import {
  ALL_FOOT_AURA_IDS,
  FOOT_AURA_DEFS,
  footAuraFrameUrl,
  footAuraIconUrl,
  type FootAuraId,
} from "./footAuraCatalog.js";

export type FootAuraOrient = "ground" | "yBillboard" | "hybrid";

export interface FootAuraSystemOptions {
  /** Public/CDN base, no trailing slash (e.g. "" for same-origin, or CDN origin). */
  assetBase?: string;
  /** Default orientation for new auras. */
  orient?: FootAuraOrient;
  /**
   * When true (default), ground auras counter-rotate character yaw so the
   * painted ring stays world-stable while the hero turns.
   */
  lockWorldYaw?: boolean;
  /** Lift above foot plane (metres). Default 0.03. */
  yLift?: number;
}

export interface ApplyAuraOptions {
  id: FootAuraId;
  /** Seconds; omit or Infinity for permanent until clear. */
  duration?: number;
  orient?: FootAuraOrient;
  /** Diameter override (m). */
  diameterM?: number;
  /** Playback speed multiplier (default 1). */
  timeScale?: number;
  /** Opacity 0–1 (default 0.95 additive). */
  opacity?: number;
  /** Stack index for multi-aura ring offset (0 = centered). */
  stackIndex?: number;
}

export interface FootAuraHandle {
  id: FootAuraId;
  label: string;
  kind: string;
  iconUrl: string;
  /** Remaining seconds; Infinity if permanent. */
  remaining: number;
  stop(): void;
}

export type FootAuraChangeListener = (active: FootAuraHandle[]) => void;

interface LiveAura {
  id: FootAuraId;
  root: THREE.Group;
  ground: THREE.Mesh | null;
  billboard: THREE.Mesh | null;
  mats: THREE.MeshBasicMaterial[];
  frames: THREE.Texture[];
  frame: number;
  acc: number;
  fps: number;
  timeScale: number;
  remaining: number;
  permanent: boolean;
  orient: FootAuraOrient;
  stackIndex: number;
  iconUrl: string;
  label: string;
  kind: string;
}

const _camForward = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _localZ = new THREE.Vector3(0, 0, 1);

function makeMat(
  map: THREE.Texture | null,
  opacity: number,
  tint?: string,
): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    map: map ?? undefined,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    opacity,
    color: tint ? new THREE.Color(tint) : new THREE.Color(0xffffff),
    toneMapped: false,
  });
  return m;
}

/**
 * Per-character foot aura manager. Create one, parent `root` under the hero
 * (or a feet socket), call `update(dt, camera?)` each frame.
 */
export class FootAuraSystem {
  /** Attach this group under the character (feet / root). */
  readonly root = new THREE.Group();
  private readonly base: string;
  private readonly defaultOrient: FootAuraOrient;
  private readonly lockWorldYaw: boolean;
  private readonly yLift: number;
  private readonly live = new Map<FootAuraId, LiveAura>();
  private readonly texCache = new Map<string, Promise<THREE.Texture[]>>();
  private readonly loader = new THREE.TextureLoader();
  private listeners = new Set<FootAuraChangeListener>();
  private parentYaw = 0;

  constructor(opts: FootAuraSystemOptions = {}) {
    this.base = (opts.assetBase ?? "").replace(/\/$/, "");
    this.defaultOrient = opts.orient ?? "ground";
    this.lockWorldYaw = opts.lockWorldYaw !== false;
    this.yLift = opts.yLift ?? 0.03;
    this.root.name = "FootAuraSystem";
    this.root.position.y = this.yLift;
  }

  onChange(fn: FootAuraChangeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emitChange(): void {
    const list = this.listActive();
    for (const fn of this.listeners) fn(list);
  }

  listActive(): FootAuraHandle[] {
    const out: FootAuraHandle[] = [];
    for (const a of this.live.values()) {
      out.push(this.toHandle(a));
    }
    return out;
  }

  private toHandle(a: LiveAura): FootAuraHandle {
    return {
      id: a.id,
      label: a.label,
      kind: a.kind,
      iconUrl: a.iconUrl,
      remaining: a.permanent ? Infinity : a.remaining,
      stop: () => this.clear(a.id),
    };
  }

  /** Preload frame textures for one or all aura ids. */
  async preload(ids: FootAuraId[] = ALL_FOOT_AURA_IDS): Promise<void> {
    await Promise.all(ids.map((id) => this.loadFrames(id)));
  }

  private loadFrames(id: FootAuraId): Promise<THREE.Texture[]> {
    const cached = this.texCache.get(id);
    if (cached) return cached;
    const def = FOOT_AURA_DEFS[id];
    const p = (async () => {
      const textures: THREE.Texture[] = [];
      for (let i = 1; i <= def.frameCount; i++) {
        const url = footAuraFrameUrl(this.base, id, i);
        try {
          const tex = await this.loader.loadAsync(url);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
          textures.push(tex);
        } catch {
          // skip missing frame
        }
      }
      if (textures.length === 0) {
        // 1×1 white fallback so mesh still exists
        const data = new Uint8Array([255, 255, 255, 80]);
        const t = new THREE.DataTexture(data, 1, 1);
        t.needsUpdate = true;
        textures.push(t);
      }
      return textures;
    })();
    this.texCache.set(id, p);
    return p;
  }

  /**
   * Apply (or refresh) an aura under the character. Replaces an existing
   * instance of the same id.
   */
  async apply(opts: ApplyAuraOptions): Promise<FootAuraHandle> {
    const def = FOOT_AURA_DEFS[opts.id];
    if (!def) throw new Error(`Unknown foot aura: ${opts.id}`);

    this.clear(opts.id, false);

    const frames = await this.loadFrames(opts.id);
    const orient = opts.orient ?? this.defaultOrient;
    const diameter = opts.diameterM ?? def.diameterM;
    const opacity = opts.opacity ?? 0.95;
    const stackIndex = opts.stackIndex ?? 0;
    const timeScale = opts.timeScale ?? 1;
    const duration = opts.duration;
    const permanent = duration == null || !Number.isFinite(duration);

    const group = new THREE.Group();
    group.name = `footAura_${opts.id}`;
    // Multi-aura: slight radial offset so stacks stay readable
    if (stackIndex > 0) {
      const ang = (stackIndex * Math.PI * 2) / 6;
      const r = 0.12 * stackIndex;
      group.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    }

    const aspect = 640 / 800; // craftpix frame aspect W/H
    // Plane height in world metres; diameter maps to the ring's visual width
    const planeH = diameter / Math.max(0.55, aspect * 0.85);
    const planeW = planeH * aspect;
    const geo = new THREE.PlaneGeometry(planeW, planeH);
    const mats: THREE.MeshBasicMaterial[] = [];
    let ground: THREE.Mesh | null = null;
    let billboard: THREE.Mesh | null = null;

    const map0 = frames[0] ?? null;

    if (orient === "ground" || orient === "hybrid") {
      const mat = makeMat(map0, opacity, def.tint);
      mats.push(mat);
      ground = new THREE.Mesh(geo, mat);
      // CRITICAL: lay flat on XZ — under feet
      ground.rotation.x = -Math.PI / 2;
      // Frames are painted with ring toward image bottom; rotate so art "up"
      // points toward -Z (character forward in many fleets) — tweak if needed
      ground.rotation.z = 0;
      ground.renderOrder = -2;
      ground.frustumCulled = true;
      group.add(ground);
    }

    if (orient === "yBillboard" || orient === "hybrid") {
      const mat = makeMat(
        map0,
        orient === "hybrid" ? opacity * 0.55 : opacity,
        def.tint,
      );
      mats.push(mat);
      // Separate geometry instance for independent transform
      billboard = new THREE.Mesh(geo.clone(), mat);
      billboard.position.y = planeH * 0.35;
      billboard.renderOrder = -1;
      group.add(billboard);
    }

    this.root.add(group);

    const live: LiveAura = {
      id: opts.id,
      root: group,
      ground,
      billboard,
      mats,
      frames,
      frame: 0,
      acc: 0,
      fps: def.fps,
      timeScale,
      remaining: permanent ? Infinity : Math.max(0, duration!),
      permanent,
      orient,
      stackIndex,
      iconUrl: footAuraIconUrl(this.base, opts.id),
      label: def.label,
      kind: def.kind,
    };
    this.live.set(opts.id, live);
    this.emitChange();
    return this.toHandle(live);
  }

  /** Remove one aura (or all if id omitted). */
  clear(id?: FootAuraId, notify = true): void {
    const ids = id ? [id] : [...this.live.keys()];
    for (const k of ids) {
      const a = this.live.get(k);
      if (!a) continue;
      this.root.remove(a.root);
      for (const m of a.mats) {
        m.map = null;
        m.dispose();
      }
      a.ground?.geometry.dispose();
      a.billboard?.geometry.dispose();
      this.live.delete(k);
    }
    if (notify) this.emitChange();
  }

  /**
   * Per-frame: advance sheets, expire TTL, billboard yaw, optional world-yaw lock.
   * Pass `camera` when using yBillboard / hybrid.
   */
  update(dt: number, camera?: THREE.Camera): void {
    // Parent yaw for lockWorldYaw (parent may be character root)
    if (this.lockWorldYaw && this.root.parent) {
      this.root.parent.getWorldQuaternion(_q);
      const e = _e.setFromQuaternion(_q, "YXZ");
      this.parentYaw = e.y;
      // Counter-rotate system root so ground rings stay world-aligned
      this.root.rotation.y = -this.parentYaw;
    }

    if (camera) {
      camera.getWorldPosition(_camPos);
    }

    const doomed: FootAuraId[] = [];
    for (const a of this.live.values()) {
      if (!a.permanent) {
        a.remaining -= dt;
        if (a.remaining <= 0) {
          doomed.push(a.id);
          continue;
        }
      }

      // Frame advance
      a.acc += dt * a.timeScale;
      const spf = 1 / Math.max(1, a.fps);
      while (a.acc >= spf) {
        a.acc -= spf;
        a.frame = (a.frame + 1) % a.frames.length;
        const tex = a.frames[a.frame];
        for (const m of a.mats) {
          m.map = tex;
          m.needsUpdate = true;
        }
      }

      // Yaw-only billboard toward camera
      if (a.billboard && camera) {
        a.billboard.getWorldPosition(_look);
        _camForward.copy(_camPos).sub(_look);
        _camForward.y = 0;
        if (_camForward.lengthSq() > 1e-6) {
          _camForward.normalize();
          a.billboard.quaternion.setFromUnitVectors(_localZ, _camForward);
        }
      }
    }

    for (const id of doomed) this.clear(id, false);
    if (doomed.length) this.emitChange();
  }

  dispose(): void {
    this.clear(undefined, false);
    this.listeners.clear();
    // Textures stay cached for other systems / re-apply in session
  }
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/** Convenience: attach a FootAuraSystem under `character` and return it. */
export function attachFootAuraSystem(
  character: THREE.Object3D,
  opts?: FootAuraSystemOptions,
): FootAuraSystem {
  const sys = new FootAuraSystem(opts);
  character.add(sys.root);
  return sys;
}
