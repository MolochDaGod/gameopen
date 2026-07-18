import * as THREE from "three";
import type { StatusId, StatusKind, StatusView } from "../types";
import { runeRingTexture, softDiscTexture, unitGroundPlane } from "./fxTextures";
import {
  createAuraShellMaterial,
  createHumanoidAuraShell,
  patternForStatusStyle,
  tickAuraMaterial,
  type AuraPattern,
} from "./auraShaders";
import {
  accentRecipeForStyle,
  createAuraAccents,
  type AuraAccentHandle,
} from "./auraAccents";

/**
 * Status-effect VFX — shader body shells + accents.
 *
 * Shell: humanoid mesh inflated **0.1 m along normals** (outside unit surface)
 * with pattern shaders (heal swell, emerald charge, ice swirl, purple arcane,
 * orange fire rise, spark grid, holy shimmer, sleep haze).
 *
 * Accents: particles, glowing orbs, wings, orbiting spline ribbons, hover crystals.
 */

type AuraStyle = "rise" | "orbit" | "spark" | "bubble" | "vortex" | "sleep";

export interface StatusDef {
  id: StatusId;
  name: string;
  kind: StatusKind;
  color: number;
  color2: number;
  glyph: string;
  duration: number;
  style: AuraStyle;
  shellOpacity?: number;
  particleCount?: number;
  /** Override shell shader pattern (else derived from style/color). */
  pattern?: AuraPattern;
  /** Normal expand in metres (default 0.1). */
  expand?: number;
}

export const STATUS_DEFS: Record<StatusId, StatusDef> = {
  burning: {
    id: "burning",
    name: "Burning",
    kind: "debuff",
    color: 0xff6a1e,
    color2: 0xffd27a,
    glyph: "▲",
    duration: 6,
    style: "rise",
    shellOpacity: 0.55,
    pattern: "fireRise",
    expand: 0.1,
  },
  frozen: {
    id: "frozen",
    name: "Frozen",
    kind: "debuff",
    color: 0x7ad0ff,
    color2: 0xeaffff,
    glyph: "◆",
    duration: 5,
    style: "orbit",
    shellOpacity: 0.5,
    pattern: "iceSwirl",
    expand: 0.1,
  },
  poisoned: {
    id: "poisoned",
    name: "Poisoned",
    kind: "debuff",
    color: 0x8cff5a,
    color2: 0xdcff9e,
    glyph: "✦",
    duration: 7,
    style: "rise",
    shellOpacity: 0.48,
    pattern: "healSwell",
    expand: 0.1,
  },
  shocked: {
    id: "shocked",
    name: "Shocked",
    kind: "debuff",
    color: 0xfff15a,
    color2: 0xffffff,
    glyph: "✱",
    duration: 4,
    style: "spark",
    shellOpacity: 0.5,
    pattern: "sparkGrid",
    expand: 0.1,
  },
  regen: {
    id: "regen",
    name: "Regen",
    kind: "buff",
    color: 0x3dff9a,
    color2: 0xb8ffd8,
    glyph: "✚",
    duration: 8,
    style: "rise",
    shellOpacity: 0.52,
    pattern: "healSwell",
    expand: 0.1,
  },
  empowered: {
    id: "empowered",
    name: "Empowered",
    kind: "buff",
    color: 0xffb020,
    color2: 0xffe8a0,
    glyph: "✦",
    duration: 8,
    style: "rise",
    shellOpacity: 0.5,
    pattern: "fireRise",
    expand: 0.1,
  },
  shielded: {
    id: "shielded",
    name: "Shielded",
    kind: "buff",
    color: 0x5ad0ff,
    color2: 0xd6f4ff,
    glyph: "⬡",
    duration: 10,
    style: "bubble",
    shellOpacity: 0.4,
    pattern: "iceSwirl",
    expand: 0.12,
  },
  haste: {
    id: "haste",
    name: "Haste",
    kind: "buff",
    color: 0x9a7aff,
    color2: 0xe6dcff,
    glyph: "✱",
    duration: 8,
    style: "spark",
    shellOpacity: 0.48,
    pattern: "arcanePulse",
    expand: 0.1,
  },
  blessed: {
    id: "blessed",
    name: "Blessed",
    kind: "buff",
    color: 0xfff0a8,
    color2: 0xffffff,
    glyph: "✧",
    duration: 10,
    style: "spark",
    shellOpacity: 0.45,
    pattern: "holyShimmer",
    expand: 0.1,
  },
  cursed: {
    id: "cursed",
    name: "Cursed",
    kind: "debuff",
    color: 0xb070ff,
    color2: 0xff70d0,
    glyph: "☠",
    duration: 8,
    style: "vortex",
    shellOpacity: 0.55,
    pattern: "arcanePulse",
    expand: 0.11,
  },
  sleep: {
    id: "sleep",
    name: "Sleep",
    kind: "debuff",
    color: 0x8ec8ff,
    color2: 0xe8f4ff,
    glyph: "Z",
    duration: 6,
    style: "sleep",
    shellOpacity: 0.35,
    pattern: "sleepHaze",
    expand: 0.1,
  },
  absorb: {
    id: "absorb",
    name: "Absorb",
    kind: "buff",
    color: 0x20e8a0,
    color2: 0xa0ffe0,
    glyph: "◎",
    duration: 9,
    style: "bubble",
    shellOpacity: 0.5,
    pattern: "chargeGlow",
    expand: 0.12,
  },
  rage: {
    id: "rage",
    name: "Rage",
    kind: "buff",
    color: 0xff3040,
    color2: 0xff9080,
    glyph: "⚔",
    duration: 7,
    style: "rise",
    shellOpacity: 0.55,
    pattern: "fireRise",
    expand: 0.1,
  },
  rooted: {
    id: "rooted",
    name: "Rooted",
    kind: "debuff",
    color: 0x8b5a2b,
    color2: 0xc4a35a,
    glyph: "⋔",
    duration: 5,
    style: "orbit",
    shellOpacity: 0.4,
    pattern: "arcanePulse",
    expand: 0.1,
  },
};

export const STATUS_IDS = Object.keys(STATUS_DEFS) as StatusId[];

export function statusCss(id: StatusId): string {
  return "#" + STATUS_DEFS[id].color.toString(16).padStart(6, "0");
}

export interface StatusMenuItem {
  id: StatusId;
  name: string;
  kind: StatusKind;
  glyph: string;
  color: string;
}
export const STATUS_MENU: StatusMenuItem[] = STATUS_IDS.map((id) => ({
  id,
  name: STATUS_DEFS[id].name,
  kind: STATUS_DEFS[id].kind,
  glyph: STATUS_DEFS[id].glyph,
  color: statusCss(id),
}));

export interface StatusAuraHandle {
  update(dt: number, center: THREE.Vector3): void;
  dispose(): void;
}

export type StatusAuraFactory = (def: StatusDef) => StatusAuraHandle;

/** Resolve pattern for a status def. */
function resolvePattern(def: StatusDef): AuraPattern {
  return (
    def.pattern ??
    patternForStatusStyle(def.style, def.kind, def.color)
  );
}

/**
 * Full aura instance: shader shell (0.1 m expand) + ground + accents + light.
 */
class StatusAura implements StatusAuraHandle {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private glow: THREE.Mesh;
  private shellMat: THREE.ShaderMaterial;
  private shell: THREE.Group;
  private accents: AuraAccentHandle[] = [];
  private light: THREE.PointLight;
  private age = 0;
  private bubble: THREE.Mesh | null = null;

  constructor(
    private scene: THREE.Scene,
    private def: StatusDef,
  ) {
    const pattern = resolvePattern(def);
    const expand = def.expand ?? 0.1;

    this.shellMat = createAuraShellMaterial({
      color: def.color,
      color2: def.color2,
      pattern,
      expand,
      opacity: def.shellOpacity ?? 0.5,
      speed: def.style === "spark" ? 1.6 : def.style === "sleep" ? 0.45 : 1.0,
    });
    this.shell = createHumanoidAuraShell(this.shellMat);
    this.group.add(this.shell);

    // Ground rune footprint
    const ringMat = new THREE.MeshBasicMaterial({
      color: def.color,
      map: runeRingTexture(),
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(unitGroundPlane(), ringMat);
    this.ring.scale.setScalar(1.5);
    this.ring.position.y = 0.03;
    this.group.add(this.ring);

    const glowMat = new THREE.MeshBasicMaterial({
      color: def.color,
      map: softDiscTexture(),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glow = new THREE.Mesh(unitGroundPlane(), glowMat);
    this.glow.scale.setScalar(1.3);
    this.glow.position.y = 0.02;
    this.group.add(this.glow);

    // Optional outer bubble for shield/absorb
    if (def.style === "bubble") {
      const bMat = new THREE.MeshBasicMaterial({
        color: def.color2,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        wireframe: true,
      });
      this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), bMat);
      this.bubble.position.y = 1.0;
      this.group.add(this.bubble);
    }

    // Accents: particles, orbs, wings, spline, crystals
    const recipe = accentRecipeForStyle(def.style, def.kind);
    // Heal / emerald charge extras
    if (pattern === "healSwell" || pattern === "chargeGlow") {
      if (!recipe.kinds.includes("orbs")) recipe.kinds.push("orbs");
      if (!recipe.kinds.includes("splineOrbit")) recipe.kinds.push("splineOrbit");
    }
    if (pattern === "holyShimmer" && !recipe.kinds.includes("wings")) {
      recipe.kinds.push("wings");
    }
    this.accents = createAuraAccents(def.color2, recipe);
    for (const a of this.accents) this.group.add(a.group);

    this.light = new THREE.PointLight(def.color, 0, 5.5, 2);
    this.light.position.set(0, 1.15, 0);
    this.group.add(this.light);

    this.group.name = `statusAura:${def.id}`;
    scene.add(this.group);
  }

  update(dt: number, center: THREE.Vector3) {
    this.age += dt;
    this.group.position.copy(center);

    const pulse = 0.88 + Math.sin(this.age * 3.8) * 0.12;
    tickAuraMaterial(this.shellMat, this.age, pulse);
    // Subtle shell breathe (extra to shader pulse)
    this.shell.scale.setScalar(1 + Math.sin(this.age * 2.1) * 0.025);

    this.ring.rotation.y += dt * 0.85;
    this.ring.scale.setScalar(1.5 * pulse);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.3 * pulse;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.1 * pulse;

    if (this.bubble) {
      const s = 1 + Math.sin(this.age * 2.4) * 0.06;
      this.bubble.scale.setScalar(s);
      this.bubble.rotation.y += dt * 0.4;
      (this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.08 * pulse;
    }

    this.light.intensity =
      1.5 + Math.sin(this.age * (this.def.style === "spark" ? 18 : 5)) * 1.0;

    for (const a of this.accents) a.update(dt, this.age);
  }

  dispose() {
    this.scene.remove(this.group);
    (this.ring.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    this.shellMat.dispose();
    this.shell.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    if (this.bubble) {
      this.bubble.geometry.dispose();
      (this.bubble.material as THREE.Material).dispose();
    }
    for (const a of this.accents) a.dispose();
    this.accents.length = 0;
  }
}

// ── Cast burst ───────────────────────────────────────────────────────────────

export interface CastAuraHandle {
  update(dt: number, center: THREE.Vector3): void;
  dispose(): void;
  readonly done: boolean;
}

export function createCastAura(
  scene: THREE.Scene,
  color: number,
  duration = 0.55,
): CastAuraHandle {
  const def: StatusDef = {
    id: "empowered",
    name: "Cast",
    kind: "buff",
    color,
    color2: 0xffffff,
    glyph: "✦",
    duration,
    style: "spark",
    shellOpacity: 0.55,
    pattern: "chargeGlow",
    expand: 0.12,
  };
  const aura = new StatusAura(scene, def);
  let remaining = duration;
  return {
    get done() {
      return remaining <= 0;
    },
    update(dt, center) {
      remaining -= dt;
      if (remaining > 0) aura.update(dt, center);
    },
    dispose() {
      aura.dispose();
    },
  };
}

/** Owns active-status timers + auras + HUD views. */
export class StatusController {
  private auras = new Map<StatusId, StatusAuraHandle[]>();
  private timers = new Map<StatusId, { remaining: number; duration: number }>();
  private anchors = new Map<StatusId, Array<(() => THREE.Vector3) | null>>();
  private makeAura: StatusAuraFactory;
  private castBursts: CastAuraHandle[] = [];
  private scene: THREE.Scene;
  private enableCastBurst: boolean;

  constructor(scene: THREE.Scene, makeAura?: StatusAuraFactory) {
    this.scene = scene;
    this.enableCastBurst = !makeAura;
    this.makeAura = makeAura ?? ((def) => new StatusAura(scene, def));
  }

  playCastBurst(color = 0xffe0a0, duration = 0.5, at?: THREE.Vector3) {
    if (!this.enableCastBurst) return;
    const handle = createCastAura(this.scene, color, duration);
    if (at) handle.update(0, at);
    this.castBursts.push(handle);
  }

  apply(id: StatusId, anchor?: () => THREE.Vector3) {
    this.applyAll(id, [anchor ?? null]);
  }

  applyAll(id: StatusId, anchors: Array<(() => THREE.Vector3) | null>) {
    const def = STATUS_DEFS[id];
    if (!def) return;
    const list = anchors.length > 0 ? anchors : [null];
    this.timers.set(id, { remaining: def.duration, duration: def.duration });
    this.anchors.set(id, list);
    const existing = this.auras.get(id) ?? [];
    for (let i = list.length; i < existing.length; i++) existing[i]!.dispose();
    const next: StatusAuraHandle[] = [];
    for (let i = 0; i < list.length; i++) next.push(existing[i] ?? this.makeAura(def));
    this.auras.set(id, next);
    this.playCastBurst(def.color, 0.35);
  }

  clear(id: StatusId) {
    this.timers.delete(id);
    this.anchors.delete(id);
    for (const a of this.auras.get(id) ?? []) a.dispose();
    this.auras.delete(id);
  }

  clearAll() {
    for (const id of [...this.timers.keys()]) this.clear(id);
    for (const b of this.castBursts) b.dispose();
    this.castBursts.length = 0;
  }

  get active(): boolean {
    return this.timers.size > 0;
  }

  update(dt: number, center: THREE.Vector3) {
    for (const [id, t] of this.timers) {
      t.remaining -= dt;
      if (t.remaining <= 0) {
        this.clear(id);
        continue;
      }
      const anchors = this.anchors.get(id);
      const auras = this.auras.get(id);
      if (!auras) continue;
      for (let i = 0; i < auras.length; i++) {
        const a = anchors?.[i];
        auras[i]!.update(dt, a ? a() : center);
      }
    }
    for (let i = this.castBursts.length - 1; i >= 0; i--) {
      const b = this.castBursts[i]!;
      b.update(dt, center);
      if (b.done) {
        b.dispose();
        this.castBursts.splice(i, 1);
      }
    }
  }

  views(): StatusView[] {
    const out: StatusView[] = [];
    for (const id of STATUS_IDS) {
      const t = this.timers.get(id);
      if (!t) continue;
      const def = STATUS_DEFS[id];
      out.push({
        id,
        name: def.name,
        kind: def.kind,
        color: `#${def.color.toString(16).padStart(6, "0")}`,
        glyph: def.glyph,
        remaining: t.remaining,
        duration: t.duration,
      });
    }
    return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "buff" ? -1 : 1));
  }

  dispose() {
    this.clearAll();
  }
}
