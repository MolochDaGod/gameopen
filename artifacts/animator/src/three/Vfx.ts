import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { SkillKind } from "./types";
import { asset } from "./assets";
import { CHI_FIRE_COLORS, DEFAULT_FIRE_FX, type FireFxParams } from "./fxSettings";
import type { SlashFxParams } from "./slashSettings";
import { SmokeFx } from "./SmokeFx";
import { ringTexture, unitGroundPlane } from "./fx/fxTextures";

/** Which 4-stop palette the flame system currently uses. */
export type FireTheme = "fire" | "chi";

interface Effect {
  obj: THREE.Object3D;
  age: number;
  life: number;
  update: (e: Effect, dt: number) => void;
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
  /** Plays embedded GLB clips for model-driven effects. */
  mixer?: THREE.AnimationMixer;
  /**
   * GLB clones share geometry + textures with their template, so disposing
   * those would corrupt the template. When false, update()/dispose() only frees
   * the cloned materials (not their maps) and skips geometry disposal.
   */
  shared?: boolean;
  /**
   * Geometry the effect OWNS and must always dispose on free, regardless of
   * `shared`. Used when the texture/map is shared with a template but the
   * geometry is a unique per-spawn clone (e.g. a deformed slash crescent).
   */
  ownGeos?: THREE.BufferGeometry[];
  /**
   * The material is per-spawn (owned, gets disposed) but its `map` is a
   * module-cached singleton (e.g. `ringTexture()`) that must NOT be disposed.
   * Without this, every ground-ring/shockwave teardown disposes the shared
   * ring texture and forces a GPU re-upload on the next cast.
   */
  sharedMaps?: boolean;
}

const THEME: Record<SkillKind, number> = {
  slash: 0x9fe8ff,
  slam: 0xffb24d,
  bolt: 0x6fd6ff,
  nova: 0xb98cff,
  muzzle: 0xfff2a8,
  thrust: 0xff6f6f,
  // Model-driven projectile/spell skills (vfx-sandbox templates).
  fireDragon: 0xff6a1e,
  meteor: 0xff8a3d,
  turret: 0x8fd0ff,
  darkBlades: 0xb070ff,
  swordVolley: 0xa8e6ff,
  soul: 0x8fffe0,
  laser: 0xff5a3c,
};

/** Projectile/spell GLB template paths + their normalised display size. */
const MODEL_VFX = {
  dragon: ["models/vfx/dragon.glb", 2.4],
  meteor: ["models/vfx/meteor.glb", 1.8],
  /** Classic / pack turret (liked chassis for heavy deploy / kiter). */
  turret: ["models/vfx/turret.glb", 1.4],
  /**
   * Animated game-ready turret (`idle` / `attack` / `destroy`) — skill 2 medium
   * deploy for rifles; barrel node `Turret` aims at hostiles.
   */
  turretGameReady: ["models/vfx/turret-game-ready.glb", 1.15],
  elementalSwords: ["models/vfx/elemental-swords.glb", 2.2],
  soul: ["models/vfx/soul.glb", 1.1],
  laser: ["models/vfx/burst-laser.glb", 1.6],
  // The javelin weapon's GLB doubles as its thrown-projectile base mesh.
  javelin: ["models/weapons/javelin.glb", 1.7],
} as const satisfies Record<string, readonly [string, number]>;

/** Which turret chassis a deploy should use. */
export type TurretVariant = "classic" | "gameReady";

/**
 * Live handle for a deployed turret — aim barrel, sample muzzle, drive attack
 * anims. Studio owns damage timing; Vfx owns mesh + mixer.
 */
export interface TurretHandle {
  dispose: () => void;
  muzzleWorld: () => THREE.Vector3;
  aimAt: (worldTarget: THREE.Vector3) => void;
  playAttack: () => void;
  playDestroy: () => void;
  readonly alive: boolean;
}

/** Toxic-green acid palette for the Mimic's lob + AoE burst. */
const ACID_CORE = 0xeaffb0;
const ACID_BODY = 0x7cff3a;
const ACID_DARK = 0x3f9e1f;

/**
 * Self-contained procedural VFX. No external particle library — every effect is
 * built from additive points/meshes and disposed when its lifetime ends.
 */
export class Vfx {
  private scene: THREE.Scene;
  private effects: Effect[] = [];
  private disposed = false;

  /** Normalised slash-arc meshes (textured anime crescents), ready to clone. */
  private slashArcs: THREE.Mesh[] = [];
  /** Lightning bolt template (skinned) + its looping crackle clip. */
  private lightningTpl: { scene: THREE.Object3D; clip: THREE.AnimationClip | null } | null = null;
  /** Cloneable prop templates (Kiter hexarings / bear-trap / grenade), keyed by path. */
  private propTpls = new Map<string, THREE.Object3D>();
  /**
   * Lazily-loaded projectile/spell GLB templates (dragon / meteor / turret /
   * dark-blades / elemental-swords), keyed by path. Loaded on first cast so the
   * heavier models never cost anything until used; clones share geometry +
   * textures (the spawn marks each effect `shared`).
   */
  private modelTpls = new Map<string, THREE.Object3D>();
  /** Paths whose load is in flight, so we don't double-fetch a template. */
  private modelLoading = new Set<string>();
  /** Animation clips keyed by the same path as {@link modelTpls}. */
  private modelAnims = new Map<string, THREE.AnimationClip[]>();

  // ---- GPU flame system (continuous trail + impact explode) ----
  /** Shared uniforms driving the trailing-flame shader (live-tunable). */
  private fireUniforms = {
    uTime: { value: 0 },
    uBrightness: { value: DEFAULT_FIRE_FX.brightness },
    uTurbulence: { value: DEFAULT_FIRE_FX.turbulence },
    uSizeMult: { value: DEFAULT_FIRE_FX.sizeMult },
    uSpeedMult: { value: DEFAULT_FIRE_FX.speedMult },
    uSideBias: { value: DEFAULT_FIRE_FX.sideBias },
    uEmit: { value: 0 },
    uCore: { value: new THREE.Color(DEFAULT_FIRE_FX.core) },
    uMid: { value: new THREE.Color(DEFAULT_FIRE_FX.mid) },
    uEdge: { value: new THREE.Color(DEFAULT_FIRE_FX.edge) },
    uDark: { value: new THREE.Color(DEFAULT_FIRE_FX.dark) },
  };
  /** Live tuning state (colours used when theme === "fire"). */
  private fireParams: FireFxParams = { ...DEFAULT_FIRE_FX };
  /** Active palette theme; "chi" overrides the editor colours with a cool palette. */
  private fireTheme: FireTheme = "fire";
  /** The long-lived trail points object (created lazily on first emit). */
  private fireTrail: THREE.Points | null = null;
  private fireTrailMat: THREE.ShaderMaterial | null = null;
  private fireTrailGeo: THREE.BufferGeometry | null = null;
  /** CPU copies needed to recompute per-particle life for re-seeding. */
  private fireOff: Float32Array | null = null;
  private fireSpeed: Float32Array | null = null;
  private firePos: Float32Array | null = null;
  /** Current emit segment endpoints (world space). */
  private fireA = new THREE.Vector3();
  private fireB = new THREE.Vector3();
  /** Whether a trail emit was requested THIS frame (consumed in update). */
  private fireEmitReq = false;
  private fireWasEmitting = false;
  /** Eased 0..1 emission factor so the trail fades in/out smoothly. */
  private fireFade = 0;
  private static readonly FIRE_TRAIL_COUNT = 1400;

  // ---- Clean blade-trail ribbon (basic melee swings) ----------------------
  /**
   * A thin additive ribbon swept between the blade grip → tip over the last few
   * frames. Unlike the GPU flame trail it does NOT bloom: a single low-density
   * quad strip that fades cleanly, reading as a crisp anime slash streak.
   */
  private bladeTrail: THREE.Mesh | null = null;
  private bladeTrailGeo: THREE.BufferGeometry | null = null;
  private bladeTrailMat: THREE.ShaderMaterial | null = null;
  private bladePos: Float32Array | null = null;
  private bladeAlpha: Float32Array | null = null;
  /** Recent (base→tip) cross-sections, oldest first. */
  private bladeSamples: { base: THREE.Vector3; tip: THREE.Vector3; age: number }[] = [];
  private bladeColor = new THREE.Color(0x9fe8ff);
  /** Max cross-sections retained (longer = a longer ribbon tail). */
  private static readonly BLADE_TRAIL_MAX = 14;
  /** Seconds a cross-section persists before it is dropped from the tail. */
  private static readonly BLADE_TRAIL_LIFE = 0.13;

  /**
   * GPU-instanced billboard particle system (smoke / fire / sparks / traces).
   * Learned from the illuminsi/MolochDaGod "smoke·fire·trace·steam" technique:
   * one draw call, per-instance billboard mode, premultiplied additive blend.
   */
  private smoke: SmokeFx;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.smoke = new SmokeFx(scene);
    void this.loadGlbAssets();
  }

  // ── instanced billboard particles (smoke / puffs / traces) ───────────────

  /** Soft expanding dust puff (footfalls, landings, whooshes). */
  puff(pos: THREE.Vector3, color = 0xdfe6ee, count = 12, scale = 1) {
    this.smoke.puff(pos, color, count, scale);
  }

  /** Grey smoke pop + sparks layered onto a hit for grit and volume. */
  smokePop(pos: THREE.Vector3, color = 0xffcaa0, scale = 1) {
    this.smoke.smokePop(pos, color, scale);
  }

  /** Timed casting swirl — embers + faint smoke ringing a focus point. */
  castSwirl(pos: THREE.Vector3, color = 0x9fd0ff, duration = 0.8, radius = 0.9) {
    this.smoke.castSwirl(pos, color, duration, radius);
  }

  /** Axis-aligned bullet trail / tracer between two points. */
  bulletTrail(from: THREE.Vector3, to: THREE.Vector3, color = 0xfff1c0) {
    this.smoke.bulletTrail(from, to, color);
  }

  /** Timed rising smoke / steam column (pale cool tint reads as steam). */
  smokeColumn(pos: THREE.Vector3, color = 0x8a8f99, duration = 1.5, rise = 1.6) {
    this.smoke.smokeColumn(pos, color, duration, rise);
  }

  /** Hot fire puff that erupts along `dir` leaving smoke. */
  fireBurst(pos: THREE.Vector3, dir?: THREE.Vector3, scale = 1) {
    this.smoke.fireBurst(pos, dir, scale);
  }

  /**
   * "Hot hands": a tight blaze wreathing a caster's hand — a white-hot core flash
   * and a plume of rising embers that cool to red. Call it on the casting-hand
   * world position each time a fire spell fires so the hands visibly burn while
   * channelling. Additive points + a core mesh + a brief swirl, all self-disposed.
   */
  hotHands(pos: THREE.Vector3, color = 0xff7a1e, scale = 1) {
    const count = Math.max(8, Math.round(18 * scale));
    const positions = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x + (Math.random() - 0.5) * 0.16 * scale;
      positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.16 * scale;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.16 * scale;
      vel.push(
        new THREE.Vector3(
          (Math.random() * 2 - 1) * 0.9,
          0.9 + Math.random() * 1.7,
          (Math.random() * 2 - 1) * 0.9,
        ).multiplyScalar(scale),
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.24 * scale,
      map: this.sparkTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.add({
      obj: points,
      age: 0,
      life: 0.5,
      geos: [geo],
      mats: [mat],
      update: (e, dt) => {
        const arr = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
          vel[i].y -= 1.6 * dt;
          vel[i].x *= 0.95;
          vel[i].z *= 0.95;
          arr[i * 3] += vel[i].x * dt;
          arr[i * 3 + 1] += vel[i].y * dt;
          arr[i * 3 + 2] += vel[i].z * dt;
        }
        geo.attributes.position.needsUpdate = true;
        const t = e.age / e.life;
        mat.opacity = 1 - t;
        if (t > 0.5) mat.color.setHex(0xff3010);
      },
    });
    // White-hot core flash at the palm.
    const cGeo = new THREE.SphereGeometry(0.1 * scale, 8, 6);
    const cMat = new THREE.MeshBasicMaterial({
      color: 0xffe6a0,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Mesh(cGeo, cMat);
    core.position.copy(pos);
    this.add({
      obj: core,
      age: 0,
      life: 0.24,
      geos: [cGeo],
      mats: [cMat],
      update: (e) => {
        const t = e.age / e.life;
        core.scale.setScalar(1 + t * 2.4);
        cMat.opacity = 1 - t;
      },
    });
    // A short swirl of embers ringing the hand for extra volume.
    this.castSwirl(pos, color, 0.45, 0.5 * scale);
  }

  /**
   * Load the model-driven VFX (textured slash arcs + lightning) once. Effects
   * spawned before this resolves fall back to the procedural primitives, so a
   * slow/failed load never blocks combat.
   */
  private async loadGlbAssets() {
    const { sharedGltfLoader } = await import("./loaders/gltf");
    const loader = sharedGltfLoader();
    const norm = (obj: THREE.Object3D, target: number) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const max = Math.max(size.x, size.y, size.z) || 1;
      obj.scale.multiplyScalar(target / max);
    };
    // Slash arcs: 6 textured crescents. Pull each mesh out, bake its world
    // transform into geometry, and additively blend it so it reads as a glow.
    try {
      const { loadGltfFirst } = await import("./assets");
      const g = await loadGltfFirst("models/vfx/attack-slashes.glb", loader);
      if (this.disposed) return;
      g.scene.updateMatrixWorld(true);
      const collected: { name: string; order: number; mesh: THREE.Mesh }[] = [];
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const geo = m.geometry.clone();
        geo.applyMatrix4(m.matrixWorld);
        geo.center();
        const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
        if (src?.map) {
          // Ensure slash atlas is sRGB + filtered for clean glow edges.
          void import("./texturePrep").then(({ prepTexture }) => {
            prepTexture(src.map!, { sRGB: true, mipmaps: true });
          });
        }
        const mat = new THREE.MeshBasicMaterial({
          map: src?.map ?? null,
          color: 0xffffff,
          transparent: true,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          // Premultiplied-style soft edge: better with particle atlases
          opacity: 1,
        });
        if (src?.map) {
          src.map.colorSpace = THREE.SRGBColorSpace;
          src.map.anisotropy = 4;
          src.map.needsUpdate = true;
        }
        const arc = new THREE.Mesh(geo, mat);
        norm(arc, 2.6);
        collected.push({ name: m.name || o.name || "", order: collected.length, mesh: arc });
      });
      // Stable alphabetical order — arc index is deterministic forever for a pack
      collected.sort((a, b) => a.name.localeCompare(b.name) || a.order - b.order);
      for (const c of collected) this.slashArcs.push(c.mesh);
    } catch {
      /* keep procedural fallback */
    }
    // Lightning: a single skinned bolt with a crackle clip.
    try {
      const { loadGltfFirst } = await import("./assets");
      const g = await loadGltfFirst("models/vfx/lightning.glb", loader);
      if (this.disposed) return;
      norm(g.scene, 3.2);
      this.lightningTpl = { scene: g.scene as THREE.Object3D, clip: g.animations[0] ?? null };
    } catch {
      /* lightning is optional flair */
    }
    // Kiter signature props: clone-on-demand templates, normalised to readable
    // sizes. Each is optional — a missing GLB falls back to a procedural shape.
    const props: [string, number][] = [
      ["models/props/magic-hexarings.glb", 1.6],
      ["models/props/bear-trap.glb", 0.7],
      ["models/props/hand-grenade.glb", 0.35],
    ];
    for (const [path, size] of props) {
      try {
        const { loadGltfFirst } = await import("./assets");
        const g = await loadGltfFirst(path, loader);
        if (this.disposed) return;
        norm(g.scene, size);
        this.propTpls.set(path, g.scene);
      } catch {
        /* optional prop */
      }
    }
    // Preload both turret chassis so skill 2 / 4 deploys never miss the first cast.
    {
      const classic = this.turretSpec("classic");
      this.ensureModel(classic.path, classic.size, classic.alts);
      const gr = this.turretSpec("gameReady");
      this.ensureModel(gr.path, gr.size, gr.alts);
    }
  }

  private add(e: Effect) {
    this.scene.add(e.obj);
    this.effects.push(e);
  }

  // --------------------------------------------- Model-driven projectile VFX

  /**
   * Return a normalised projectile/spell GLB template, kicking off a one-time
   * lazy load on first request. Returns null until the load resolves, so the
   * caller can fall back to a procedural primitive for that cast — combat never
   * blocks on a heavy model download.
   */
  private ensureModel(path: string, size: number, altPaths: string[] = []): THREE.Object3D | null {
    const got = this.modelTpls.get(path);
    if (got) return got;
    if (!this.modelLoading.has(path)) {
      this.modelLoading.add(path);
      const candidates = [path, ...altPaths];
      void Promise.all([import("./assets"), import("./loaders/gltf")])
        .then(([{ loadGltfFirst }, { sharedGltfLoader }]) =>
          loadGltfFirst(candidates, sharedGltfLoader()),
        )
        .then((g) => {
          if (this.disposed) return;
          const box = new THREE.Box3().setFromObject(g.scene);
          const sz = new THREE.Vector3();
          box.getSize(sz);
          const max = Math.max(sz.x, sz.y, sz.z) || 1;
          g.scene.scale.multiplyScalar(size / max);
          this.modelTpls.set(path, g.scene);
          // Keep clips for animated turrets (idle / attack / destroy).
          if (g.animations?.length) {
            this.modelAnims.set(path, g.animations.slice());
          }
        })
        .catch(() => {
          /* optional model — procedural fallback stays in play */
        })
        .finally(() => this.modelLoading.delete(path));
    }
    return null;
  }

  /** Resolve chassis path + display size for a turret variant. */
  private turretSpec(variant: TurretVariant = "classic"): {
    path: string;
    size: number;
    alts: string[];
  } {
    if (variant === "gameReady") {
      return {
        path: MODEL_VFX.turretGameReady[0],
        size: MODEL_VFX.turretGameReady[1],
        // Classic pack is same-origin + R2-friendly fallback when game-ready 404s on CDN.
        alts: [MODEL_VFX.turret[0]],
      };
    }
    return {
      path: MODEL_VFX.turret[0],
      size: MODEL_VFX.turret[1],
      // Prefer classic pack; fall back to game-ready animated chassis if missing.
      alts: [MODEL_VFX.turretGameReady[0]],
    };
  }

  /**
   * Find a child mesh/bone whose name matches a gun head / barrel for aim.
   * Game-ready pack uses `Turret`; classic packs vary — fall back to root.
   */
  private findTurretAimNode(root: THREE.Object3D): THREE.Object3D {
    let found: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (found) return;
      const n = (o.name || "").toLowerCase();
      if (
        n === "turret" ||
        n.includes("barrel") ||
        n.includes("gun") ||
        n.includes("cannon") ||
        n.includes("head")
      ) {
        found = o;
      }
    });
    return found ?? root;
  }

  /** Approximate muzzle world position on a turret chassis. */
  private turretMuzzleWorld(root: THREE.Object3D, aimNode: THREE.Object3D): THREE.Vector3 {
    const p = new THREE.Vector3();
    aimNode.getWorldPosition(p);
    // Lift slightly and push along local +Z of aim node (barrel out).
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(aimNode.getWorldQuaternion(new THREE.Quaternion()));
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    p.addScaledVector(fwd, 0.35);
    p.y = Math.max(p.y, root.position.y + 0.55);
    return p;
  }

  /** Tint cloned materials toward a weapon / skill color (guns keep identity). */
  private tintTurretMats(mats: THREE.Material[], color: number) {
    const c = new THREE.Color(color);
    for (const m of mats) {
      const any = m as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
      if ("color" in any && any.color) {
        // Soft blend so albedo still reads; emissive gets the gun accent.
        any.color.lerp(c, 0.35);
      }
      if ("emissive" in any && any.emissive) {
        any.emissive.copy(c);
        any.emissiveIntensity = Math.max(any.emissiveIntensity ?? 0, 0.45);
      }
    }
  }

  /**
   * Clone a template instance with PER-INSTANCE materials (so we can fade/tint
   * without touching the template) while SHARING geometry + textures. The
   * returned materials are pushed to the effect's `mats` and the effect is
   * marked `shared`, so {@link free} disposes only these cloned materials —
   * never the template's geometry or maps.
   */
  private cloneModelInstance(tpl: THREE.Object3D): { obj: THREE.Object3D; mats: THREE.Material[] } {
    const obj = tpl.clone(true);
    const mats: THREE.Material[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = src.map((x) => {
        const c = (x as THREE.Material).clone();
        c.transparent = true;
        c.depthWrite = false;
        return c;
      });
      m.material = Array.isArray(m.material) ? cloned : cloned[0];
      mats.push(...cloned);
    });
    return { obj, mats };
  }

  /** Shared forward-flying model projectile with a fade-out tail + impact hook. */
  private flyModel(
    key: keyof typeof MODEL_VFX,
    from: THREE.Vector3,
    dir: THREE.Vector3,
    opts: {
      color: number;
      speed: number;
      range: number;
      spin?: number;
      /** Model-local axis that should point along travel (default: -Z via lookAt). */
      align?: THREE.Vector3;
      onHit?: (p: THREE.Vector3) => void;
    },
  ) {
    const [path, size] = MODEL_VFX[key];
    const tpl = this.ensureModel(path, size);
    const velocity = dir.clone().normalize();
    if (!tpl) {
      this.bolt(from, velocity, opts.color, opts.speed, opts.range, opts.onHit);
      return;
    }
    const { obj, mats } = this.cloneModelInstance(tpl);
    obj.position.copy(from);
    if (opts.align) obj.quaternion.setFromUnitVectors(opts.align.clone().normalize(), velocity);
    else obj.lookAt(from.clone().add(velocity));
    this.addTrail(obj, opts.color);
    const life = opts.range / opts.speed;
    let hit = opts.onHit;
    this.add({
      obj,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      update: (e, dt) => {
        obj.position.addScaledVector(velocity, opts.speed * dt);
        if (opts.spin) obj.rotateZ(opts.spin * dt);
        const t = e.age / e.life;
        const fade = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
        for (const m of mats) m.opacity = fade;
        if (e.age + dt >= e.life && hit) {
          hit(obj.position.clone());
          hit = undefined;
        }
      },
    });
  }

  /** A flying dragon projectile with a fiery impact. */
  castDragon(from: THREE.Vector3, dir: THREE.Vector3, color = THEME.fireDragon, onHit?: (p: THREE.Vector3) => void) {
    this.flyModel("dragon", from, dir, {
      color,
      speed: 20,
      range: 24,
      onHit: (p) => {
        this.blastImpact(p, color, 1.3);
        onHit?.(p);
      },
    });
  }

  /**
   * A thrown javelin projectile. Flies near-straight and point-first (its model
   * +Y long-axis aligned to travel) with an additive fade-out trail, landing a
   * sharp impact. The javelin GLB is the projectile base mesh (textured later).
   */
  castJavelin(from: THREE.Vector3, dir: THREE.Vector3, color = THEME.thrust, onHit?: (p: THREE.Vector3) => void) {
    this.flyModel("javelin", from, dir, {
      color,
      speed: 32,
      range: 30,
      align: new THREE.Vector3(0, 1, 0),
      onHit: (p) => {
        this.impact(p, color, 1.3);
        onHit?.(p);
      },
    });
  }

  /**
   * Zoro-style triple slash: one sword swing split into THREE glowing crescent
   * air-blades that fly forward, fanned into a diagonal and diverging as they
   * travel. The centre blade carries the gameplay hit; the flankers are cosmetic.
   * Purely procedural — no character model, no external GLB.
   */
  castDarkBlades(from: THREE.Vector3, dir: THREE.Vector3, color = THEME.darkBlades, onHit?: (p: THREE.Vector3) => void) {
    const travel = dir.clone();
    travel.y = 0;
    if (travel.lengthSq() < 1e-6) travel.set(0, 0, 1);
    travel.normalize();
    const lateral = new THREE.Vector3().crossVectors(travel, new THREE.Vector3(0, 1, 0));
    if (lateral.lengthSq() < 1e-6) lateral.set(1, 0, 0);
    lateral.normalize();
    for (let lane = -1; lane <= 1; lane++) {
      this.flySlashBlade(from, travel, lateral, lane, color, 26, 18, lane === 0 ? onHit : undefined);
    }
  }

  /**
   * Aimed spell variants: fly a curved spline toward a resolved target point and
   * blast on arrival. Used when the caster has a locked/front target so spells
   * home onto the enemy instead of firing straight ahead.
   */
  castDragonAt(from: THREE.Vector3, to: THREE.Vector3, color = THEME.fireDragon, onHit?: (p: THREE.Vector3) => void) {
    this.flyModelSpline("dragon", from, to, {
      color,
      speed: 20,
      onHit: (p) => {
        this.blastImpact(p, color, 1.3, true);
        onHit?.(p);
      },
    });
  }

  /** Aimed triple slash: same three-blade fan, but the centre blade lands on `to`. */
  castDarkBladesAt(from: THREE.Vector3, to: THREE.Vector3, color = THEME.darkBlades, onHit?: (p: THREE.Vector3) => void) {
    const travel = to.clone().sub(from);
    const range = Math.max(4, travel.length());
    if (travel.lengthSq() < 1e-6) travel.set(0, 0, 1);
    travel.normalize();
    const lateral = new THREE.Vector3().crossVectors(travel, new THREE.Vector3(0, 1, 0));
    if (lateral.lengthSq() < 1e-6) lateral.set(1, 0, 0);
    lateral.normalize();
    for (let lane = -1; lane <= 1; lane++) {
      this.flySlashBlade(from, travel, lateral, lane, color, 26, range, lane === 0 ? onHit : undefined);
    }
  }

  /**
   * One glowing crescent "air-blade" of the {@link castDarkBlades} volley. A
   * partial-torus arc (the slash crescent) oriented to face along travel and
   * rolled into a diagonal slash, with an additive tail. `lane` (-1/0/+1) fans
   * the three apart and makes them diverge so they read as a split sword slash.
   * Owns its geometry + material (disposed on expiry); not a shared template.
   */
  private flySlashBlade(
    from: THREE.Vector3,
    travel: THREE.Vector3,
    lateral: THREE.Vector3,
    lane: number,
    color: number,
    speed: number,
    range: number,
    onHit?: (p: THREE.Vector3) => void,
  ) {
    const arc = 2.3;
    const geo = new THREE.TorusGeometry(0.85, 0.07, 8, 44, arc);
    // Centre the open crescent so its gap faces "down" before the diagonal roll.
    geo.rotateZ(Math.PI / 2 - arc / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Crescent plane faces along travel; roll each lane into a crossing diagonal.
    const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), travel);
    face.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.5 + lane * 0.55));
    mesh.quaternion.copy(face);
    const start = from.clone().addScaledVector(lateral, lane * 0.28);
    start.y += lane * 0.18;
    mesh.position.copy(start);
    this.addTrail(mesh, color, { width: 0.26 });
    const life = range / speed;
    let hit = onHit;
    this.add({
      obj: mesh,
      age: 0,
      life,
      geos: [geo],
      mats: [mat],
      update: (e, dt) => {
        mesh.position.addScaledVector(travel, speed * dt);
        // Split apart as they travel — the three-way fan.
        mesh.position.addScaledVector(lateral, lane * 1.1 * dt);
        const t = e.age / e.life;
        const s = 0.85 + t * 0.5;
        mesh.scale.set(s, s, s);
        mat.opacity = t > 0.8 ? 0.96 * (1 - (t - 0.8) / 0.2) : 0.96;
        if (e.age + dt >= e.life) {
          this.blastImpact(mesh.position.clone(), color, lane === 0 ? 1 : 0.5);
          if (hit) {
            hit(mesh.position.clone());
            hit = undefined;
          }
        }
      },
    });
  }

  /**
   * A SLOW, strongly-homing model projectile. Each frame it steers its velocity
   * toward `target` capped by `turnRate` (rad/s), so it visibly curves after a
   * displaced/off-axis point instead of flying a fixed spline — the "seeking"
   * soul. Impacts on contact (or when `maxLife` runs out, wherever it is) and
   * falls back to a straight {@link flyModel} until the GLB has loaded.
   */
  private flyModelHoming(
    key: keyof typeof MODEL_VFX,
    from: THREE.Vector3,
    target: THREE.Vector3,
    opts: {
      color: number;
      speed: number;
      turnRate: number;
      maxLife: number;
      spin?: number;
      onHit?: (p: THREE.Vector3) => void;
    },
  ) {
    const [path, size] = MODEL_VFX[key];
    const tpl = this.ensureModel(path, size);
    const goal = target.clone();
    if (!tpl) {
      const dir = goal.clone().sub(from);
      this.flyModel(key, from, dir, {
        color: opts.color,
        speed: opts.speed,
        range: Math.max(dir.length(), 1),
        spin: opts.spin,
        onHit: opts.onHit,
      });
      return;
    }
    const { obj, mats } = this.cloneModelInstance(tpl);
    obj.position.copy(from);
    const velocity = goal.clone().sub(from);
    if (velocity.lengthSq() < 1e-6) velocity.set(0, 0, 1);
    velocity.normalize().multiplyScalar(opts.speed);
    obj.lookAt(from.clone().add(velocity));
    this.addTrail(obj, opts.color, { width: 0.22 });
    const desired = new THREE.Vector3();
    const cur = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const look = new THREE.Vector3();
    const HIT_DIST = 0.9;
    let hit = opts.onHit;
    this.add({
      obj,
      age: 0,
      life: opts.maxLife,
      geos: [],
      mats,
      shared: true,
      update: (e, dt) => {
        // Steer the velocity toward the goal, rotating at most turnRate*dt.
        desired.copy(goal).sub(obj.position);
        const dist = desired.length();
        if (dist > 1e-4) {
          desired.divideScalar(dist);
          cur.copy(velocity).normalize();
          const ang = Math.acos(THREE.MathUtils.clamp(cur.dot(desired), -1, 1));
          if (ang > 1e-3) {
            const step = Math.min(1, (opts.turnRate * dt) / ang);
            axis.crossVectors(cur, desired);
            if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
            axis.normalize();
            cur.applyAxisAngle(axis, ang * step);
            velocity.copy(cur).multiplyScalar(opts.speed);
          }
        }
        obj.position.addScaledVector(velocity, dt);
        obj.lookAt(look.copy(obj.position).add(velocity));
        if (opts.spin) obj.rotateZ(opts.spin * dt);
        const tt = e.age / e.life;
        const fade = tt > 0.8 ? 1 - (tt - 0.8) / 0.2 : 1;
        for (const m of mats) m.opacity = fade;
        const reached = obj.position.distanceTo(goal) <= HIT_DIST;
        if ((reached || e.age + dt >= e.life) && hit) {
          hit(reached ? goal.clone() : obj.position.clone());
          hit = undefined;
          if (reached) e.age = e.life; // end the effect on contact this frame
        }
      },
    });
  }

  /**
   * A spectral soul bolt: slow, eerie, and strongly seeking. Homes onto `to`
   * (curving hard after an off-axis target) and bursts on arrival.
   */
  castSoulAt(from: THREE.Vector3, to: THREE.Vector3, color = THEME.soul, onHit?: (p: THREE.Vector3) => void) {
    this.flyModelHoming("soul", from, to, {
      color,
      speed: 9,
      turnRate: 5,
      maxLife: 3.6,
      spin: 1.4,
      onHit: (p) => {
        this.blastImpact(p, color, 1.1, true);
        onHit?.(p);
      },
    });
  }

  /** Straight-fire soul (no resolved target): a slow seeking drift forward. */
  castSoul(from: THREE.Vector3, dir: THREE.Vector3, color = THEME.soul, onHit?: (p: THREE.Vector3) => void) {
    this.flyModelHoming("soul", from, from.clone().addScaledVector(dir.clone().normalize(), 16), {
      color,
      speed: 9,
      turnRate: 5,
      maxLife: 3.6,
      spin: 1.4,
      onHit: (p) => {
        this.blastImpact(p, color, 1.1, true);
        onHit?.(p);
      },
    });
  }

  /**
   * An FTL burst-laser bolt: fast and near-straight. Flies a shallow spline to
   * the aim point (a faint lead so it still reads as aimed) with a crisp impact.
   */
  castLaserAt(from: THREE.Vector3, to: THREE.Vector3, color = THEME.laser, onHit?: (p: THREE.Vector3) => void) {
    this.muzzle(from.clone(), to.clone().sub(from).normalize(), color);
    this.flyModelSpline("laser", from, to, {
      color,
      speed: 46,
      arc: 0.25,
      onHit: (p) => {
        this.impact(p, color, 1.0);
        onHit?.(p);
      },
    });
  }

  /** Straight-fire laser (no resolved target): a fast forward bolt. */
  castLaser(from: THREE.Vector3, dir: THREE.Vector3, color = THEME.laser, onHit?: (p: THREE.Vector3) => void) {
    const d = dir.clone().normalize();
    this.muzzle(from.clone(), d, color);
    this.flyModel("laser", from, d, {
      color,
      speed: 46,
      range: 28,
      onHit: (p) => {
        this.impact(p, color, 1.0);
        onHit?.(p);
      },
    });
  }

  /** A meteor that falls from the sky onto a point ahead of the caster. */
  castMeteor(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    color = THEME.meteor,
    onHit?: (p: THREE.Vector3) => void,
    aimTarget?: THREE.Vector3,
  ) {
    const [path, size] = MODEL_VFX.meteor;
    const ground = dir.clone().setY(0).normalize();
    const target = aimTarget?.clone() ?? from.clone().addScaledVector(ground, 6);
    target.y = 0.1;
    // Telegraph the landing zone before the meteor arrives.
    this.auraRing(new THREE.Vector3(target.x, 0.06, target.z), color, 4.2, 0.85);
    const tpl = this.ensureModel(path, size);
    if (!tpl) {
      this.bolt(target.clone().setY(13), new THREE.Vector3(0, -1, 0), color, 30, 13, (p) => {
        this.blastImpact(p, color, 1.5, true);
        onHit?.(p);
      });
      return;
    }
    const { obj, mats } = this.cloneModelInstance(tpl);
    const start = target.clone();
    start.y = 14;
    obj.position.copy(start);
    this.addTrail(obj, color, { width: 0.36 });
    const life = 0.7;
    let hit = onHit;
    this.add({
      obj,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      update: (e, dt) => {
        const t = e.age / e.life;
        obj.position.lerpVectors(start, target, t * t);
        obj.rotateY(6 * dt);
        obj.rotateX(3 * dt);
        if (e.age + dt >= e.life && hit) {
          this.blastImpact(target.clone(), color, 1.6, true);
          hit(target.clone());
          hit = undefined;
        }
      },
    });
  }

  /** Deploy a short-lived turret ahead of the caster that muzzle-flashes shots. */
  castTurret(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    color = THEME.turret,
    onHit?: (p: THREE.Vector3) => void,
    variant: TurretVariant = "classic",
  ) {
    const spec = this.turretSpec(variant);
    const path = spec.path;
    const size = spec.size;
    const ground = dir.clone().setY(0).normalize();
    const base = from.clone().addScaledVector(ground, 1.5);
    base.y = 0;
    const tpl = this.ensureModel(path, size, spec.alts);
    if (!tpl) {
      this.muzzle(from.clone().setY(from.y + 1), ground, color);
      onHit?.(base);
      return;
    }
    const { obj, mats } = this.cloneModelInstance(tpl);
    this.tintTurretMats(mats, color);
    obj.position.copy(base);
    obj.lookAt(base.clone().add(ground));
    const aimNode = this.findTurretAimNode(obj);
    const clips = this.modelAnims.get(path) ?? [];
    const mixer = clips.length ? new THREE.AnimationMixer(obj) : undefined;
    const idleClip = clips.find((c) => /idle/i.test(c.name)) ?? clips[0];
    const attackClip = clips.find((c) => /attack|fire|shoot/i.test(c.name));
    if (mixer && idleClip) {
      const a = mixer.clipAction(idleClip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
    }
    const life = 2.4;
    let shots = 0;
    this.add({
      obj,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      mixer,
      update: (e) => {
        const t = e.age / e.life;
        const fade = t < 0.15 ? t / 0.15 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
        for (const m of mats) m.opacity = fade;
        const want = Math.floor(e.age / 0.4);
        if (want > shots) {
          shots = want;
          if (mixer && attackClip) {
            const atk = mixer.clipAction(attackClip);
            atk.reset();
            atk.setLoop(THREE.LoopOnce, 1);
            atk.clampWhenFinished = true;
            atk.play();
          }
          const muz = this.turretMuzzleWorld(obj, aimNode);
          this.muzzle(muz, ground, color);
        }
      },
    });
    onHit?.(base);
  }

  /**
   * Spawn a deployed turret chassis that stands for `life` seconds.
   * Returns a handle so Studio can aim the barrel, play attack clips, and
   * sample a correct muzzle for timed volleys.
   *
   * - `classic` — models/vfx/turret.glb (liked pack chassis; heavy / skill 4)
   * - `gameReady` — animated idle/attack/destroy (skill 2 medium deploy)
   */
  spawnTurret(
    at: THREE.Vector3,
    faceDir: THREE.Vector3,
    color = THEME.turret,
    life = 6,
    variant: TurretVariant = "classic",
  ): TurretHandle {
    const spec = this.turretSpec(variant);
    const path = spec.path;
    const size = spec.size;
    const base = at.clone();
    base.y = 0;
    const ground = faceDir.clone().setY(0);
    if (ground.lengthSq() < 1e-4) ground.set(0, 0, 1);
    ground.normalize();
    // Warm the template; may be null on first frame.
    this.ensureModel(path, size, spec.alts);
    const tpl = this.modelTpls.get(path) ?? null;
    if (!tpl) {
      this.nova(base.clone().setY(1), color);
      // Retry once template loads: spawn a delayed chassis.
      const retry: TurretHandle = {
        dispose: () => {},
        muzzleWorld: () => base.clone().setY(1.1),
        aimAt: () => {},
        playAttack: () => {},
        playDestroy: () => {},
        get alive() {
          return false;
        },
      };
      // Soft pulse while waiting for model
      this.auraRing(base.clone().setY(0.05), color, 1.2, 0.8);
      return retry;
    }
    const { obj, mats } = this.cloneModelInstance(tpl);
    this.tintTurretMats(mats, color);
    obj.position.copy(base);
    obj.lookAt(base.clone().add(ground));
    const aimNode = this.findTurretAimNode(obj);
    const clips = this.modelAnims.get(path) ?? [];
    const mixer = clips.length ? new THREE.AnimationMixer(obj) : undefined;
    let idleAction: THREE.AnimationAction | null = null;
    let attackAction: THREE.AnimationAction | null = null;
    let destroyAction: THREE.AnimationAction | null = null;
    if (mixer) {
      const idleClip = clips.find((c) => /idle/i.test(c.name)) ?? clips[0];
      const attackClip = clips.find((c) => /attack|fire|shoot/i.test(c.name));
      const destroyClip = clips.find((c) => /destroy|death|die/i.test(c.name));
      if (idleClip) {
        idleAction = mixer.clipAction(idleClip);
        idleAction.setLoop(THREE.LoopRepeat, Infinity);
        idleAction.play();
      }
      if (attackClip) {
        attackAction = mixer.clipAction(attackClip);
        attackAction.setLoop(THREE.LoopOnce, 1);
        attackAction.clampWhenFinished = true;
      }
      if (destroyClip) {
        destroyAction = mixer.clipAction(destroyClip);
        destroyAction.setLoop(THREE.LoopOnce, 1);
        destroyAction.clampWhenFinished = true;
      }
    }

    let disposed = false;
    const face = ground.clone();
    const effect: Effect = {
      obj,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      mixer,
      update: (e) => {
        const t = e.age / e.life;
        // Fade in / out; hold solid mid-life
        const fade = t < 0.08 ? t / 0.08 : t > 0.88 ? 1 - (t - 0.88) / 0.12 : 1;
        for (const m of mats) m.opacity = fade;
        // Keep stand facing last aim yaw (XZ)
        if (face.lengthSq() > 1e-6) {
          const look = obj.position.clone().add(face);
          look.y = obj.position.y;
          obj.lookAt(look);
        }
        // Late life: play destroy if available once
        if (t > 0.88 && destroyAction && !destroyAction.isRunning()) {
          idleAction?.fadeOut(0.08);
          destroyAction.reset().fadeIn(0.06).play();
        }
      },
    };
    this.add(effect);

    const handle: TurretHandle = {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        const i = this.effects.indexOf(effect);
        if (i >= 0) {
          this.free(effect);
          this.effects.splice(i, 1);
        }
      },
      muzzleWorld: () => this.turretMuzzleWorld(obj, aimNode),
      aimAt: (worldTarget: THREE.Vector3) => {
        if (disposed) return;
        const to = worldTarget.clone().sub(obj.position);
        to.y = 0;
        if (to.lengthSq() < 1e-6) return;
        to.normalize();
        face.copy(to);
        // Rotate only the gun head if it's a distinct child; else whole chassis.
        if (aimNode !== obj) {
          const headTarget = worldTarget.clone();
          // Keep pitch modest so the gun doesn't nose-dive into the ground
          const local = aimNode.parent
            ? aimNode.parent.worldToLocal(headTarget.clone())
            : headTarget;
          aimNode.lookAt(local);
        } else {
          const look = obj.position.clone().add(to);
          look.y = obj.position.y;
          obj.lookAt(look);
        }
      },
      playAttack: () => {
        if (disposed || !attackAction) return;
        idleAction?.crossFadeTo(attackAction, 0.05, false);
        attackAction.reset();
        attackAction.setEffectiveWeight(1);
        attackAction.play();
        // Return to idle after attack
        const dur = attackAction.getClip().duration || 0.4;
        window.setTimeout(() => {
          if (disposed || !idleAction || !attackAction) return;
          attackAction.crossFadeTo(idleAction, 0.1, false);
          idleAction.enabled = true;
          idleAction.play();
        }, dur * 1000);
      },
      playDestroy: () => {
        if (disposed || !destroyAction) return;
        idleAction?.fadeOut(0.08);
        attackAction?.fadeOut(0.05);
        destroyAction.reset().play();
      },
      get alive() {
        return !disposed && effect.age < effect.life;
      },
    };
    return handle;
  }

  /** Rain an elemental-sword cluster down onto a point ahead of the caster. */
  castSwordVolley(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    color = THEME.swordVolley,
    onHit?: (p: THREE.Vector3) => void,
    aimTarget?: THREE.Vector3,
  ) {
    const [path, size] = MODEL_VFX.elementalSwords;
    const ground = dir.clone().setY(0).normalize();
    const target = aimTarget?.clone() ?? from.clone().addScaledVector(ground, 4);
    target.y = 0.1;
    this.auraRing(new THREE.Vector3(target.x, 0.06, target.z), color, 3.6, 0.8);
    const tpl = this.ensureModel(path, size);
    if (!tpl) {
      this.nova(from.clone().setY(from.y + 1), color);
      onHit?.(target);
      return;
    }
    const { obj, mats } = this.cloneModelInstance(tpl);
    const start = target.clone();
    start.y = 10;
    obj.position.copy(start);
    obj.rotation.x = Math.PI;
    this.addTrail(obj, color, { width: 0.3 });
    const life = 0.8;
    let hit = onHit;
    this.add({
      obj,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      update: (e, dt) => {
        const t = e.age / e.life;
        obj.position.lerpVectors(start, target, t * t);
        obj.rotateY(4 * dt);
        if (e.age + dt >= e.life && hit) {
          this.blastImpact(target.clone(), color, 1.3, true);
          this.nova(target.clone().setY(0.2), color);
          hit(target.clone());
          hit = undefined;
        }
      },
    });
  }

  // ------------------------------------------------- Trails / auras / blends

  /**
   * Attach a fading, tapering ribbon trail that follows `target` every frame.
   * The ribbon is built from a short ring-buffer of recent world positions; its
   * width + alpha taper from a bright head to a faint tail. Width axis is the
   * segment direction crossed with world-up (view-independent, reads well for
   * projectiles). When the host leaves the scene (effect freed) the tail
   * retracts and the trail ends on its own. One mesh, additive, no per-frame
   * allocation in the hot path.
   */
  private addTrail(
    target: THREE.Object3D,
    color: number,
    opts?: { segments?: number; width?: number },
  ) {
    const segs = opts?.segments ?? 22;
    const width = opts?.width ?? 0.22;
    const verts = segs * 2;
    const pos = new Float32Array(verts * 3);
    const col = new Float32Array(verts * 4);
    const idx: number[] = [];
    for (let i = 0; i < segs - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
    geo.setIndex(idx);
    const c3 = new THREE.Color(color);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    const history: THREE.Vector3[] = [];
    const tmp = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const side = new THREE.Vector3();
    let fading = false;
    this.add({
      obj: mesh,
      age: 0,
      life: 6,
      geos: [geo],
      mats: [mat],
      update: (e, dt) => {
        if (target.parent === null) fading = true;
        if (!fading) {
          target.getWorldPosition(tmp);
          history.unshift(tmp.clone());
          if (history.length > segs) history.length = segs;
        } else {
          history.pop();
          if (history.length === 0) {
            e.age = e.life;
            return;
          }
        }
        const n = history.length;
        for (let i = 0; i < segs; i++) {
          const p = history[Math.min(i, n - 1)];
          const pNext = history[Math.min(i + 1, n - 1)];
          dir.copy(p).sub(pNext);
          if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
          side.crossVectors(dir, up);
          if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
          side.normalize();
          const taper = 1 - i / segs;
          const w = width * taper;
          const a = i * 2;
          const b = a + 1;
          pos[a * 3] = p.x - side.x * w;
          pos[a * 3 + 1] = p.y - side.y * w;
          pos[a * 3 + 2] = p.z - side.z * w;
          pos[b * 3] = p.x + side.x * w;
          pos[b * 3 + 1] = p.y + side.y * w;
          pos[b * 3 + 2] = p.z + side.z * w;
          const alpha = i < n ? taper * taper : 0;
          for (const v of [a, b]) {
            col[v * 4] = c3.r;
            col[v * 4 + 1] = c3.g;
            col[v * 4 + 2] = c3.b;
            col[v * 4 + 3] = alpha;
          }
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      },
    });
  }

  /**
   * A flat ground telegraph ring that grows in, pulses, then fades — the
   * "aura indication" of an incoming/charging spell. Two concentric rings (one
   * counter-pulsing) read clearly as a warning circle. Used both under the
   * caster (charge-up) and at an AoE landing point before impact.
   */
  auraRing(pos: THREE.Vector3, color = 0x9fd0ff, radius = 3, life = 0.9) {
    const make = (inner: boolean) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        map: ringTexture(),
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      });
      const ring = new THREE.Mesh(unitGroundPlane(), mat);
      ring.position.copy(pos);
      ring.position.y += 0.05;
      this.add({
        obj: ring,
        age: 0,
        life,
        geos: [],
        mats: [mat],
        sharedMaps: true,
        update: (e) => {
          const t = e.age / e.life;
          // Grow-in over the first third, hold, fade over the last third.
          const grow = Math.min(1, t / 0.34);
          const r = radius * (inner ? 0.62 : 1);
          const pulse = 1 + Math.sin(e.age * 16 + (inner ? Math.PI : 0)) * 0.06;
          const s = r * 2.5 * grow * pulse;
          ring.scale.set(s, s, s);
          const fadeIn = Math.min(1, t / 0.2);
          const fadeOut = t > 0.66 ? 1 - (t - 0.66) / 0.34 : 1;
          mat.opacity = fadeIn * fadeOut * (inner ? 0.5 : 0.85);
        },
      });
    };
    make(false);
    make(true);
  }

  /**
   * A charge-up aura under a caster: a growing ground telegraph ring plus a few
   * sparks drawn upward into the cast point. Signals "a spell is being cast"
   * before the projectile leaves.
   */
  castAura(pos: THREE.Vector3, color = 0x9fd0ff) {
    const ground = new THREE.Vector3(pos.x, 0.06, pos.z);
    this.auraRing(ground, color, 2.4, 0.7);
    this.burst(new THREE.Vector3(pos.x, pos.y + 0.4, pos.z), color, 16, 2);
  }

  /**
   * Fire aura damage indication — same building blocks as skill fire prefabs:
   *   castAura (telegraph ring) + rising flame column + fireBurst + GPU impactExplode.
   *
   * Used on take-damage / connect impact so hits read as the familiar fire-skill
   * aura, not a flat spark. `scale` ~0.6 light chip, ~1.0 standard, ~1.4 heavy.
   * `theme` selects fire vs chi palette (matches Striker / impactExplode).
   */
  fireAura(
    pos: THREE.Vector3,
    scale = 1,
    theme?: FireTheme,
    opts?: { groundOnly?: boolean; life?: number },
  ) {
    if (this.disposed) return;
    const s = Math.max(0.35, scale);
    const fireCol = THEME.fireDragon;
    const mid = (theme ?? this.fireTheme) === "chi" ? 0x88c8ff : 0xff6a1e;
    const ground = new THREE.Vector3(pos.x, 0.05, pos.z);
    const chest = pos.clone();
    if (chest.y < 0.4) chest.y = 0.95;

    // Skill-style cast aura telegraph (ground rings)
    this.castAura(chest, mid);
    this.auraRing(ground, fireCol, 1.35 * s, opts?.life ?? 0.55);

    // Rising flame column (StatusFx "burning" rise language, one-shot)
    this.flame(chest.clone().setY(chest.y * 0.45), mid, Math.round(18 * s), 2.2 * s);
    this.flame(chest, 0xffd27a, Math.round(10 * s), 1.6 * s);

    // Hot fire puff + GPU explosion burst (same as skill impact path)
    this.fireBurst(chest, new THREE.Vector3(0, 1, 0), 1.4 * s);
    if (!opts?.groundOnly) {
      this.impactExplode(chest, theme ?? this.fireTheme);
      this.impactFlash(chest, fireCol);
    }
    this.smokePop(chest, mid, 0.7 * s);
  }

  /**
   * A blended impact: several effects layered so a hit reads with weight —
   * ground shockwave + scorch ring + radial spark burst + hot flash + smoke
   * puff, all tinted to the spell colour. `up` adds an extra vertical fire
   * column for sky-drop spells (meteor / sword volley).
   */
  blastImpact(pos: THREE.Vector3, color = 0xaee6ff, scale = 1, up = false) {
    const ground = new THREE.Vector3(pos.x, 0.05, pos.z);
    this.shockwave(ground, color, 3.2 * scale, 0.7);
    this.auraRing(ground, color, 1.6 * scale, 0.45);
    this.burst(pos, color, Math.round(34 * scale), 5 * scale);
    this.impactFlash(pos, color);
    this.smokePop(pos, color, scale);
    this.fireBurst(pos, up ? new THREE.Vector3(0, 1, 0) : undefined, 2.4 * scale);
    // Fire skill aura read on heavy impacts
    this.fireAura(pos, 0.75 * scale, undefined, { groundOnly: true });
  }

  /**
   * Fly a projectile MODEL along a curved Bézier spline from `from` to `to`
   * (a raised control point gives the arc), orienting to the path tangent and
   * trailing a ribbon. Impacts with a blended blast at `to`. Falls back to a
   * straight {@link flyModel} toward the target when the GLB hasn't loaded yet.
   */
  private flyModelSpline(
    key: keyof typeof MODEL_VFX,
    from: THREE.Vector3,
    to: THREE.Vector3,
    opts: { color: number; speed?: number; spin?: number; arc?: number; onHit?: (p: THREE.Vector3) => void },
  ) {
    const [path, size] = MODEL_VFX[key];
    const tpl = this.ensureModel(path, size);
    const dist = from.distanceTo(to);
    if (!tpl) {
      this.flyModel(key, from, to.clone().sub(from), {
        color: opts.color,
        speed: opts.speed ?? 22,
        range: dist,
        spin: opts.spin,
        onHit: opts.onHit,
      });
      return;
    }
    const mid = from.clone().lerp(to, 0.5);
    mid.y += opts.arc ?? Math.min(4, dist * 0.35);
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    const { obj, mats } = this.cloneModelInstance(tpl);
    obj.position.copy(from);
    this.addTrail(obj, opts.color, { width: 0.28 });
    const life = dist / (opts.speed ?? 22);
    const tangent = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    let hit = opts.onHit;
    this.add({
      obj,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      update: (e, dt) => {
        const t = Math.min(1, e.age / e.life);
        curve.getPoint(t, obj.position);
        curve.getTangent(t, tangent);
        obj.lookAt(ahead.copy(obj.position).add(tangent));
        if (opts.spin) obj.rotateZ(opts.spin * dt);
        if (e.age + dt >= e.life && hit) {
          hit(to.clone());
          hit = undefined;
        }
      },
    });
  }

  private sparkTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  // ---- GPU flame system ---------------------------------------------------

  /** Push the active palette colours into the shared trail uniforms. */
  private applyFireColors() {
    const c = this.fireTheme === "chi" ? CHI_FIRE_COLORS : this.fireParams;
    this.fireUniforms.uCore.value.set(c.core);
    this.fireUniforms.uMid.value.set(c.mid);
    this.fireUniforms.uEdge.value.set(c.edge);
    this.fireUniforms.uDark.value.set(c.dark);
  }

  /**
   * Live-tune the flame system from the editor. Slider values always apply;
   * the 4 colours apply only while the "fire" theme is active (a "chi" character
   * keeps its cool palette so editing sliders never recolours it).
   */
  setFireParams(p: FireFxParams) {
    this.fireParams = { ...p };
    this.fireUniforms.uBrightness.value = p.brightness;
    this.fireUniforms.uTurbulence.value = p.turbulence;
    this.fireUniforms.uSizeMult.value = p.sizeMult;
    this.fireUniforms.uSpeedMult.value = p.speedMult;
    this.fireUniforms.uSideBias.value = p.sideBias;
    this.applyFireColors();
  }

  /** Swap the active 4-stop palette (per character/skill). */
  setFireTheme(theme: FireTheme) {
    if (theme === this.fireTheme) return;
    this.fireTheme = theme;
    this.applyFireColors();
  }

  /** Lazily build the long-lived trail Points + its shader. */
  private ensureFireTrail() {
    if (this.fireTrail) return;
    const n = Vfx.FIRE_TRAIL_COUNT;
    const pos = new Float32Array(n * 3);
    const off = new Float32Array(n);
    const speed = new Float32Array(n);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      off[i] = Math.random();
      speed[i] = 0.6 + Math.random() * 0.8;
      size[i] = 6 + Math.random() * 9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aOffset", new THREE.BufferAttribute(off, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.fireUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform float uTurbulence;
        uniform float uSizeMult;
        uniform float uSpeedMult;
        uniform float uSideBias;
        attribute float aOffset;
        attribute float aSpeed;
        attribute float aSize;
        varying float vLife;
        void main() {
          float life = mod(uTime * aSpeed * uSpeedMult + aOffset, 1.0);
          vLife = life;
          float t = uTime * aSpeed + aOffset * 6.2831853;
          vec3 p = position;
          p.x += sin(t * 3.0) * uTurbulence * 0.15 * life;
          p.z += cos(t * 2.3) * uTurbulence * 0.15 * life;
          p.x += uSideBias * 0.3 * life;
          p.y += life * 2.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // Clamp the projected point size so a trail particle passing right in
          // front of the third-person camera can't blow up to fill the screen
          // (the blinding whiteout). Far particles are unaffected (already small).
          gl_PointSize = min(aSize * uSizeMult * (1.0 - life * 0.6) * (300.0 / max(0.001, -mv.z)), 64.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uCore;
        uniform vec3 uMid;
        uniform vec3 uEdge;
        uniform vec3 uDark;
        uniform float uBrightness;
        uniform float uEmit;
        varying float vLife;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float soft = smoothstep(0.5, 0.0, d);
          vec3 col;
          if (vLife < 0.33) col = mix(uCore, uMid, vLife / 0.33);
          else if (vLife < 0.66) col = mix(uMid, uEdge, (vLife - 0.33) / 0.33);
          else col = mix(uEdge, uDark, (vLife - 0.66) / 0.34);
          float alpha = soft * (1.0 - vLife) * uEmit;
          gl_FragColor = vec4(col * uBrightness, alpha);
        }
      `,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.visible = false;
    this.scene.add(pts);
    this.fireTrail = pts;
    this.fireTrailMat = mat;
    this.fireTrailGeo = geo;
    this.firePos = pos;
    this.fireOff = off;
    this.fireSpeed = speed;
  }

  /** Seed a particle's base position somewhere along the current emit segment. */
  private seedFireParticle(i: number) {
    const pos = this.firePos!;
    const f = Math.random();
    const j = 0.04;
    pos[i * 3] = THREE.MathUtils.lerp(this.fireA.x, this.fireB.x, f) + (Math.random() - 0.5) * j;
    pos[i * 3 + 1] = THREE.MathUtils.lerp(this.fireA.y, this.fireB.y, f) + (Math.random() - 0.5) * j;
    pos[i * 3 + 2] = THREE.MathUtils.lerp(this.fireA.z, this.fireB.z, f) + (Math.random() - 0.5) * j;
  }

  /** Emit the trailing flame along a world-space segment (e.g. blade grip → tip). */
  flameTrailSegment(a: THREE.Vector3, b: THREE.Vector3) {
    if (this.disposed) return;
    this.ensureFireTrail();
    this.fireA.copy(a);
    this.fireB.copy(b);
    this.fireEmitReq = true;
  }

  /** Emit the trailing flame around a single world-space point (e.g. spin/hover). */
  flameTrailPoint(p: THREE.Vector3) {
    this.flameTrailSegment(p, p);
  }

  /** Advance + re-seed the continuous trail; called once per frame from update(). */
  private updateFireTrail(dt: number) {
    this.fireUniforms.uTime.value += dt;
    const target = this.fireEmitReq ? 1 : 0;
    // Ease toward the requested emission so swings fade in/out instead of popping.
    this.fireFade += (target - this.fireFade) * Math.min(1, dt * 10);
    this.fireUniforms.uEmit.value = this.fireFade;

    if (!this.fireTrail) {
      this.fireEmitReq = false;
      return;
    }
    if (this.fireFade < 0.01 && target === 0) {
      this.fireTrail.visible = false;
      this.fireWasEmitting = false;
      this.fireEmitReq = false;
      return;
    }
    this.fireTrail.visible = true;

    if (this.fireEmitReq) {
      const pos = this.firePos!;
      const off = this.fireOff!;
      const speed = this.fireSpeed!;
      const time = this.fireUniforms.uTime.value;
      const sm = this.fireUniforms.uSpeedMult.value;
      const n = Vfx.FIRE_TRAIL_COUNT;
      if (!this.fireWasEmitting) {
        // Fresh emit: seed every particle so the trail appears immediately.
        for (let i = 0; i < n; i++) this.seedFireParticle(i);
      } else {
        // Recycle particles that just wrapped their life back to the segment.
        for (let i = 0; i < n; i++) {
          const life = (time * speed[i] * sm + off[i]) % 1;
          if (life < 0.02) this.seedFireParticle(i);
        }
      }
      pos; // (positions mutated in place via seedFireParticle)
      this.fireTrailGeo!.attributes.position.needsUpdate = true;
    }
    this.fireWasEmitting = this.fireEmitReq;
    this.fireEmitReq = false;
  }

  /** Lazily build the long-lived blade-trail ribbon mesh + its shader. */
  private ensureBladeTrail() {
    if (this.bladeTrail) return;
    const max = Vfx.BLADE_TRAIL_MAX;
    // Two verts (base, tip) per cross-section.
    const verts = max * 2;
    const pos = new Float32Array(verts * 3);
    const alpha = new Float32Array(verts);
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    const alphaAttr = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("aAlpha", alphaAttr);
    // Static index buffer: two triangles per segment between adjacent sections.
    const idx: number[] = [];
    for (let i = 0; i < max - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: this.bladeColor } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aAlpha;
        varying float vA;
        void main() {
          vA = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          // Modest brightness so the additive streak reads as a clean slash,
          // never a blown-out bloom.
          gl_FragColor = vec4(uColor * 0.9, vA);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.scene.add(mesh);
    this.bladeTrail = mesh;
    this.bladeTrailGeo = geo;
    this.bladeTrailMat = mat;
    this.bladePos = pos;
    this.bladeAlpha = alpha;
  }

  /**
   * Sweep a clean thin ribbon between the blade grip (`base`) and tip over the
   * swing. Call once per frame while swinging; pass the weapon's slash colour.
   */
  bladeTrailSegment(base: THREE.Vector3, tip: THREE.Vector3, color = 0x9fe8ff) {
    if (this.disposed) return;
    this.ensureBladeTrail();
    this.bladeColor.set(color);
    this.bladeSamples.push({ base: base.clone(), tip: tip.clone(), age: 0 });
    if (this.bladeSamples.length > Vfx.BLADE_TRAIL_MAX) this.bladeSamples.shift();
  }

  /** Age + rebuild the ribbon each frame; called once from update(). */
  private updateBladeTrail(dt: number) {
    if (!this.bladeTrail) return;
    const life = Vfx.BLADE_TRAIL_LIFE;
    for (const s of this.bladeSamples) s.age += dt;
    while (this.bladeSamples.length > 0 && this.bladeSamples[0].age >= life) {
      this.bladeSamples.shift();
    }
    const k = this.bladeSamples.length;
    if (k < 2) {
      this.bladeTrail.visible = false;
      this.bladeTrailGeo!.setDrawRange(0, 0);
      return;
    }
    const pos = this.bladePos!;
    const alpha = this.bladeAlpha!;
    for (let i = 0; i < k; i++) {
      const s = this.bladeSamples[i];
      const b = i * 6;
      pos[b] = s.base.x; pos[b + 1] = s.base.y; pos[b + 2] = s.base.z;
      pos[b + 3] = s.tip.x; pos[b + 4] = s.tip.y; pos[b + 5] = s.tip.z;
      // Brightest at the leading edge (newest), fading down the tail, with each
      // section also fading as it ages out — so the ribbon shrinks cleanly.
      const lead = i / (k - 1);
      const fade = 1 - s.age / life;
      const a = lead * fade;
      alpha[i * 2] = a;
      alpha[i * 2 + 1] = a;
    }
    this.bladeTrail.visible = true;
    this.bladeTrailGeo!.attributes.position.needsUpdate = true;
    this.bladeTrailGeo!.attributes.aAlpha.needsUpdate = true;
    this.bladeTrailGeo!.setDrawRange(0, (k - 1) * 6);
  }

  /**
   * One-shot GPU explosion burst at an impact point, coloured by the active or
   * supplied palette. Registered as a normal effect so it's disposed on expiry.
   */
  impactExplode(pos: THREE.Vector3, theme?: FireTheme) {
    if (this.disposed) return;
    const colors = (theme ?? this.fireTheme) === "chi" ? CHI_FIRE_COLORS : this.fireParams;
    const count = 90;
    const DURATION = 0.8;
    const positions = new Float32Array(count * 3);
    const vels = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.6 - 0.2, Math.random() * 2 - 1)
        .normalize()
        .multiplyScalar(3 + Math.random() * 4);
      vels[i * 3] = dir.x;
      vels[i * 3 + 1] = dir.y;
      vels[i * 3 + 2] = dir.z;
      sizes[i] = 3 + Math.random() * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aVel", new THREE.BufferAttribute(vels, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uDuration: { value: DURATION },
        uGravity: { value: 16 },
        uSizeMult: { value: this.fireUniforms.uSizeMult.value },
        uBrightness: { value: this.fireUniforms.uBrightness.value },
        uCore: { value: new THREE.Color("#ffffff") },
        uMid: { value: new THREE.Color(colors.mid) },
        uEdge: { value: new THREE.Color(colors.edge) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uProgress;
        uniform float uDuration;
        uniform float uGravity;
        uniform float uSizeMult;
        attribute vec3 aVel;
        attribute float aSize;
        varying float vLife;
        void main() {
          float life = 1.0 - uProgress;
          vLife = life;
          float t = uProgress * uDuration;
          vec3 p = position + aVel * t;
          p.y -= 0.5 * uGravity * t * t;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // Clamp the projected point size so a particle spawned right in front of
          // the camera can't blow up to fill the screen (the old whiteout on every
          // melee impact). Far particles are unaffected (already small).
          gl_PointSize = min(aSize * uSizeMult * life * (300.0 / max(0.001, -mv.z)), 64.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uCore;
        uniform vec3 uMid;
        uniform vec3 uEdge;
        uniform float uBrightness;
        varying float vLife;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float soft = smoothstep(0.5, 0.0, d);
          float k = 1.0 - vLife;
          vec3 col = k < 0.5 ? mix(uCore, uMid, k / 0.5) : mix(uMid, uEdge, (k - 0.5) / 0.5);
          gl_FragColor = vec4(col * uBrightness, soft * vLife * 0.6);
        }
      `,
    });
    const obj = new THREE.Points(geo, mat);
    obj.frustumCulled = false;
    this.add({
      obj,
      age: 0,
      life: DURATION,
      geos: [geo],
      mats: [mat],
      update: (e) => {
        mat.uniforms.uProgress.value = Math.min(1, e.age / DURATION);
      },
    });
  }

  /** Burst of sparks at a point (hit / impact). */
  burst(
    pos: THREE.Vector3,
    color = 0xffd58a,
    count = 28,
    power = 4,
    opts: { spread?: number; sizeScale?: number } = {},
  ) {
    const spread = opts.spread ?? 0;
    const baseSize = 0.22 * (opts.sizeScale ?? 1);
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x + (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * spread;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.4,
        Math.random() * 2 - 1,
      ).normalize().multiplyScalar(power * (0.4 + Math.random()));
      velocities.push(dir);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const tex = this.sparkTexture();
    const mat = new THREE.PointsMaterial({
      color,
      size: baseSize,
      map: tex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.add({
      obj: points,
      age: 0,
      life: 0.7,
      geos: [geo],
      mats: [mat],
      update: (e, dt) => {
        const arr = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
          velocities[i].y -= 9 * dt;
          arr[i * 3] += velocities[i].x * dt;
          arr[i * 3 + 1] += velocities[i].y * dt;
          arr[i * 3 + 2] += velocities[i].z * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = 1 - e.age / e.life;
        mat.size = baseSize * (1 - e.age / e.life * 0.5);
      },
    });
  }

  /**
   * A small cluster of slow rising bubbles — ambient underwater detail spawned
   * around the player while sinking through the dungeon's water band. Uses soft
   * alpha sprites (NOT additive, so they read as watery bubbles rather than
   * sparks): they drift up with a gentle horizontal wobble and fade as they go.
   */
  bubbles(pos: THREE.Vector3, count = 5) {
    const positions = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    const phase: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x + (Math.random() - 0.5) * 1.3;
      positions[i * 3 + 1] = pos.y + 0.3 + Math.random() * 1.4;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 1.3;
      vel.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          0.7 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.2,
        ),
      );
      phase.push(Math.random() * Math.PI * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const tex = this.sparkTexture();
    const mat = new THREE.PointsMaterial({
      color: 0xbfeaff,
      size: 0.14,
      map: tex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    const life = 1.6;
    this.add({
      obj: points,
      age: 0,
      life,
      geos: [geo],
      mats: [mat],
      update: (e, dt) => {
        const arr = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
          arr[i * 3] += (vel[i].x + Math.sin(e.age * 3 + phase[i]) * 0.25) * dt;
          arr[i * 3 + 1] += vel[i].y * dt;
          arr[i * 3 + 2] += (vel[i].z + Math.cos(e.age * 3 + phase[i]) * 0.25) * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = 0.5 * (1 - e.age / e.life);
      },
    });
  }

  /** Expanding ground ring (slam / landing). */
  shockwave(pos: THREE.Vector3, color = 0xffb24d, maxRadius = 3, life = 0.6) {
    // Shared flat XZ-plane + soft textured ring (tinted) — no hard-edged geo.
    const mat = new THREE.MeshBasicMaterial({
      color,
      map: ringTexture(),
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(unitGroundPlane(), mat);
    ring.position.copy(pos);
    ring.position.y += 0.06;
    this.add({
      obj: ring,
      age: 0,
      life,
      // geometry is the shared module plane — only the tinted material is owned.
      geos: [],
      mats: [mat],
      // map is the module-cached ringTexture(); never dispose it.
      sharedMaps: true,
      update: (e) => {
        const t = e.age / e.life;
        // Ring texture's bright band sits at ~0.40 of the plane; scale so the
        // visible ring sweeps out to ~maxRadius.
        const s = (0.4 + t * maxRadius) * 2.5;
        ring.scale.set(s, s, s);
        mat.opacity = 1 - t;
      },
    });
  }

  /** Expanding wire sphere + sparks (magic nova). */
  nova(pos: THREE.Vector3, color = 0xb98cff) {
    const geo = new THREE.IcosahedronGeometry(0.4, 1);
    const mat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(pos);
    this.add({
      obj: sphere,
      age: 0,
      life: 0.8,
      geos: [geo],
      mats: [mat],
      update: (e) => {
        const t = e.age / e.life;
        const s = 0.5 + t * 5;
        sphere.scale.set(s, s, s);
        sphere.rotation.y += 0.04;
        mat.opacity = 1 - t;
      },
    });
    this.burst(pos, color, 36, 6);
  }

  /** A travelling glowing projectile. Calls onHit at the end of its flight. */
  bolt(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    color = 0x6fd6ff,
    speed = 26,
    range = 18,
    onHit?: (p: THREE.Vector3) => void,
    scale = 1,
  ) {
    const group = new THREE.Group();
    const coreGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(coreGeo, coreMat);
    const trailGeo = new THREE.ConeGeometry(0.1, 0.7, 8);
    const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.rotation.x = -Math.PI / 2;
    trail.position.z = 0.4;
    group.add(core, trail);
    group.position.copy(from);
    if (scale !== 1) group.scale.setScalar(scale);
    const velocity = dir.clone().normalize();
    group.lookAt(from.clone().add(velocity));
    const life = range / speed;
    this.add({
      obj: group,
      age: 0,
      life,
      geos: [coreGeo, trailGeo],
      mats: [coreMat, trailMat],
      update: (e, dt) => {
        group.position.addScaledVector(velocity, speed * dt);
        if (e.age + dt >= e.life && onHit) {
          onHit(group.position.clone());
          onHit = undefined;
        }
      },
    });
  }

  /**
   * Charged / enhanced bullet — soft blended ShaderMaterial core + elongated
   * additive trail + particle ribbon. Used by multi-part gun / xbow skills and
   * LMB gun rounds for a premium “energy slug” read.
   */
  chargedBolt(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    color = 0xfff2a8,
    speed = 48,
    range = 22,
    onHit?: (p: THREE.Vector3) => void,
    scale = 1.25,
  ) {
    const group = new THREE.Group();
    const d = dir.clone().normalize();
    const c = new THREE.Color(color);

    // Soft radial falloff slug (blended shader — not a hard sphere silhouette).
    const coreGeo = new THREE.SphereGeometry(0.22 * scale, 16, 16);
    const coreMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: c.clone() },
        uCore: { value: new THREE.Color(0xffffff) },
        uTime: { value: 0 },
        uIntensity: { value: 1.15 },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uCore;
        uniform float uTime;
        uniform float uIntensity;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
          float pulse = 0.85 + 0.15 * sin(uTime * 28.0);
          vec3 col = mix(uCore, uColor, 0.55 + fres * 0.35) * uIntensity * pulse;
          float a = (0.55 + fres * 0.45) * pulse;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);

    const shellGeo = new THREE.SphereGeometry(0.38 * scale, 14, 14);
    const shellMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);

    const trailGeo = new THREE.CylinderGeometry(0.03 * scale, 0.2 * scale, 1.35 * scale, 12, 1, true);
    const trailMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.rotation.x = Math.PI / 2;
    trail.position.z = 0.7 * scale;

    // Thin corona ring for “charged” read
    const ringGeo = new THREE.TorusGeometry(0.2 * scale, 0.025 * scale, 6, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.y = Math.PI / 2;

    group.add(shell, core, trail, ring);
    group.position.copy(from);
    group.lookAt(from.clone().add(d));

    const life = range / speed;
    this.add({
      obj: group,
      age: 0,
      life,
      geos: [coreGeo, shellGeo, trailGeo, ringGeo],
      mats: [coreMat, shellMat, trailMat, ringMat],
      update: (e, dt) => {
        group.position.addScaledVector(d, speed * dt);
        coreMat.uniforms.uTime.value = e.age;
        const pulse = 0.85 + Math.sin(e.age * 42) * 0.2;
        core.scale.setScalar(pulse);
        shell.scale.setScalar(1.05 + Math.sin(e.age * 28) * 0.12);
        shellMat.opacity = 0.22 + pulse * 0.12;
        ring.rotation.z += dt * 14;
        ringMat.opacity = 0.35 + pulse * 0.25;
        trail.scale.y = 0.9 + pulse * 0.25;
        // Soft spark ribbon (blended particle crumbs)
        if (Math.random() < 0.62) {
          this.burst(group.position.clone(), color, 2, 0.85 * scale);
        }
        if (e.age + dt >= e.life && onHit) {
          onHit(group.position.clone());
          this.impactFlash(group.position.clone(), color);
          this.fireAura(group.position.clone(), 0.7 * scale);
          onHit = undefined;
        }
      },
    });
  }

  /**
   * Skill charge build-up at a point (muzzle / hand): cast aura + rising motes +
   * soft hex spin + inward-pull sparks — used before beams / charged bolts.
   */
  /**
   * Annihilate SwordBlaster-style slash projectile.
   * Tall thin additive slab that flies forward; multi-angle fan for type-style lanes.
   * lane -1/0/+1 → yaw offset; knockDown=true uses stronger impact radius (type 3).
   */
  slashBlaster(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    opts?: {
      color?: number;
      range?: number;
      duration?: number;
      lane?: number;
      knockDown?: boolean;
      onHit?: (p: THREE.Vector3) => void;
    },
  ) {
    const color = opts?.color ?? 0x40ffff;
    const range = opts?.range ?? 14;
    const duration = opts?.duration ?? 0.32;
    const lane = opts?.lane ?? 0;
    const travel = dir.clone();
    travel.y = 0;
    if (travel.lengthSq() < 1e-6) travel.set(0, 0, 1);
    travel.normalize();
    // Annihilate: ±π/5 yaw for side blasters
    const yaw = lane * (Math.PI / 5);
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    travel.applyQuaternion(qYaw);
    const width = 0.22;
    const height = 2.6;
    const depth = 1.4;
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const start = from.clone();
    start.y = Math.max(1.1, from.y);
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), travel);
    this.addTrail(mesh, color, { width: 0.35 });
    const target = start.clone().addScaledVector(travel, range);
    let hit = opts?.onHit;
    this.add({
      obj: mesh,
      age: 0,
      life: duration,
      geos: [geo],
      mats: [mat],
      update: (e, _dt) => {
        const t = Math.min(1, e.age / e.life);
        mesh.position.lerpVectors(start, target, t);
        mat.opacity = 0.95 * (1 - t * 0.55);
        if (hit && t > 0.35) {
          const p = mesh.position.clone();
          hit(p);
          hit = undefined;
        }
      },
    });
  }

  /**
   * Fan of 1 or 3 slash blasters (annihilate charged greatsword / hadouken style).
   * count=3 → left, center, right angles; center can knockDown for Pop-like finisher.
   */
  castSlashBlasters(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    opts?: {
      color?: number;
      count?: 1 | 3;
      range?: number;
      onHit?: (p: THREE.Vector3) => void;
    },
  ) {
    const count = opts?.count ?? 3;
    const color = opts?.color ?? 0x40ffff;
    const range = opts?.range ?? 15;
    const lanes = count === 1 ? [0] : ([-1, 0, 1] as const);
    for (const lane of lanes) {
      this.slashBlaster(from, dir, {
        color,
        range,
        duration: 0.3,
        lane,
        knockDown: lane === 0,
        onHit: lane === 0 ? opts?.onHit : undefined,
      });
    }
  }

  /** Pop-style expanding AoE ring (annihilate Pop) — visual only; damage via blast. */
  popAoE(pos: THREE.Vector3, color = 0x40ffff, radius = 3.2, life = 0.28) {
    this.aoeBlast(pos, color, radius);
    this.shockwave(new THREE.Vector3(pos.x, 0.05, pos.z), color, radius * 1.15, life);
    this.burst(pos, color, 22, 3.2);
  }

  skillCharge(pos: THREE.Vector3, color = 0x9fd8ff, scale = 1, life = 0.45) {
    this.castAura(pos, color);
    this.auraRing(new THREE.Vector3(pos.x, 0.05, pos.z), color, 1.1 * scale, life);
    this.burst(pos, color, Math.round(14 * scale), 2.2 * scale);
    this.hexaring(() => pos.clone(), color, life);
    // Expanding charge shell (reads as “power building”)
    const geo = new THREE.SphereGeometry(0.35 * scale, 14, 14);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      wireframe: true,
    });
    const shell = new THREE.Mesh(geo, mat);
    shell.position.copy(pos);
    this.add({
      obj: shell,
      age: 0,
      life: Math.max(0.2, life),
      geos: [geo],
      mats: [mat],
      update: (e) => {
        const t = e.age / e.life;
        shell.scale.setScalar(0.6 + t * 1.6);
        mat.opacity = 0.55 * (1 - t);
        shell.rotation.y += 0.08;
        shell.rotation.x += 0.04;
      },
    });
  }

  /** Quick flash at the muzzle plus a few bolts. */
  muzzle(pos: THREE.Vector3, dir: THREE.Vector3, color = 0xfff2a8) {
    const geo = new THREE.SphereGeometry(0.18, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.copy(pos);
    this.add({
      obj: flash,
      age: 0,
      life: 0.12,
      geos: [geo],
      mats: [mat],
      update: (e) => {
        const t = e.age / e.life;
        flash.scale.setScalar(1 + t * 1.5);
        mat.opacity = 1 - t;
      },
    });
    this.bolt(pos, dir, color, 40, 20, (p) => this.burst(p, color, 18, 3));
  }

  /**
   * Slash crescent at hand/blade pose.
   * Prefer {@link slashArcParam} or {@link playMeleeSlash} for deterministic arcs.
   * Default uses arc index 0 (never Math.random).
   */
  slashArc(pos: THREE.Vector3, quat: THREE.Quaternion, color = 0x9fe8ff) {
    if (this.slashArcs.length > 0) {
      this.slashArcParam(0, pos, quat, {
        rotate: 0,
        scale: 1,
        direction: 0,
        bend: 0,
        thickness: 1,
        particles: 6,
        color: `#${color.toString(16).padStart(6, "0")}`,
      });
      return;
    }
    this.proceduralSlashRibbon(pos, quat, color);
  }

  /** Thin additive ellipse fallback when attack-slashes.glb is missing. */
  private proceduralSlashRibbon(
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    color: number,
    scale = 1,
  ) {
    const curve = new THREE.EllipseCurve(0, 0, 1.1 * scale, 1.1 * scale, -Math.PI * 0.35, Math.PI * 0.35, false, 0);
    const pts = curve.getPoints(28).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.position.copy(pos);
    line.quaternion.copy(quat);
    this.add({
      obj: line,
      age: 0,
      life: 0.28,
      geos: [geo],
      mats: [mat],
      update: (e) => {
        mat.opacity = 1 - e.age / e.life;
        const s = 1 + e.age * 1.15;
        line.scale.set(s, s, s);
      },
    });
  }

  /** Number of indexed slash crescents available (0 until the GLB loads). */
  get slashArcCount(): number {
    return this.slashArcs.length;
  }

  /**
   * Editor authoring entrypoint: spawn ONE specific crescent (by stable index)
   * with explicit, deterministic parameters. `bend`/`thickness` deform a
   * per-spawn OWNED geometry clone (template geometry + texture stay shared); a
   * positive `particles` count emits additive sparks alongside the arc. Falls
   * back to the procedural ribbon until the GLB has loaded.
   */
  slashArcParam(index: number, pos: THREE.Vector3, quat: THREE.Quaternion, p: SlashFxParams) {
    const colorHex = new THREE.Color(p.color).getHex();
    if (this.slashArcs.length === 0) {
      this.proceduralSlashRibbon(pos, quat, colorHex, p.scale);
      if (p.particles > 0) {
        this.burst(pos.clone(), colorHex, Math.round(p.particles), 2.4 * p.scale, {
          spread: 0.35 * p.scale,
          sizeScale: p.scale,
        });
      }
      return;
    }
    // Deterministic index — NEVER Math.random
    const i = Math.max(0, Math.min(this.slashArcs.length - 1, Math.floor(index)));
    const tpl = this.slashArcs[i]!;
    const mat = (tpl.material as THREE.MeshBasicMaterial).clone();
    mat.color = new THREE.Color(p.color);
    mat.transparent = true;
    mat.blending = THREE.AdditiveBlending;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
    // Keep atlas map; boost readability via white core lerp early in life
    if (mat.map) {
      mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.needsUpdate = true;
    }
    const deformed = p.bend !== 0 || p.thickness !== 1;
    const geo = deformed ? this.deformSlashGeo(tpl.geometry, p.bend, p.thickness) : tpl.geometry;
    const arc = new THREE.Mesh(geo, mat);
    arc.position.copy(pos);
    arc.quaternion.copy(quat);
    // Base outward facing, then authored yaw (direction) and roll (rotate).
    arc.rotateY(Math.PI / 2 + THREE.MathUtils.degToRad(p.direction));
    arc.rotateZ(THREE.MathUtils.degToRad(p.rotate));
    const baseScale = tpl.scale.clone().multiplyScalar(p.scale);
    if (p.particles > 0) {
      tpl.geometry.computeBoundingSphere();
      const radius =
        (tpl.geometry.boundingSphere?.radius ?? 1) *
        Math.max(baseScale.x, baseScale.y, baseScale.z);
      this.burst(pos.clone(), colorHex, Math.round(p.particles), 2.8 * p.scale, {
        spread: Math.max(0.2, radius * 0.35),
        sizeScale: p.scale,
      });
    }
    const core = new THREE.Color(p.color).lerp(new THREE.Color(0xffffff), 0.5);
    const tint = new THREE.Color(p.color);
    this.add({
      obj: arc,
      age: 0,
      life: 0.34,
      geos: [],
      ownGeos: deformed ? [geo] : undefined,
      mats: [mat],
      shared: true,
      update: (e, dt) => {
        const t = e.age / e.life;
        // Fast bloom → hold → fade (Souls/action-game slash timing)
        const grow = t < 0.22 ? 0.72 + (t / 0.22) * 0.55 : 1.27 - ((t - 0.22) / 0.78) * 0.12;
        arc.scale.copy(baseScale).multiplyScalar(grow);
        // Authored roll direction only (no random flip)
        const rollSign = p.rotate >= 0 ? 1 : -1;
        arc.rotateZ(0.55 * dt * rollSign);
        if (t < 0.16) mat.color.copy(core);
        else mat.color.lerp(tint, Math.min(1, (t - 0.16) / 0.18));
        mat.opacity = t < 0.18 ? t / 0.18 : Math.max(0, 1 - (t - 0.18) / 0.82);
      },
    });
  }

  /**
   * Play a full deterministic melee slash pack: primary (+ optional secondary) arc
   * from {@link MeleeStrikeFxProfile}. No random crescent selection.
   */
  playMeleeSlash(
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    profile: {
      arcIndex: number;
      arc: SlashFxParams;
      secondaryArcIndex?: number;
      secondaryArc?: SlashFxParams;
      secondaryDelay?: number;
    },
  ) {
    const n = Math.max(1, this.slashArcs.length);
    const idx = ((profile.arcIndex % n) + n) % n;
    this.slashArcParam(idx, pos, quat, profile.arc);
    if (
      profile.secondaryArc &&
      profile.secondaryArcIndex != null &&
      this.slashArcs.length > 0
    ) {
      const delay = profile.secondaryDelay ?? 0.045;
      const sIdx = ((profile.secondaryArcIndex % n) + n) % n;
      const p2 = pos.clone();
      const q2 = quat.clone();
      const params = profile.secondaryArc;
      // Schedule via effect age — spawn delayed secondary as zero-life marker effect
      this.add({
        obj: new THREE.Object3D(),
        age: 0,
        life: delay + 0.02,
        geos: [],
        mats: [],
        update: (e) => {
          if (e.age >= delay && !(e as { _fired?: boolean })._fired) {
            (e as { _fired?: boolean })._fired = true;
            this.slashArcParam(sIdx, p2, q2, params);
          }
        },
      });
    }
  }

  /**
   * Forward slash-wave projectile (melee projectile deploy) — flat additive disc
   * that travels along `dir` and calls onHit at end / optional range.
   */
  slashWave(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    opts: { speed?: number; range?: number; color?: number; onHit?: (p: THREE.Vector3) => void } = {},
  ) {
    const speed = opts.speed ?? 14;
    const range = opts.range ?? 5;
    const color = opts.color ?? 0x9fd0ff;
    const d = dir.clone();
    d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Thin horizontal ring as cutting wave
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.55, 24), mat);
    mesh.position.copy(from);
    mesh.position.y = Math.max(0.9, from.y);
    mesh.lookAt(mesh.position.clone().add(d));
    mesh.rotateX(Math.PI / 2);
    const life = range / speed;
    this.add({
      obj: mesh,
      age: 0,
      life,
      geos: [mesh.geometry],
      mats: [mat],
      update: (e, dt) => {
        mesh.position.addScaledVector(d, speed * dt);
        const t = e.age / e.life;
        mat.opacity = 0.95 * (1 - t * t);
        const s = 0.85 + t * 1.4;
        mesh.scale.set(s, s, s);
        if (t > 0.92 && opts.onHit) {
          opts.onHit(mesh.position.clone());
          opts.onHit = undefined;
        }
      },
    });
    // Trail dust along path start
    this.burst(from.clone(), color, 6, 1.5, { spread: 0.2 });
  }

  /**
   * Clone a crescent's geometry and deform it: `thickness` scales the ribbon's
   * mid (width) axis; `bend` curls it in the length×width plane proportional to
   * each vertex's position along the long axis. Returns an OWNED geometry the
   * caller must dispose (via `ownGeos`). MeshBasic ignores normals, so we skip
   * normal recomputation. Never mutates the shared template.
   */
  private deformSlashGeo(src: THREE.BufferGeometry, bend: number, thickness: number): THREE.BufferGeometry {
    const geo = src.clone();
    geo.computeBoundingBox();
    const size = new THREE.Vector3();
    geo.boundingBox!.getSize(size);
    const ext = [size.x, size.y, size.z];
    const order = [0, 1, 2].sort((a, b) => ext[b] - ext[a]);
    const L = order[0]; // longest = arc length
    const M = order[1]; // mid = ribbon width
    const halfL = ext[L] / 2 || 1;
    const bendRad = bend * Math.PI * 0.9;
    const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const v = [0, 0, 0];
    for (let k = 0; k < arr.length; k += 3) {
      v[0] = arr[k];
      v[1] = arr[k + 1];
      v[2] = arr[k + 2];
      v[M] *= thickness;
      if (bend !== 0) {
        const a = bendRad * (v[L] / halfL);
        const l = v[L];
        const m = v[M];
        v[L] = l * Math.cos(a) - m * Math.sin(a);
        v[M] = l * Math.sin(a) + m * Math.cos(a);
      }
      arr[k] = v[0];
      arr[k + 1] = v[1];
      arr[k + 2] = v[2];
    }
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }

  /**
   * A crackling lightning bolt at a point (skinned GLB clip). No-op until the
   * model loads; callers should pair it with a spark burst for impact.
   */
  lightning(pos: THREE.Vector3, scale = 1) {
    const tpl = this.lightningTpl;
    if (!tpl) return;
    const obj = tpl.scene.clone(true);
    obj.position.copy(pos);
    obj.scale.multiplyScalar(scale);
    obj.rotation.y = Math.random() * Math.PI * 2;
    const mats: THREE.Material[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = Array.isArray(m.material) ? m.material[0] : m.material;
      const c = (src as THREE.Material).clone();
      (c as THREE.MeshBasicMaterial).transparent = true;
      (c as THREE.MeshBasicMaterial).depthWrite = false;
      (c as THREE.MeshBasicMaterial).blending = THREE.AdditiveBlending;
      m.material = c;
      mats.push(c);
    });
    const mixer = new THREE.AnimationMixer(obj);
    if (tpl.clip) mixer.clipAction(tpl.clip).play();
    this.add({
      obj,
      age: 0,
      life: 0.5,
      geos: [],
      mats,
      mixer,
      shared: true,
      update: (e) => {
        const t = e.age / e.life;
        for (const m of mats) (m as THREE.MeshBasicMaterial).opacity = 1 - t;
      },
    });
  }

  /**
   * A glowing head that arcs along a quadratic spline from `from` to `to`,
   * trailing a fading line behind it; calls onHit at the destination. Used by
   * the Skyfall special to rain attacks down onto targets.
   */
  splineStrike(from: THREE.Vector3, to: THREE.Vector3, color = 0xb98cff, onHit?: (p: THREE.Vector3) => void) {
    // Control point lifted well above the midpoint so the bolt arcs high and dives.
    const mid = from.clone().lerp(to, 0.5);
    mid.y = Math.max(from.y, to.y) + 5 + Math.random() * 3;
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    const SEG = 48;
    const pts = curve.getPoints(SEG);
    const flat = new Float32Array((SEG + 1) * 3);
    for (let i = 0; i <= SEG; i++) {
      flat[i * 3] = pts[i].x;
      flat[i * 3 + 1] = pts[i].y;
      flat[i * 3 + 2] = pts[i].z;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(flat, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    trailGeo.setDrawRange(0, 1);

    // Comet head: a white-hot core inside a colored additive halo.
    const coreGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(coreGeo, coreMat);
    const haloGeo = new THREE.SphereGeometry(0.7, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    const head = new THREE.Group();
    head.add(core, halo);
    head.position.copy(from);

    const group = new THREE.Group();
    group.add(trail, head);

    const travel = 0.42;
    let fired = false;
    this.add({
      obj: group,
      age: 0,
      life: travel + 0.25,
      geos: [trailGeo, coreGeo, haloGeo],
      mats: [trailMat, coreMat, haloMat],
      update: (e) => {
        const t = Math.min(1, e.age / travel);
        const idx = Math.max(1, Math.floor(t * SEG) + 1);
        trailGeo.setDrawRange(0, idx);
        head.position.copy(curve.getPoint(t));
        halo.scale.setScalar(1 + Math.sin(e.age * 40) * 0.15);
        if (t >= 1) {
          coreMat.opacity = 0;
          haloMat.opacity = 0;
          trailMat.opacity = Math.max(0, 1 - (e.age - travel) / 0.25);
          if (!fired) {
            fired = true;
            this.impactFlash(to.clone(), color);
            onHit?.(to.clone());
          }
        }
      },
    });
  }

  /**
   * Spinning disc under a hovering caster's feet — style varies by staff school
   * (arcane runes, wind swirl, nature bloom, holy radiance, fire embers).
   * Short-lived pulse; call on a throttle while hovering for a sustained look.
   */
  hoverFootDisc(
    pos: THREE.Vector3,
    color = 0xb98cff,
    style: "arcane" | "wind" | "storm" | "nature" | "holy" | "fire" = "arcane",
  ) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color,
      map: ringTexture(),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(unitGroundPlane(), mat);
    disc.position.y = 0.04;
    disc.scale.setScalar(style === "wind" ? 1.35 : 1.1);
    group.add(disc);

    // Inner accent ring (arcane / holy get a tighter core)
    if (style === "arcane" || style === "holy" || style === "nature") {
      const coreMat = new THREE.MeshBasicMaterial({
        color: style === "holy" ? 0xfff6c8 : style === "nature" ? 0xc8ffb0 : 0xe8d0ff,
        map: ringTexture(),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const core = new THREE.Mesh(unitGroundPlane(), coreMat);
      core.position.y = 0.05;
      core.scale.setScalar(0.55);
      group.add(core);
    }

    // Wind: vertical soft columns that suggest a vortex
    const extraMats: THREE.Material[] = [mat];
    if (style === "wind" || style === "storm") {
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const streak = new THREE.Mesh(
          new THREE.PlaneGeometry(0.12, 0.55),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        streak.position.set(Math.cos(ang) * 0.45, 0.28, Math.sin(ang) * 0.45);
        streak.rotation.y = -ang;
        group.add(streak);
        extraMats.push(streak.material as THREE.Material);
      }
    }

    group.position.set(pos.x, 0, pos.z);
    const spin = style === "wind" || style === "storm" ? 9 : style === "fire" ? 6 : 4;
    this.add({
      obj: group,
      age: 0,
      life: 0.28,
      geos: [],
      mats: extraMats,
      sharedMaps: true,
      update: (e) => {
        const t = e.age / e.life;
        group.rotation.y += spin * 0.016;
        const s = 0.9 + t * 0.55 + (style === "wind" ? Math.sin(e.age * 20) * 0.06 : 0);
        disc.scale.setScalar(s * (style === "wind" ? 1.35 : 1.1));
        mat.opacity = 0.85 * (1 - t);
        for (const m of extraMats) {
          if (m !== mat) (m as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - t);
        }
      },
    });

    if (style === "fire") {
      this.burst(pos.clone().setY(0.15), color, 6, 1.4);
    }
  }

  /**
   * Ice wall slab between two ground points (or in front of the caster).
   * Semi-transparent cyan crystal barrier that fades after `life` seconds.
   */
  iceWall(a: THREE.Vector3, b: THREE.Vector3, color = 0x9fdcff, life = 3.2) {
    const mid = a.clone().lerp(b, 0.5);
    mid.y = 0;
    const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    const len = Math.max(1.2, dir.length());
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    else dir.normalize();
    const width = Math.min(4.5, Math.max(2.2, len * 0.85));
    const height = 2.4;
    const depth = 0.35;

    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.45,
      thickness: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const wall = new THREE.Mesh(geo, mat);
    wall.position.set(mid.x, height * 0.5, mid.z);
    wall.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;

    // Ground frost line under the wall
    this.shockwave(mid.clone().setY(0.02), color, width * 0.55, 0.55);

    this.add({
      obj: wall,
      age: 0,
      life,
      geos: [geo],
      mats: [mat],
      update: (e) => {
        const t = e.age / e.life;
        // Grow in quickly, hold, then shatter-fade
        if (t < 0.12) {
          wall.scale.y = t / 0.12;
          mat.opacity = 0.55 * (t / 0.12);
        } else if (t > 0.75) {
          const fade = 1 - (t - 0.75) / 0.25;
          mat.opacity = 0.55 * fade;
          wall.scale.y = 0.85 + 0.15 * fade;
        } else {
          wall.scale.y = 1;
          mat.opacity = 0.55;
        }
      },
    });
  }

  /**
   * Frozen shell / ice statue left behind when the ice mage clones-and-dodges.
   * Reads as a translucent humanoid ice shell (capsule + shoulders).
   */
  frozenShell(pos: THREE.Vector3, color = 0x9fdcff, life = 2.8): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      roughness: 0.12,
      metalness: 0.08,
      transmission: 0.5,
      thickness: 0.8,
      depthWrite: false,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 12), mat);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat.clone());
    head.position.y = 1.7;
    const shardGeo = new THREE.ConeGeometry(0.12, 0.45, 5);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const shard = new THREE.Mesh(shardGeo, mat.clone());
      shard.position.set(Math.cos(ang) * 0.4, 0.9 + (i % 2) * 0.3, Math.sin(ang) * 0.4);
      shard.rotation.z = Math.cos(ang) * 0.4;
      shard.rotation.x = Math.sin(ang) * 0.4;
      group.add(shard);
    }
    group.add(body, head);
    group.position.set(pos.x, 0, pos.z);

    this.shockwave(pos.clone().setY(0.03), color, 1.4, 0.4);

    const mats: THREE.Material[] = [mat];
    group.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) mats.push(...(Array.isArray(m) ? m : [m]));
    });

    this.add({
      obj: group,
      age: 0,
      life,
      geos: [body.geometry, head.geometry, shardGeo],
      mats,
      update: (e) => {
        const t = e.age / e.life;
        if (t < 0.1) group.scale.setScalar(0.6 + 4 * t);
        else if (t > 0.82) {
          const fade = 1 - (t - 0.82) / 0.18;
          for (const mm of mats) {
            (mm as THREE.MeshPhysicalMaterial).opacity = 0.5 * fade;
          }
          group.scale.setScalar(1 + (1 - fade) * 0.4);
        }
      },
    });
    return group;
  }

  /** Expanding frost circle on the ground (freeze AoE telegraph + impact). */
  frostGround(pos: THREE.Vector3, radius = 3.2, color = 0x9fdcff, life = 1.1) {
    this.shockwave(pos.clone().setY(0.04), color, radius, life * 0.55);
    // Icy particle bloom
    this.burst(pos.clone().setY(0.2), color, Math.round(18 + radius * 4), 2.4);
    this.puff(pos.clone().setY(0.12), 0xe8f7ff, 10, 1.2);

    // Lingering frost plate
    const mat = new THREE.MeshBasicMaterial({
      color,
      map: ringTexture(),
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const plate = new THREE.Mesh(unitGroundPlane(), mat);
    plate.position.set(pos.x, 0.03, pos.z);
    plate.scale.setScalar(radius * 1.6);
    this.add({
      obj: plate,
      age: 0,
      life,
      geos: [],
      mats: [mat],
      sharedMaps: true,
      update: (e) => {
        const t = e.age / e.life;
        mat.opacity = 0.4 * (1 - t);
        plate.scale.setScalar(radius * (1.4 + t * 0.5));
      },
    });
  }

  /**
   * Blizzard field: falling ice sparks over a ground radius + expanding frost rings.
   * `onTick` fires a few times so combat can apply freeze damage over the duration.
   */
  blizzardField(
    center: THREE.Vector3,
    radius = 7,
    color = 0x9fdcff,
    life = 3.5,
    onTick?: (p: THREE.Vector3, i: number) => void,
  ) {
    const c = center.clone();
    c.y = 0;
    this.frostGround(c, radius * 0.55, color, 0.8);
    this.nova(c.clone().setY(0.6), color);

    const count = 48;
    const pos = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      pos[i * 3] = c.x + Math.cos(ang) * r;
      pos[i * 3 + 1] = 3.5 + Math.random() * 2.5;
      pos[i * 3 + 2] = c.z + Math.sin(ang) * r;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.6, -2.2 - Math.random() * 1.8, (Math.random() - 0.5) * 0.6));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.18,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    let ticks = 0;
    this.add({
      obj: pts,
      age: 0,
      life,
      geos: [geo],
      mats: [mat],
      update: (e, dt) => {
        const arr = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
          arr[i * 3] += vel[i]!.x * dt;
          arr[i * 3 + 1] += vel[i]!.y * dt;
          arr[i * 3 + 2] += vel[i]!.z * dt;
          if (arr[i * 3 + 1]! < 0.05) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            arr[i * 3] = c.x + Math.cos(ang) * r;
            arr[i * 3 + 1] = 3.2 + Math.random() * 2;
            arr[i * 3 + 2] = c.z + Math.sin(ang) * r;
          }
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = 0.9 * (1 - e.age / e.life * 0.5);
        // Pulse combat ticks ~every 0.55s
        const want = Math.floor(e.age / 0.55);
        while (ticks <= want && ticks < 6) {
          onTick?.(c.clone(), ticks);
          ticks++;
          if (ticks % 2 === 0) this.shockwave(c.clone().setY(0.04), color, radius * 0.7, 0.45);
        }
      },
    });
  }

  /**
   * Skyfall energy: a glowing head that springs UP from a source above the
   * player to a high peak, then DIVES onto a ground target — a two-phase
   * rise->fall arc (decelerate up, accelerate down) with a lateral curve,
   * adapted from the CopperCube `action_3D_Explosion_Physics` reference.
   */
  /**
   * Skyfall bolt (R special VFX). Optional `scale` (default 1) shrinks the head
   * for multi-shot barrages (e.g. crossbow skill 4).
   */
  skyfallStrike(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color = 0xb98cff,
    rise = 5,
    onHit?: (p: THREE.Vector3) => void,
    scale = 1,
  ) {
    const sc = THREE.MathUtils.clamp(scale, 0.25, 2.5);
    const mid = from.clone().lerp(to, 0.5);
    // Lateral curve offset (the reference's Fly_Width) perpendicular to travel.
    const side = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x);
    if (side.lengthSq() > 1e-6) side.normalize();
    const peak = mid.clone().addScaledVector(side, (Math.random() - 0.5) * 3 * sc);
    peak.y = Math.max(from.y, to.y) + rise * (0.55 + 0.45 * sc);
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), peak, to.clone());
    const SEG = 48;
    const pts = curve.getPoints(SEG);
    const flat = new Float32Array((SEG + 1) * 3);
    for (let i = 0; i <= SEG; i++) {
      flat[i * 3] = pts[i].x;
      flat[i * 3 + 1] = pts[i].y;
      flat[i * 3 + 2] = pts[i].z;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(flat, 3));
    const trailMat = new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const trail = new THREE.Line(trailGeo, trailMat);
    trailGeo.setDrawRange(0, 1);

    const coreGeo = new THREE.SphereGeometry(0.3 * sc, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(coreGeo, coreMat);
    const haloGeo = new THREE.SphereGeometry(0.7 * sc, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    const head = new THREE.Group();
    head.add(core, halo);
    head.position.copy(from);

    const group = new THREE.Group();
    group.add(trail, head);

    const riseTime = 0.22 + 0.04 * sc;
    const fallTime = 0.26 + 0.04 * sc;
    const travel = riseTime + fallTime;
    let fired = false;
    this.add({
      obj: group,
      age: 0,
      life: travel + 0.25,
      geos: [trailGeo, coreGeo, haloGeo],
      mats: [trailMat, coreMat, haloMat],
      update: (e) => {
        // Reparametrize the bezier so the head decelerates up to the peak
        // (OutQuad over [0,0.5]) then accelerates down like gravity (InQuad).
        let param: number;
        if (e.age < riseTime) {
          const lp = THREE.MathUtils.clamp(e.age / riseTime, 0, 1);
          param = 0.5 * (1 - (1 - lp) * (1 - lp));
        } else {
          const lp = THREE.MathUtils.clamp((e.age - riseTime) / fallTime, 0, 1);
          param = 0.5 + 0.5 * (lp * lp);
        }
        const idx = Math.max(1, Math.floor(param * SEG) + 1);
        trailGeo.setDrawRange(0, idx);
        head.position.copy(curve.getPoint(param));
        halo.scale.setScalar(1 + Math.sin(e.age * 40) * 0.15);
        if (e.age >= travel) {
          coreMat.opacity = 0;
          haloMat.opacity = 0;
          trailMat.opacity = Math.max(0, 1 - (e.age - travel) / 0.25);
          if (!fired) {
            fired = true;
            this.impactFlash(to.clone(), color);
            onHit?.(to.clone());
          }
        }
      },
    });
  }

  /** Quick bright expanding flash sphere for a heavy impact. */
  private impactFlash(center: THREE.Vector3, color: number) {
    const geo = new THREE.SphereGeometry(0.5, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.copy(center);
    this.add({
      obj: flash,
      age: 0,
      life: 0.28,
      geos: [geo],
      mats: [mat],
      update: (e) => {
        const t = e.age / e.life;
        flash.scale.setScalar(1 + t * 5);
        mat.opacity = 1 - t;
      },
    });
  }

  /**
   * Motion-blur streak for a dash: a fading ribbon plus a few translucent ghost
   * silhouettes laid along the path from `from` to `to`.
   */
  dashStreak(from: THREE.Vector3, to: THREE.Vector3, color = 0x9fe8ff) {
    const group = new THREE.Group();
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];

    // Ribbon: a thin elongated box bridging the dash, additively blended.
    const dir = to.clone().sub(from);
    const len = Math.max(0.5, dir.length());
    const ribbonGeo = new THREE.BoxGeometry(0.5, 0.18, len);
    const ribbonMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.copy(from.clone().lerp(to, 0.5));
    ribbon.position.y += 1.0;
    ribbon.lookAt(to.x, ribbon.position.y, to.z);
    group.add(ribbon);
    geos.push(ribbonGeo);
    mats.push(ribbonMat);

    // Ghost silhouettes (capsules) for the "blur" afterimage.
    const ghostMats: THREE.MeshBasicMaterial[] = [];
    const ghosts = 5;
    for (let i = 0; i < ghosts; i++) {
      const g = new THREE.CapsuleGeometry(0.32, 0.9, 4, 8);
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28 * (1 - i / ghosts),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ghost = new THREE.Mesh(g, m);
      ghost.position.copy(from.clone().lerp(to, i / (ghosts - 1)));
      ghost.position.y += 1.0;
      group.add(ghost);
      geos.push(g);
      mats.push(m);
      ghostMats.push(m);
    }

    this.add({
      obj: group,
      age: 0,
      life: 0.32,
      geos,
      mats,
      update: (e) => {
        const k = 1 - e.age / e.life;
        ribbonMat.opacity = 0.5 * k;
        for (let i = 0; i < ghostMats.length; i++) {
          ghostMats[i].opacity = 0.28 * (1 - i / ghosts) * k;
        }
      },
    });
  }

  /** Big area blast: soft ground shockwave + radial flame tongues + ember spray. */
  aoeBlast(center: THREE.Vector3, color = 0xffb24d, radius = 4) {
    // No solid spinning disc/torus — this is a flame-hand vector dispersal:
    // radial flame tongues fanning outward + an outward ember spray, grounded by
    // a single soft shockwave.
    const ground = new THREE.Vector3(center.x, 0.05, center.z);
    this.shockwave(ground, color, radius, 0.5);

    const col = new THREE.Color(color);
    const hot = col.clone().lerp(new THREE.Color(0xffffff), 0.55);
    const up = new THREE.Vector3(0, 1, 0);

    // --- Flame "hands": elongated tongues that disperse outward along clear
    // radial vectors, stretching out + curling up before fading.
    const fingers = 8;
    for (let i = 0; i < fingers; i++) {
      const ang = (i / fingers) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const out = new THREE.Vector3(
        Math.cos(ang),
        0.4 + Math.random() * 0.25,
        Math.sin(ang),
      ).normalize();
      const len = radius * (0.85 + Math.random() * 0.45);
      const geo = new THREE.ConeGeometry(Math.max(0.12, radius * 0.13), len, 6, 1, true);
      // Base at origin, tip pointing +Y so it grows away from the centre.
      geo.translate(0, len / 2, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: hot.getHex(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const tongue = new THREE.Mesh(geo, mat);
      tongue.position.copy(center);
      tongue.quaternion.setFromUnitVectors(up, out);
      const flick = 0.65 + Math.random() * 0.45;
      this.add({
        obj: tongue,
        age: 0,
        life: 0.4 + Math.random() * 0.14,
        geos: [geo],
        mats: [mat],
        update: (e) => {
          const t = e.age / e.life;
          // Shoot outward fast while thinning down — a dispersing flame jet.
          const grow = 0.35 + t * 1.05;
          const thin = (1 - t) * 1.1 + 0.1;
          tongue.scale.set(thin, grow, thin);
          (mat.color as THREE.Color).copy(hot).lerp(col, t);
          mat.opacity = (1 - t) * flick;
        },
      });
    }

    // --- Radial ember spray: particles flung OUTWARD along the ground with lift
    // + drag, so they fan out and disperse (vector dispersal, not a ring).
    const count = Math.round(40 + radius * 8);
    const positions = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = center.x;
      positions[i * 3 + 1] = center.y + 0.15;
      positions[i * 3 + 2] = center.z;
      const a = Math.random() * Math.PI * 2;
      const speed = radius * (1.6 + Math.random() * 1.9);
      vel.push(
        new THREE.Vector3(
          Math.cos(a) * speed,
          0.8 + Math.random() * 2.4,
          Math.sin(a) * speed,
        ),
      );
    }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pmat = new THREE.PointsMaterial({
      color,
      size: 0.26,
      map: this.sparkTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(pgeo, pmat);
    this.add({
      obj: pts,
      age: 0,
      life: 0.62,
      geos: [pgeo],
      mats: [pmat],
      update: (e, dt) => {
        const arr = pgeo.attributes.position.array as Float32Array;
        const drag = Math.max(0, 1 - 2.4 * dt);
        for (let i = 0; i < count; i++) {
          vel[i].x *= drag;
          vel[i].z *= drag;
          vel[i].y -= 5 * dt;
          arr[i * 3] += vel[i].x * dt;
          arr[i * 3 + 1] += vel[i].y * dt;
          arr[i * 3 + 2] += vel[i].z * dt;
        }
        pgeo.attributes.position.needsUpdate = true;
        const t = e.age / e.life;
        pmat.opacity = 1 - t;
        pmat.size = 0.26 * (1 - t * 0.5);
      },
    });
  }

  /**
   * Shader-based melee impact — replaces the old ring/torus "donut": a flat
   * ground burst (expanding hot ring + radial energy spikes + a bright core) plus
   * a short-lived additive fresnel glow sphere at the strike point. `scale` is the
   * ground burst radius in metres; the sphere tracks it.
   */
  impact(pos: THREE.Vector3, color = 0xaee6ff, scale = 2) {
    const col = new THREE.Color(color);

    // --- Ground burst (custom shader on a flat quad). ---
    const ringGeo = new THREE.PlaneGeometry(1, 1);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
        uColor: { value: col },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uProgress;
        uniform vec3 uColor;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float ang = atan(p.y, p.x);
          float fade = 1.0 - uProgress;
          // Expanding shockwave ring.
          float ringR = uProgress;
          float ring = smoothstep(0.10, 0.0, abs(r - ringR));
          // Radial energy spikes that sweep outward with the ring.
          float spikes = pow(max(0.0, sin(ang * 12.0)), 6.0);
          spikes *= smoothstep(0.5, 0.0, abs(r - ringR * 1.05)) * (0.4 + 0.6 * fade);
          // Hot core that flashes early and collapses.
          float core = smoothstep(0.45 * (1.0 - uProgress) + 0.02, 0.0, r) * pow(fade, 1.5);
          float a = (ring + spikes * 0.9 + core * 1.4) * fade;
          if (a <= 0.001) discard;
          vec3 c = uColor * (1.0 + core * 1.5);
          gl_FragColor = vec4(c, a);
        }
      `,
    });
    const ground = new THREE.Mesh(ringGeo, ringMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(pos.x, 0.06, pos.z);
    ground.scale.setScalar(scale * 2.2);
    this.add({
      obj: ground,
      age: 0,
      life: 0.42,
      geos: [ringGeo],
      mats: [ringMat],
      update: (e) => {
        ringMat.uniforms.uProgress.value = Math.min(1, e.age / e.life);
      },
    });

    // --- Strike-point glow sphere (additive fresnel). ---
    const sphGeo = new THREE.IcosahedronGeometry(1, 3);
    const sphMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uProgress: { value: 0 },
        uColor: { value: col },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vNormal;
        varying vec3 vView;
        uniform float uProgress;
        uniform vec3 uColor;
        void main() {
          float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
          float fade = 1.0 - uProgress;
          float a = fres * fade * 1.2;
          if (a <= 0.001) discard;
          gl_FragColor = vec4(uColor * (1.0 + fade), a);
        }
      `,
    });
    const glow = new THREE.Mesh(sphGeo, sphMat);
    glow.position.copy(pos);
    this.add({
      obj: glow,
      age: 0,
      life: 0.3,
      geos: [sphGeo],
      mats: [sphMat],
      update: (e) => {
        const t = Math.min(1, e.age / e.life);
        sphMat.uniforms.uProgress.value = t;
        glow.scale.setScalar(scale * (0.25 + t * 0.7));
      },
    });

    // A few sparks for grit.
    this.burst(pos, color, 14, scale * 2);
    // Instanced smoke pop adds volume + airborne debris on the hit.
    this.smoke.smokePop(pos, color, scale * 0.5);
  }

  /**
   * Anime parry CLASH spark: a crisp double burst of bright metallic sparks at
   * the point where a blow is turned aside — a hot white core inside a coloured
   * flare, plus the shared impact glow — so a perfect parry / deflect by either
   * fighter reads as a ringing clash of steel rather than a soft flash. Purely
   * cosmetic; composes existing primitives and adds no per-frame state.
   */
  parryClash(at: THREE.Vector3, color = 0xfff2c0) {
    this.impact(at, color, 1.4);
    this.burst(at, color, 30, 4.2);
    this.burst(at, 0xffffff, 18, 2.6);
  }

  // ---- Acid (Mimic) -------------------------------------------------------

  /**
   * Lob an arcing acid glob from `from` to a FIXED `to` (the player's position
   * captured at launch — it does NOT home), bursting in a `radius`-metre acid
   * AoE where it lands. A ground telegraph ring marks the landing zone the
   * instant it fires so the player can roll clear. Purely procedural (no GLB).
   */
  acidLob(from: THREE.Vector3, to: THREE.Vector3, radius = 3, onHit?: (p: THREE.Vector3) => void) {
    const dist = Math.max(0.5, from.distanceTo(to));
    const mid = from.clone().lerp(to, 0.5);
    mid.y += Math.min(5, dist * 0.5) + 1.2; // raised control point → readable arc
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    // Telegraph the landing zone up front.
    this.auraRing(new THREE.Vector3(to.x, 0.06, to.z), ACID_BODY, radius, Math.max(0.6, dist / 11));

    const geo = new THREE.IcosahedronGeometry(0.16, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: ACID_BODY,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glob = new THREE.Mesh(geo, mat);
    glob.position.copy(from);
    this.addTrail(glob, ACID_BODY, { width: 0.2 });
    const speed = 11;
    const life = dist / speed;
    let hit: ((p: THREE.Vector3) => void) | undefined = onHit;
    let dripT = 0;
    this.add({
      obj: glob,
      age: 0,
      life,
      geos: [geo],
      mats: [mat],
      update: (e, dt) => {
        const t = Math.min(1, e.age / e.life);
        curve.getPoint(t, glob.position);
        glob.rotation.x += dt * 6;
        dripT += dt;
        if (dripT > 0.08) {
          dripT = 0;
          this.burst(glob.position.clone(), ACID_DARK, 3, 1.2, { spread: 0.1, sizeScale: 0.5 });
        }
        if (e.age + dt >= e.life && hit) {
          this.acidBurst(to.clone(), radius);
          hit(to.clone());
          hit = undefined;
        }
      },
    });
  }

  /**
   * A `radius`-metre acid AoE explosion: an expanding green shockwave ring, a
   * bright toxic flash, a droplet spray, and a lingering acid pool that dissolves
   * over a couple of seconds. Landing effect for {@link acidLob}.
   */
  acidBurst(pos: THREE.Vector3, radius = 3) {
    const ground = new THREE.Vector3(pos.x, 0.05, pos.z);
    this.shockwave(ground, ACID_BODY, radius, 0.7);
    this.impact(pos, ACID_CORE, radius * 0.55);
    this.burst(
      new THREE.Vector3(pos.x, pos.y + 0.2, pos.z),
      ACID_BODY,
      Math.round(28 + radius * 8),
      4.5 * (radius / 3),
    );
    this.smoke.smokePop(pos, ACID_DARK, radius * 0.4);

    // Lingering acid pool: a translucent green disc that grows to `radius`, then
    // slowly dissolves. Mirrors the shockwave's shared-plane + ring-texture idiom.
    const poolMat = new THREE.MeshBasicMaterial({
      color: ACID_DARK,
      map: ringTexture(),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0,
    });
    const pool = new THREE.Mesh(unitGroundPlane(), poolMat);
    pool.position.set(pos.x, 0.04, pos.z);
    this.add({
      obj: pool,
      age: 0,
      life: 2.2,
      geos: [],
      mats: [poolMat],
      sharedMaps: true,
      update: (e) => {
        const t = e.age / e.life;
        const grow = Math.min(1, t / 0.2);
        const s = radius * 2.5 * grow;
        pool.scale.set(s, s, s);
        poolMat.opacity = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.55;
      },
    });
  }

  /**
   * Motion-blur afterimage made from the character's OWN mesh: clones the live
   * rig (SkeletonUtils, frozen at the current pose) into `count` additive ghosts
   * spaced along the dash path from `from` toward `dir`. Clones SHARE the source
   * geometry + skeleton bind, so the effect is marked `shared` and we dispose only
   * the cloned ghost materials — never the shared geometry/textures.
   */
  afterimage(source: THREE.Object3D, from: THREE.Vector3, dir: THREE.Vector3, distance: number, color = 0xaee6ff, count = 4, life = 0.32) {
    const group = new THREE.Group();
    const mats: THREE.Material[] = [];
    const step = dir.clone().setY(0);
    if (step.lengthSq() < 1e-6) step.set(0, 0, 1);
    step.normalize();
    const rotY = source.rotation.y;

    for (let i = 0; i < count; i++) {
      const ghost = cloneSkeleton(source) as THREE.Object3D;
      const f = (i + 1) / (count + 1);
      ghost.position.copy(from).addScaledVector(step, distance * f);
      ghost.rotation.set(0, rotY, 0);
      ghost.scale.copy(source.scale);
      const ghostMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45 * (1 - i / count),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      mats.push(ghostMat);
      ghost.traverse((o) => {
        const m = o as THREE.Mesh;
        if ((m as THREE.Mesh).isMesh) m.material = ghostMat;
      });
      group.add(ghost);
    }

    this.add({
      obj: group,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      update: (e) => {
        const k = 1 - e.age / e.life;
        for (let i = 0; i < mats.length; i++) {
          (mats[i] as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - i / count) * k;
        }
      },
    });
  }

    /**
     * Warm fire sparks that drift UPWARD (embers rise, then settle) — the building
     * block of the Striker's fire theme. Owned points, self-disposed.
     */
    flame(pos: THREE.Vector3, color = 0xff7a1e, count = 24, power = 3) {
      const positions = new Float32Array(count * 3);
      const vel: THREE.Vector3[] = [];
      for (let i = 0; i < count; i++) {
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
        const d = new THREE.Vector3(
          (Math.random() * 2 - 1) * 0.7,
          0.6 + Math.random() * 1.2,
          (Math.random() * 2 - 1) * 0.7,
        ).multiplyScalar(power * (0.4 + Math.random()));
        vel.push(d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const tex = this.sparkTexture();
      const mat = new THREE.PointsMaterial({
        color,
        size: 0.3,
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      this.add({
        obj: points,
        age: 0,
        life: 0.6,
        geos: [geo],
        mats: [mat],
        update: (e, dt) => {
          const arr = geo.attributes.position.array as Float32Array;
          for (let i = 0; i < count; i++) {
            vel[i].y -= 2 * dt;
            vel[i].x *= 0.96;
            vel[i].z *= 0.96;
            arr[i * 3] += vel[i].x * dt;
            arr[i * 3 + 1] += vel[i].y * dt;
            arr[i * 3 + 2] += vel[i].z * dt;
          }
          geo.attributes.position.needsUpdate = true;
          const t = e.age / e.life;
          mat.opacity = 1 - t;
          mat.size = 0.3 * (1 - t * 0.4);
        },
      });
    }

    // ---------------------------------------------------------------- fire VFX kit

    /**
     * Leg-flame burst at a hit point: rising orange-red fire particles that drift
     * upward, simulating a burning foot impact. Used by the Striker hit 1 & 2.
     */
    legFlame(pos: THREE.Vector3) {
      const count = 14;
      const positions = new Float32Array(count * 3);
      const velocities: THREE.Vector3[] = [];
      for (let i = 0; i < count; i++) {
        positions[i * 3] = pos.x + (Math.random() - 0.5) * 0.22;
        positions[i * 3 + 1] = pos.y + Math.random() * 0.28;
        positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.22;
        velocities.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 1.6,
            1.8 + Math.random() * 2.4,
            (Math.random() - 0.5) * 1.6,
          ),
        );
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const tex = this.sparkTexture();
      const mat = new THREE.PointsMaterial({
        color: 0xff6820,
        size: 0.22,
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      this.add({
        obj: pts,
        age: 0,
        life: 0.7,
        geos: [geo],
        mats: [mat],
        update: (e, dt) => {
          const arr = geo.attributes.position.array as Float32Array;
          for (let i = 0; i < count; i++) {
            velocities[i].y -= 4 * dt;
            arr[i * 3] += velocities[i].x * dt;
            arr[i * 3 + 1] += velocities[i].y * dt;
            arr[i * 3 + 2] += velocities[i].z * dt;
          }
          geo.attributes.position.needsUpdate = true;
          const t = e.age / e.life;
          mat.opacity = 1 - t;
          mat.color.setHex(t < 0.45 ? 0xff7030 : 0xff3010);
        },
      });
      // White-hot core flash.
      const cGeo = new THREE.SphereGeometry(0.13, 8, 6);
      const cMat = new THREE.MeshBasicMaterial({
        color: 0xffee80,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const core = new THREE.Mesh(cGeo, cMat);
      core.position.copy(pos);
      this.add({
        obj: core,
        age: 0,
        life: 0.2,
        geos: [cGeo],
        mats: [cMat],
        update: (e) => {
          const t = e.age / e.life;
          core.scale.setScalar(1 + t * 2.8);
          cMat.opacity = 1 - t;
        },
      });
    }

    /**
     * Cone-flame burst: particles erupt backward from pos (opposite facing),
     * sweeping like a fire arc that trails behind a spin kick. Used on the Striker
     * hit 2 finisher and Skill 3 spin apex.
     */
    coneFlame(pos: THREE.Vector3, facing: THREE.Vector3) {
      const backDir = facing.clone().negate();
      const count = 36;
      const positions = new Float32Array(count * 3);
      const velocities: THREE.Vector3[] = [];
      for (let i = 0; i < count; i++) {
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y + 0.7 + Math.random() * 0.5;
        positions[i * 3 + 2] = pos.z;
        const spread = (Math.random() - 0.5) * 1.5;
        const right = new THREE.Vector3(-backDir.z, 0, backDir.x).multiplyScalar(spread);
        const vel = backDir
          .clone()
          .multiplyScalar(2.8 + Math.random() * 2.2)
          .add(right)
          .add(new THREE.Vector3(0, Math.random() * 1.1, 0));
        velocities.push(vel);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const tex = this.sparkTexture();
      const mat = new THREE.PointsMaterial({
        color: 0xff8020,
        size: 0.3,
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      this.add({
        obj: pts,
        age: 0,
        life: 0.82,
        geos: [geo],
        mats: [mat],
        update: (e, dt) => {
          const arr = geo.attributes.position.array as Float32Array;
          for (let i = 0; i < count; i++) {
            velocities[i].y -= 5.5 * dt;
            arr[i * 3] += velocities[i].x * dt;
            arr[i * 3 + 1] += velocities[i].y * dt;
            arr[i * 3 + 2] += velocities[i].z * dt;
          }
          geo.attributes.position.needsUpdate = true;
          const t = e.age / e.life;
          mat.opacity = t < 0.22 ? t / 0.22 : 1 - t;
          mat.size = 0.3 * (1 - t * 0.45);
        },
      });
      // Ground-level ring at the cone base.
      this.shockwave(new THREE.Vector3(pos.x, 0.05, pos.z), 0xff6020, 2.6, 0.52);
    }

    /**
     * Forward cone of flame (the combo finisher / lunge burst): warm particles
     * sprayed in a horizontal cone along dir plus a bright forward flash.
     */
    flameCone(origin: THREE.Vector3, dir: THREE.Vector3, color = 0xff7a1e, range = 4) {
      const f = new THREE.Vector3(dir.x, 0, dir.z);
      if (f.lengthSq() < 1e-4) f.set(0, 0, 1);
      f.normalize();
      const count = 50;
      const positions = new Float32Array(count * 3);
      const vel: THREE.Vector3[] = [];
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = origin.x;
        positions[i * 3 + 1] = origin.y;
        positions[i * 3 + 2] = origin.z;
        const spread = (Math.random() - 0.5) * 1.0;
        const d = f.clone().applyAxisAngle(up, spread);
        d.y = Math.random() * 0.6;
        d.normalize().multiplyScalar(range * (0.8 + Math.random() * 0.8));
        vel.push(d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const tex = this.sparkTexture();
      const mat = new THREE.PointsMaterial({
        color,
        size: 0.34,
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      this.add({
        obj: points,
        age: 0,
        life: 0.5,
        geos: [geo],
        mats: [mat],
        update: (e, dt) => {
          const arr = geo.attributes.position.array as Float32Array;
          for (let i = 0; i < count; i++) {
            vel[i].multiplyScalar(0.94);
            arr[i * 3] += vel[i].x * dt;
            arr[i * 3 + 1] += vel[i].y * dt;
            arr[i * 3 + 2] += vel[i].z * dt;
          }
          geo.attributes.position.needsUpdate = true;
          mat.opacity = 1 - e.age / e.life;
        },
      });
      const ahead = origin.clone().addScaledVector(f, range * 0.5);
      this.impactFlash(ahead, color);
    }

    /**
     * A travelling flaming crescent (the aerial-spin projectile): a procedural
     * additive torus-arc + white-hot core that flies along dir, sheds an ember
     * trail, and calls onHit at the end of its flight. Fully owned geometry.
     */
    flameSlashProjectile(
      from: THREE.Vector3,
      dir: THREE.Vector3,
      color = 0xff7a1e,
      ember = 0xff3b1e,
      speed = 22,
      range = 18,
      onHit?: (p: THREE.Vector3) => void,
    ) {
      const f = dir.clone().normalize();
      const group = new THREE.Group();
      const arcGeo = new THREE.TorusGeometry(0.6, 0.09, 8, 20, Math.PI * 1.25);
      const arcMat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const arc = new THREE.Mesh(arcGeo, arcMat);
      const coreGeo = new THREE.SphereGeometry(0.22, 10, 10);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(arc, core);
      group.position.copy(from);
      group.lookAt(from.clone().add(f));
      const life = range / speed;
      this.add({
        obj: group,
        age: 0,
        life,
        geos: [arcGeo, coreGeo],
        mats: [arcMat, coreMat],
        update: (e, dt) => {
          group.position.addScaledVector(f, speed * dt);
          arc.rotation.z += dt * 12;
          if (Math.random() < 0.6) this.flame(group.position.clone(), ember, 4, 1.5);
          if (e.age + dt >= e.life && onHit) {
            onHit(group.position.clone());
            onHit = undefined;
          }
        },
      });
    }

    /**
     * A traveling flame-slash projectile: wide, hot, and fire-orange. Flies toward
     * dir at medium speed; calls onHit at the end of its range with the impact
     * position. Used by the Striker's aerial Flame Tornado skill.
     */
    flameSlash(
      from: THREE.Vector3,
      dir: THREE.Vector3,
      onHit?: (p: THREE.Vector3) => void,
    ) {
      const speed = 18;
      const range = 20;
      const group = new THREE.Group();
      const coreGeo = new THREE.SphereGeometry(0.17, 10, 8);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffeeaa,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      const haloGeo = new THREE.SphereGeometry(0.44, 10, 8);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xff6020,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      const trailGeo = new THREE.ConeGeometry(0.22, 1.1, 8);
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0xff4010,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const trail = new THREE.Mesh(trailGeo, trailMat);
      trail.rotation.x = -Math.PI / 2;
      trail.position.z = 0.64;
      group.add(core, halo, trail);
      group.position.copy(from);
      const velocity = dir.clone().normalize();
      group.lookAt(from.clone().add(velocity));
      const life = range / speed;
      this.add({
        obj: group,
        age: 0,
        life,
        geos: [coreGeo, haloGeo, trailGeo],
        mats: [coreMat, haloMat, trailMat],
        update: (e, dt) => {
          group.position.addScaledVector(velocity, speed * dt);
          halo.scale.setScalar(1 + Math.sin(e.age * 22) * 0.11);
          if (e.age + dt >= e.life && onHit) {
            onHit(group.position.clone());
            onHit = undefined;
          }
        },
      });
    }

  /** Dispatch the right effect for a weapon/skill kind in front of the actor. */
  playSkill(
    kind: SkillKind,
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    quat: THREE.Quaternion,
    aim?: THREE.Vector3,
    onImpact?: (p: THREE.Vector3) => void,
    // When supplied (opt-in via CharacterDef.colliderVfx), the slash arc + GLB
    // spells launch from the swinging hand's collider pose (world position + 3D
    // angle) instead of the body's flat facing, matching the Skill Lab preview.
    // Homing spells keep curving toward `aim`; only the launch origin/angle move.
    collider?: { pos: THREE.Vector3; quat: THREE.Quaternion; aim: THREE.Vector3 },
  ) {
    const color = THEME[kind];
    const front = origin.clone().addScaledVector(forward, 1.2);
    front.y = origin.y + 1.1;
    const cast = origin.clone().setY(origin.y + 1.1);
    // Collider-bound launch point/angle (falls back to the flat-facing values).
    const slashAt = collider ? collider.pos : front;
    const slashQuat = collider ? collider.quat : quat;
    const dir3 = collider ? collider.aim : forward;
    // Spell kinds spin up a charge-up aura under the caster as a tell.
    if (kind === "fireDragon" || kind === "meteor" || kind === "darkBlades" || kind === "swordVolley" || kind === "soul") {
      this.castAura(origin.clone(), color);
    }
    switch (kind) {
      case "slash":
        this.slashArc(slashAt, slashQuat, color);
        this.burst(slashAt, color, 18, 3);
        break;
      case "slam": {
        const ground = origin.clone();
        ground.y = 0;
        this.shockwave(ground, color, 4, 0.7);
        this.burst(front, color, 30, 5);
        break;
      }
      case "bolt":
        this.bolt(front, forward, color, 26, 18, (p) => {
          this.burst(p, color, 24, 4);
          this.lightning(p, 1.1);
          this.shockwave(new THREE.Vector3(p.x, 0.05, p.z), color, 1.4, 0.4);
        });
        break;
      case "nova":
        this.nova(front, color);
        this.lightning(front, 1.4);
        break;
      case "muzzle":
        this.muzzle(front, forward, color);
        break;
      case "thrust":
        this.bolt(front, forward, color, 22, 6, (p) => this.burst(p, color, 16, 3));
        this.slashArc(slashAt, slashQuat, color);
        break;
      case "fireDragon":
        if (aim) this.castDragonAt(collider ? slashAt : cast, aim.clone(), color, onImpact);
        else this.castDragon(collider ? slashAt : cast, dir3, color, onImpact);
        break;
      case "meteor":
        this.castMeteor(
          origin,
          dir3,
          color,
          onImpact,
          aim ?? (collider ? slashAt.clone().addScaledVector(dir3, 6) : undefined),
        );
        break;
      case "turret":
        if (collider) {
          // Match the real deployed gameplay turret (Studio.deployTurret F-skill
          // branch): it stands 2.2m ahead of the caster body along the flattened
          // hand aim. castTurret shifts +1.5 along that aim, so offset by 0.7
          // here to land the chassis at origin + 2.2.
          const ground = dir3.clone().setY(0);
          if (ground.lengthSq() < 1e-4) ground.set(0, 0, 1);
          ground.normalize();
          this.castTurret(origin.clone().addScaledVector(ground, 0.7), dir3, color, onImpact);
        } else {
          this.castTurret(origin, forward, color, onImpact);
        }
        break;
      case "darkBlades":
        if (aim) this.castDarkBladesAt(collider ? slashAt : front, aim.clone().setY(aim.y + 0.8), color, onImpact);
        else this.castDarkBlades(collider ? slashAt : front, dir3, color, onImpact);
        break;
      case "swordVolley":
        this.castSwordVolley(
          origin,
          dir3,
          color,
          onImpact,
          aim ?? (collider ? slashAt.clone().addScaledVector(dir3, 4) : undefined),
        );
        break;
      case "soul":
        if (aim) this.castSoulAt(cast, aim.clone().setY(aim.y + 0.8), color, onImpact);
        else this.castSoul(cast, forward, color, onImpact);
        break;
      case "laser":
        if (aim) this.castLaserAt(front, aim.clone().setY(aim.y + 0.8), color, onImpact);
        else this.castLaser(front, forward, color, onImpact);
        break;
    }
  }

  // ----------------------------------------------------- Kiter signature VFX

  /**
   * A smoky humanoid decoy left behind by the Smoke Phantom skill: a translucent
   * grey body + head that sways and fades, with an initial poof. Purely cosmetic
   * — the Studio schedules the decoy's shots separately.
   */
  smokeClone(pos: THREE.Vector3, life = 2.2) {
    const group = new THREE.Group();
    group.position.copy(pos);
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];
    const smoke = 0x8893a6;
    const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.9, 6, 12);
    const bodyMat = new THREE.MeshBasicMaterial({ color: smoke, transparent: true, opacity: 0.5, depthWrite: false });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    const headGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const headMat = new THREE.MeshBasicMaterial({ color: smoke, transparent: true, opacity: 0.5, depthWrite: false });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.8;
    group.add(body, head);
    geos.push(bodyGeo, headGeo);
    mats.push(bodyMat, headMat);
    this.add({
      obj: group,
      age: 0,
      life,
      geos,
      mats,
      update: (e) => {
        const t = e.age / e.life;
        const op = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * 0.55;
        bodyMat.opacity = op;
        headMat.opacity = op;
        group.position.y = pos.y + Math.sin(e.age * 3) * 0.04;
        group.rotation.y += 0.012;
      },
    });
    this.burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), smoke, 24, 3);
  }

  /**
   * Tracking beam (legacy Hexaring): origin/dir re-sampled each frame.
   * Prefer {@link lockedBeam} for combat casts that freeze aim at cast start.
   */
  beam(
    getOrigin: () => THREE.Vector3,
    getDir: () => THREE.Vector3,
    color = 0x9fd8ff,
    length = 22,
    life = 1.5,
    radius = 0.36,
  ) {
    this.spawnBeamVisual({
      getOrigin,
      getDir,
      color,
      coreColor: 0xffffff,
      length,
      life,
      radius,
      locked: false,
    });
  }

  /**
   * Multi-shader locked combat beam — aim frozen at cast start.
   * Layers: opaque-ish outer shell + additive mid glow + hot core + scroll noise.
   * Radius 0.1–1 m (cylinder half-width for VFX; damage uses same radius).
   */
  lockedBeam(opts: {
    origin: THREE.Vector3;
    dir: THREE.Vector3;
    color?: number;
    coreColor?: number;
    length?: number;
    life?: number;
    /** Visual / damage cylinder radius (m), clamped 0.1–1. */
    radius?: number;
  }) {
    const o = opts.origin.clone();
    const d = opts.dir.clone();
    d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();
    const radius = Math.min(1, Math.max(0.1, opts.radius ?? 0.45));
    this.spawnBeamVisual({
      getOrigin: () => o,
      getDir: () => d,
      color: opts.color ?? 0x9fd8ff,
      coreColor: opts.coreColor ?? 0xffffff,
      length: opts.length ?? 18,
      life: opts.life ?? 0.9,
      radius,
      locked: true,
    });
  }

  private spawnBeamVisual(opts: {
    getOrigin: () => THREE.Vector3;
    getDir: () => THREE.Vector3;
    color: number;
    coreColor: number;
    length: number;
    life: number;
    radius: number;
    locked: boolean;
  }) {
    const r = Math.min(1, Math.max(0.1, opts.radius));
    // Multi-layer cylinders (unit height along Y, scaled to length)
    const coreGeo = new THREE.CylinderGeometry(r * 0.22, r * 0.22, 1, 14, 1, true);
    const midGeo = new THREE.CylinderGeometry(r * 0.55, r * 0.55, 1, 18, 1, true);
    const outerGeo = new THREE.CylinderGeometry(r, r * 0.92, 1, 20, 1, true);
    const shellGeo = new THREE.CylinderGeometry(r * 1.08, r * 1.02, 1, 16, 1, true);

    // Hot core — near-white additive
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(opts.coreColor) },
        uLife: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLife;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float pulse = 0.75 + 0.25 * sin(uTime * 28.0 + vUv.y * 12.0);
          float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          float a = edge * pulse * uLife;
          gl_FragColor = vec4(uColor * 1.4, a);
        }
      `,
    });
    // Mid ethereal glow
    const midMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(opts.color) },
        uLife: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLife;
        uniform vec3 uColor;
        varying vec2 vUv;
        float n(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        void main() {
          float scroll = fract(vUv.y * 3.0 - uTime * 2.2);
          float noise = n(vec2(vUv.x * 8.0, scroll * 6.0));
          float band = smoothstep(0.2, 0.55, noise) * smoothstep(0.95, 0.6, scroll);
          float a = (0.35 + 0.25 * noise) * band * uLife;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    // Outer soft shell — slightly opaque so beam reads in bright scenes
    const outerMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: 0.22,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Far corona additive
    const shellMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(coreGeo, coreMat),
      new THREE.Mesh(midGeo, midMat),
      new THREE.Mesh(outerGeo, outerMat),
      new THREE.Mesh(shellGeo, shellMat),
    );
    const up = new THREE.Vector3(0, 1, 0);
    let sparkAcc = 0;
    this.add({
      obj: group,
      age: 0,
      life: opts.life,
      geos: [coreGeo, midGeo, outerGeo, shellGeo],
      mats: [coreMat, midMat, outerMat, shellMat],
      update: (e, dt) => {
        const o = opts.getOrigin();
        const d = opts.getDir().clone().normalize();
        // Lock: still re-read origin if callback moves with hand, but dir frozen by caller
        group.position.copy(o.clone().addScaledVector(d, opts.length / 2));
        group.quaternion.setFromUnitVectors(up, d);
        group.scale.set(1, opts.length, 1);
        const t = e.age / e.life;
        const lifeFade = 1 - t * 0.35;
        const pulse = 0.85 + Math.sin(e.age * 36) * 0.15;
        coreMat.uniforms.uTime.value = e.age;
        coreMat.uniforms.uLife.value = lifeFade * pulse;
        midMat.uniforms.uTime.value = e.age;
        midMat.uniforms.uLife.value = lifeFade;
        outerMat.opacity = 0.22 * lifeFade;
        shellMat.opacity = 0.12 * lifeFade * pulse;
        sparkAcc += dt;
        if (sparkAcc > 0.05) {
          sparkAcc = 0;
          const tip = o.clone().addScaledVector(d, opts.length * (0.5 + Math.random() * 0.45));
          this.burst(tip, opts.color, 2, 1.0);
        }
      },
    });
  }

  /**
   * Charge-up ethereal field while casting a beam (spins / rises / pulls inward).
   * Call once at cast start; self-disposes after `life`.
   */
  beamChargeUp(
    getPos: () => THREE.Vector3,
    color = 0xb0d8ff,
    life = 0.55,
  ) {
    this.castAura(getPos(), color);
    this.skillCharge(getPos(), color, 1.15, Math.min(life, 0.5));
    // Spinning ethereal rings
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(0.45 + i * 0.22, 0.035, 8, 40);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55 - i * 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      const spin = (1.2 + i * 0.7) * (i % 2 === 0 ? 1 : -1);
      const tilt = 0.4 + i * 0.25;
      this.add({
        obj: ring,
        age: 0,
        life,
        geos: [geo],
        mats: [mat],
        update: (e) => {
          const p = getPos();
          ring.position.copy(p);
          ring.position.y += 0.15 + Math.sin(e.age * 6 + i) * 0.08;
          ring.rotation.x = tilt;
          ring.rotation.z = e.age * spin;
          const t = e.age / e.life;
          mat.opacity = (0.55 - i * 0.12) * (1 - t) * (0.6 + 0.4 * Math.sin(e.age * 14));
          const s = 0.7 + t * 1.1;
          ring.scale.setScalar(s);
        },
      });
    }
    // Rising motes
    this.flame(getPos().clone(), color, 16, 1.8);
  }

  /**
   * Spinning magic hexarings clone (GLB) tracking `getPos()` for `life` seconds.
   * Materials are cloned (so the colour tint + fade don't corrupt the template);
   * geometry + textures stay shared, so this is a `shared` effect. Falls back to a
   * procedural glowing torus when the GLB hasn't loaded.
   */
  hexaring(getPos: () => THREE.Vector3, color = 0x9fd8ff, life = 2) {
    const tpl = this.propTpls.get("models/props/magic-hexarings.glb");
    if (!tpl) {
      const geo = new THREE.TorusGeometry(0.7, 0.06, 8, 32);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Mesh(geo, mat);
      this.add({
        obj: ring,
        age: 0,
        life,
        geos: [geo],
        mats: [mat],
        update: (e) => {
          ring.position.copy(getPos());
          ring.rotation.y += 0.06;
          ring.rotation.x += 0.03;
          const t = e.age / e.life;
          mat.opacity = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        },
      });
      return;
    }
    const obj = tpl.clone(true);
    const mats: THREE.Material[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
      const c = src.clone() as THREE.MeshStandardMaterial;
      c.transparent = true;
      c.depthWrite = false;
      c.color = new THREE.Color(color);
      if ("emissive" in c) c.emissive = new THREE.Color(color);
      m.material = c;
      mats.push(c);
    });
    this.add({
      obj,
      age: 0,
      life,
      geos: [],
      mats,
      shared: true,
      update: (e) => {
        obj.position.copy(getPos());
        obj.rotation.y += 0.06;
        obj.rotation.z += 0.03;
        const t = e.age / e.life;
        const op = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        for (const m of mats) (m as THREE.MeshStandardMaterial).opacity = op;
      },
    });
  }

  /**
   * Block forcefield: a hex-sphere shield that flashes around a blocker when they
   * soak a big hit / combo finisher on a raised guard. Tracks `getPos()` for its
   * short `seconds` life, pops in (scale + opacity) then fades out with a slow
   * spin. Mirrors the GLB-clone contract — geometry + textures stay SHARED with
   * the template, only the cloned (additive) materials are freed (`shared`).
   * Falls back to a procedural additive wire-icosphere until the GLB has loaded.
   */
  forceField(getPos: () => THREE.Vector3, radius = 1.2, seconds = 0.5, color = 0x66e0ff) {
    const tpl = this.ensureModel("models/vfx/hex-force-field.glb", 1);
    if (!tpl) {
      const geo = new THREE.IcosahedronGeometry(radius, 2);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ball = new THREE.Mesh(geo, mat);
      this.add({
        obj: ball,
        age: 0,
        life: seconds,
        geos: [geo],
        mats: [mat],
        update: (e) => {
          ball.position.copy(getPos());
          ball.rotation.y += 0.05;
          const t = e.age / e.life;
          const pop = t < 0.25 ? t / 0.25 : 1;
          ball.scale.setScalar(0.7 + pop * 0.3);
          mat.opacity = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.9;
        },
      });
      return;
    }
    const { obj, mats } = this.cloneModelInstance(tpl);
    // The template was normalised to a unit size by ensureModel; capture that
    // base scale so the per-frame pop scales relative to the requested diameter.
    const base = obj.scale.x || 1;
    const diameter = radius * 2;
    for (const m of mats) {
      m.blending = THREE.AdditiveBlending;
      const sm = m as THREE.MeshStandardMaterial;
      if ("emissive" in sm) sm.emissive = new THREE.Color(color);
      if ("color" in sm) sm.color = new THREE.Color(color);
    }
    this.add({
      obj,
      age: 0,
      life: seconds,
      geos: [],
      mats,
      shared: true,
      update: (e) => {
        obj.position.copy(getPos());
        obj.rotation.y += 0.05;
        const t = e.age / e.life;
        const pop = t < 0.25 ? t / 0.25 : 1;
        obj.scale.setScalar(base * diameter * (0.7 + pop * 0.3));
        const op = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.95;
        for (const m of mats) m.opacity = op;
      },
    });
  }

  /**
   * Lob a thrown prop (bear-trap / grenade GLB) along an arc from `from` to `to`,
   * calling `onLand` at the endpoint. The GLB clone shares the template's geometry
   * + materials (a `shared` effect that frees nothing); a procedural sphere is the
   * fallback when the GLB is missing.
   */
  thrownProp(
    file: string,
    from: THREE.Vector3,
    to: THREE.Vector3,
    color = 0xffb24d,
    onLand?: (p: THREE.Vector3) => void,
  ) {
    const tpl = this.propTpls.get(file);
    let obj: THREE.Object3D;
    let geos: THREE.BufferGeometry[] = [];
    let mats: THREE.Material[] = [];
    let shared = false;
    if (tpl) {
      obj = tpl.clone(true);
      shared = true;
    } else {
      const g = new THREE.SphereGeometry(0.18, 10, 10);
      const m = new THREE.MeshBasicMaterial({ color });
      obj = new THREE.Mesh(g, m);
      geos = [g];
      mats = [m];
    }
    obj.position.copy(from);
    const mid = from.clone().lerp(to, 0.5);
    mid.y = Math.max(from.y, to.y) + 3;
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    const travel = 0.5;
    let fired = false;
    this.add({
      obj,
      age: 0,
      life: travel + 0.05,
      geos,
      mats,
      shared,
      update: (e) => {
        const t = Math.min(1, e.age / travel);
        obj.position.copy(curve.getPoint(t));
        obj.rotation.x += 0.3;
        obj.rotation.y += 0.22;
        if (t >= 1 && !fired) {
          fired = true;
          onLand?.(to.clone());
        }
      },
    });
  }

  /** Orbiting "stunned" stars above a struck target (cosmetic stun indicator). */
  stunMark(pos: THREE.Vector3, color = 0xffe24a, life = 1.6) {
    const group = new THREE.Group();
    group.position.copy(pos);
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];
    const N = 5;
    const stars: THREE.Mesh[] = [];
    for (let i = 0; i < N; i++) {
      const g = new THREE.TetrahedronGeometry(0.12);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Mesh(g, m);
      group.add(s);
      stars.push(s);
      geos.push(g);
      mats.push(m);
    }
    this.add({
      obj: group,
      age: 0,
      life,
      geos,
      mats,
      update: (e) => {
        const t = e.age / e.life;
        for (let i = 0; i < N; i++) {
          const a = e.age * 5 + (i / N) * Math.PI * 2;
          stars[i].position.set(Math.cos(a) * 0.5, Math.sin(e.age * 8 + i) * 0.05, Math.sin(a) * 0.5);
          stars[i].rotation.y += 0.2;
          (mats[i] as THREE.MeshBasicMaterial).opacity = 1 - t;
        }
      },
    });
  }

  /** Hexagonal shield-shatter ring at a struck target (cosmetic shield-break). */
  shieldBreak(pos: THREE.Vector3, color = 0x9fd8ff) {
    const geo = new THREE.RingGeometry(0.5, 0.62, 6);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(pos);
    this.add({
      obj: ring,
      age: 0,
      life: 0.5,
      geos: [geo],
      mats: [mat],
      update: (e) => {
        const t = e.age / e.life;
        ring.scale.setScalar(1 + t * 3);
        ring.rotation.z += 0.1;
        mat.opacity = 1 - t;
      },
    });
    this.burst(pos, color, 24, 4);
  }

  /**
   * Tear down one finished effect. `shared` effects (GLB clones) reuse the
   * template's geometry + textures, so we only free the cloned material itself —
   * never its map or geometry, which would corrupt the template.
   */
  private free(e: Effect) {
    this.scene.remove(e.obj);
    e.mixer?.stopAllAction();
    if (!e.shared) {
      for (const g of e.geos) g.dispose();
    }
    for (const m of e.mats) {
      if (!e.shared && !e.sharedMaps) {
        const map = (m as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
      }
      m.dispose();
    }
    if (e.ownGeos) {
      for (const g of e.ownGeos) g.dispose();
    }
  }

  update(dt: number) {
    // Cap + substep so lag spikes don't skip VFX lifetimes or GLB mixer frames.
    const FIXED = 1 / 60;
    let remain = Math.min(Math.max(0, dt), 0.1);
    while (remain > 0) {
      const step = remain > FIXED * 1.5 ? FIXED : remain;
      remain -= step;
      this.tickVfx(step);
    }
  }

  private tickVfx(dt: number) {
    this.updateFireTrail(dt);
    this.updateBladeTrail(dt);
    this.smoke.update(dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      e.mixer?.update(dt);
      e.update(e, dt);
      if (e.age >= e.life) {
        this.free(e);
        this.effects.splice(i, 1);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.smoke.dispose();
    for (const e of this.effects) this.free(e);
    this.effects.length = 0;
    // Free the shared GLB templates (geometry + textures) now nothing clones them.
    for (const a of this.slashArcs) {
      a.geometry.dispose();
      const mat = a.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.slashArcs.length = 0;
    this.lightningTpl?.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mat = Array.isArray(m.material) ? m.material : [m.material];
      for (const x of mat) {
        (x as THREE.MeshBasicMaterial).map?.dispose();
        x.dispose();
      }
    });
    this.lightningTpl = null;
    // Free the cloneable Kiter prop templates (geometry + textures).
    for (const tpl of this.propTpls.values()) {
      tpl.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mat = Array.isArray(m.material) ? m.material : [m.material];
        for (const x of mat) {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        }
      });
    }
    this.propTpls.clear();
    // Free the lazy-loaded projectile/spell GLB templates (dragon/meteor/turret/
    // dark-blade/swords). Nothing clones them once the Vfx is torn down.
    for (const tpl of this.modelTpls.values()) {
      tpl.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mat = Array.isArray(m.material) ? m.material : [m.material];
        for (const x of mat) {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        }
      });
    }
    this.modelTpls.clear();
    // Free the long-lived GPU flame trail.
    if (this.fireTrail) {
      this.scene.remove(this.fireTrail);
      this.fireTrailGeo?.dispose();
      this.fireTrailMat?.dispose();
      this.fireTrail = null;
      this.fireTrailGeo = null;
      this.fireTrailMat = null;
      this.firePos = this.fireOff = this.fireSpeed = null;
    }
    // Free the blade-trail ribbon.
    if (this.bladeTrail) {
      this.scene.remove(this.bladeTrail);
      this.bladeTrailGeo?.dispose();
      this.bladeTrailMat?.dispose();
      this.bladeTrail = null;
      this.bladeTrailGeo = null;
      this.bladeTrailMat = null;
      this.bladePos = this.bladeAlpha = null;
      this.bladeSamples.length = 0;
    }
  }
}
