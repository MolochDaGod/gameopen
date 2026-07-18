import * as THREE from "three";
import type { StatusId, StatusKind, StatusView } from "../types";
import { runeRingTexture, softDiscTexture, unitGroundPlane } from "./fxTextures";

/**
 * Status-effect VFX — body auras for buffs / debuffs / auras.
 *
 * Visual language (itch-style status pack reference):
 *  - translucent **body shell** (capsule + head) tinted per status
 *  - **swirl ribbons** / energy rings around the torso
 *  - ground rune footprint + soft disc
 *  - style-driven particles: rise / orbit / spark / bubble / vortex / sleep
 *  - pulsing point light
 *
 * Procedural three.js only (no external GLB required). CC0-inspired timing from
 * BinbunVFX Vol.2; silhouette read matches commercial aura GIF packs.
 */

type AuraStyle = "rise" | "orbit" | "spark" | "bubble" | "vortex" | "sleep";

export interface StatusDef {
  id: StatusId;
  name: string;
  kind: StatusKind;
  /** Core color (hex). */
  color: number;
  /** Highlight color particles fade toward (hex). */
  color2: number;
  /** Non-emoji symbol glyph shown on the notifier chip. */
  glyph: string;
  /** Seconds the status lasts when applied. */
  duration: number;
  style: AuraStyle;
  /** Body shell opacity peak (0–1). */
  shellOpacity?: number;
  /** Particle count override. */
  particleCount?: number;
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
    shellOpacity: 0.38,
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
    shellOpacity: 0.42,
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
    shellOpacity: 0.34,
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
    shellOpacity: 0.4,
  },
  regen: {
    id: "regen",
    name: "Regen",
    kind: "buff",
    color: 0x6affa0,
    color2: 0xe0ffec,
    glyph: "✚",
    duration: 8,
    style: "rise",
    shellOpacity: 0.28,
  },
  empowered: {
    id: "empowered",
    name: "Empowered",
    kind: "buff",
    color: 0xffc24a,
    color2: 0xfff0c0,
    glyph: "✦",
    duration: 8,
    style: "rise",
    shellOpacity: 0.36,
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
    shellOpacity: 0.22,
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
    shellOpacity: 0.3,
  },
  blessed: {
    id: "blessed",
    name: "Blessed",
    kind: "buff",
    color: 0xfff6c8,
    color2: 0xffffff,
    glyph: "✧",
    duration: 10,
    style: "spark",
    shellOpacity: 0.32,
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
    shellOpacity: 0.4,
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
    shellOpacity: 0.2,
    particleCount: 12,
  },
  absorb: {
    id: "absorb",
    name: "Absorb",
    kind: "buff",
    color: 0xd060ff,
    color2: 0xffc0ff,
    glyph: "◎",
    duration: 9,
    style: "bubble",
    shellOpacity: 0.35,
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
    shellOpacity: 0.45,
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
    shellOpacity: 0.3,
  },
};

export const STATUS_IDS = Object.keys(STATUS_DEFS) as StatusId[];

/** CSS hex string for a status' core color (for HUD chips / dock buttons). */
export function statusCss(id: StatusId): string {
  return "#" + STATUS_DEFS[id].color.toString(16).padStart(6, "0");
}

/** Lightweight catalog the tap-to-apply dock renders (no THREE objects). */
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

/** Shared soft round sprite for additive glow particles (module-lived). */
let SOFT_TEX: THREE.Texture | null = null;
function softTexture(): THREE.Texture {
  if (SOFT_TEX) return SOFT_TEX;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.65)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  SOFT_TEX = tex;
  return tex;
}

/** Soft vertical gradient for body shell (head brighter). */
let SHELL_TEX: THREE.Texture | null = null;
function shellTexture(): THREE.Texture {
  if (SHELL_TEX) return SHELL_TEX;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.75, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0.08)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 128);
  // soft side falloff
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, "rgba(0,0,0,0.55)");
  side.addColorStop(0.5, "rgba(0,0,0,0)");
  side.addColorStop(1, "rgba(0,0,0,0.55)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 128);
  g.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  SHELL_TEX = tex;
  return tex;
}

/**
 * The slice of an aura the {@link StatusController} actually drives each frame.
 */
export interface StatusAuraHandle {
  update(dt: number, center: THREE.Vector3): void;
  dispose(): void;
}

export type StatusAuraFactory = (def: StatusDef) => StatusAuraHandle;

class StatusAura implements StatusAuraHandle {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private glow: THREE.Mesh;
  private shell: THREE.Group;
  private ribbons: THREE.Mesh[] = [];
  private bubble: THREE.Mesh | null = null;
  private light: THREE.PointLight;
  private points: THREE.Points;
  private geom: THREE.BufferGeometry;
  private pos: Float32Array;
  private col: Float32Array;
  private alpha: Float32Array;
  private count: number;
  private life: Float32Array;
  private max: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private ang: Float32Array;
  private rad: Float32Array;
  private base: Float32Array;
  private age = 0;
  private cBase = new THREE.Color();
  private cHi = new THREE.Color();
  private shellMats: THREE.MeshBasicMaterial[] = [];

  constructor(
    private scene: THREE.Scene,
    private def: StatusDef,
  ) {
    this.cBase.setHex(def.color);
    this.cHi.setHex(def.color2);
    this.count = def.particleCount ?? (def.style === "spark" ? 56 : def.style === "sleep" ? 14 : 48);
    this.life = new Float32Array(this.count);
    this.max = new Float32Array(this.count);
    this.vx = new Float32Array(this.count);
    this.vy = new Float32Array(this.count);
    this.vz = new Float32Array(this.count);
    this.ang = new Float32Array(this.count);
    this.rad = new Float32Array(this.count);
    this.base = new Float32Array(this.count);

    // Ground rune footprint
    const ringMat = new THREE.MeshBasicMaterial({
      color: def.color,
      map: runeRingTexture(),
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(unitGroundPlane(), ringMat);
    this.ring.scale.setScalar(1.45);
    this.ring.position.y = 0.03;
    this.group.add(this.ring);

    const glowMat = new THREE.MeshBasicMaterial({
      color: def.color,
      map: softDiscTexture(),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glow = new THREE.Mesh(unitGroundPlane(), glowMat);
    this.glow.scale.setScalar(1.25);
    this.glow.position.y = 0.02;
    this.group.add(this.glow);

    // ── Body shell (itch pack silhouette read) ─────────────────────────────
    this.shell = new THREE.Group();
    this.shell.name = `statusShell:${def.id}`;
    const shellOp = def.shellOpacity ?? 0.32;
    const bodyMat = new THREE.MeshBasicMaterial({
      color: def.color,
      map: shellTexture(),
      transparent: true,
      opacity: shellOp,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.shellMats.push(bodyMat);
    // Torso capsule (approx humanoid 1.6m)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.85, 6, 12), bodyMat);
    body.position.y = 0.95;
    this.shell.add(body);
    // Head
    const headMat = bodyMat.clone();
    headMat.opacity = shellOp * 1.15;
    this.shellMats.push(headMat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), headMat);
    head.position.y = 1.72;
    this.shell.add(head);
    // Soft outer rim (larger translucent shell)
    const rimMat = new THREE.MeshBasicMaterial({
      color: def.color2,
      transparent: true,
      opacity: shellOp * 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      wireframe: false,
    });
    this.shellMats.push(rimMat);
    const rim = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 4, 10), rimMat);
    rim.position.y = 0.95;
    this.shell.add(rim);
    this.group.add(this.shell);

    // ── Swirl ribbons (energy loops) ───────────────────────────────────────
    const ribbonCount = def.style === "bubble" || def.style === "sleep" ? 1 : 3;
    for (let i = 0; i < ribbonCount; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? def.color : def.color2,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.shellMats.push(rMat);
      // Thin torus as energy ribbon
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.55 + i * 0.12, 0.018, 6, 48),
        rMat,
      );
      torus.position.y = 0.7 + i * 0.35;
      torus.rotation.x = Math.PI / 2 + (i - 1) * 0.25;
      torus.rotation.z = i * 0.6;
      this.ribbons.push(torus);
      this.group.add(torus);
    }

    // ── Bubble / shield sphere ─────────────────────────────────────────────
    if (def.style === "bubble") {
      const bMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        wireframe: false,
      });
      this.shellMats.push(bMat);
      this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), bMat);
      this.bubble.position.y = 1.0;
      this.group.add(this.bubble);
      // wireframe accent
      const wMat = new THREE.MeshBasicMaterial({
        color: def.color2,
        transparent: true,
        opacity: 0.28,
        wireframe: true,
        depthWrite: false,
      });
      this.shellMats.push(wMat);
      const wire = new THREE.Mesh(new THREE.SphereGeometry(1.08, 12, 8), wMat);
      wire.position.y = 1.0;
      this.group.add(wire);
      this.ribbons.push(wire);
    }

    // Pulsing colored light
    this.light = new THREE.PointLight(def.color, 0, 5.5, 2);
    this.light.position.set(0, 1.2, 0);
    this.group.add(this.light);

    // Particle field
    this.geom = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.count * 3);
    this.col = new Float32Array(this.count * 3);
    this.alpha = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) this.spawn(i, true);
    this.geom.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geom.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.geom.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.PointsMaterial({
      size: this.def.style === "spark" ? 0.14 : this.def.style === "sleep" ? 0.28 : 0.2,
      map: softTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aAlpha;\nvarying float vAlpha;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAlpha = aAlpha;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vAlpha;")
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          "vec4 diffuseColor = vec4( diffuse * vAlpha, opacity );",
        );
    };
    this.points = new THREE.Points(this.geom, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    scene.add(this.group);
  }

  private spawn(i: number, initial = false) {
    const s = this.def.style;
    const a = Math.random() * Math.PI * 2;
    this.ang[i] = a;
    if (s === "rise" || s === "vortex") {
      const r = 0.15 + Math.random() * (s === "vortex" ? 0.55 : 0.38);
      this.rad[i] = r;
      this.pos[i * 3] = Math.cos(a) * r;
      this.pos[i * 3 + 1] = initial ? Math.random() * 1.7 : 0.05 + Math.random() * 0.12;
      this.pos[i * 3 + 2] = Math.sin(a) * r;
      this.vy[i] = s === "vortex" ? 0.35 + Math.random() * 0.7 : 0.7 + Math.random() * 1.1;
      this.vx[i] = (Math.random() - 0.5) * 0.25;
      this.vz[i] = (Math.random() - 0.5) * 0.25;
      this.max[i] = 1.0 + Math.random() * 1.0;
    } else if (s === "orbit") {
      const r = 0.48 + Math.random() * 0.22;
      this.rad[i] = r;
      this.base[i] = 0.2 + Math.random() * 1.4;
      this.pos[i * 3] = Math.cos(a) * r;
      this.pos[i * 3 + 1] = this.base[i];
      this.pos[i * 3 + 2] = Math.sin(a) * r;
      this.vy[i] = 0.55 + Math.random() * 0.9;
      this.max[i] = 2 + Math.random() * 2;
    } else if (s === "bubble") {
      // Particles crawl on bubble surface
      const r = 0.95 + Math.random() * 0.12;
      this.rad[i] = r;
      this.base[i] = Math.acos(2 * Math.random() - 1); // polar
      this.ang[i] = a;
      this.pos[i * 3] = Math.sin(this.base[i]) * Math.cos(a) * r;
      this.pos[i * 3 + 1] = 1.0 + Math.cos(this.base[i]) * r;
      this.pos[i * 3 + 2] = Math.sin(this.base[i]) * Math.sin(a) * r;
      this.vy[i] = 0.8 + Math.random() * 1.2;
      this.max[i] = 2.5 + Math.random() * 2;
    } else if (s === "sleep") {
      // Rising Z-like puffs above head
      this.rad[i] = 0.1 + Math.random() * 0.2;
      this.pos[i * 3] = (Math.random() - 0.5) * 0.3;
      this.pos[i * 3 + 1] = 1.7 + Math.random() * 0.3;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      this.vy[i] = 0.25 + Math.random() * 0.35;
      this.vx[i] = 0.15 + Math.random() * 0.2;
      this.max[i] = 1.8 + Math.random() * 1.2;
    } else {
      // spark
      const r = Math.random() * 0.55;
      this.rad[i] = r;
      this.pos[i * 3] = Math.cos(a) * r;
      this.pos[i * 3 + 1] = 0.35 + Math.random() * 1.4;
      this.pos[i * 3 + 2] = Math.sin(a) * r;
      this.vx[i] = (Math.random() - 0.5) * 2.8;
      this.vy[i] = (Math.random() - 0.5) * 2.8;
      this.vz[i] = (Math.random() - 0.5) * 2.8;
      this.max[i] = 0.12 + Math.random() * 0.32;
    }
    this.life[i] = initial ? Math.random() * this.max[i] : 0;
  }

  update(dt: number, center: THREE.Vector3) {
    this.age += dt;
    this.group.position.copy(center);

    const pulse = 0.88 + Math.sin(this.age * 3.6) * 0.12;
    const breathe = 1 + Math.sin(this.age * 2.2) * 0.04;

    // Ground
    this.ring.rotation.y += dt * 0.85;
    this.ring.scale.setScalar(1.45 * pulse);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.48 + 0.28 * pulse;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.1 * pulse;

    // Body shell pulse
    this.shell.scale.setScalar(breathe);
    for (const m of this.shellMats) {
      if (m.map === shellTexture() || m.map) {
        // keep relative opacities via userData not available — soft pulse all
      }
    }
    // pulse first shell mat (body)
    if (this.shellMats[0]) {
      this.shellMats[0].opacity =
        (this.def.shellOpacity ?? 0.32) * (0.85 + 0.2 * Math.sin(this.age * 5));
    }

    // Ribbons spin
    for (let i = 0; i < this.ribbons.length; i++) {
      const r = this.ribbons[i]!;
      r.rotation.z += dt * (1.2 + i * 0.4) * (i % 2 === 0 ? 1 : -1);
      r.rotation.y += dt * 0.6;
      const mat = r.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + 0.22 * Math.sin(this.age * 4 + i);
    }

    // Bubble breathe
    if (this.bubble) {
      const s = 1 + Math.sin(this.age * 2.5) * 0.06;
      this.bubble.scale.setScalar(s);
      this.bubble.rotation.y += dt * 0.35;
      (this.bubble.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.08 * pulse;
    }

    this.light.intensity =
      1.4 + Math.sin(this.age * (this.def.style === "spark" ? 20 : 5.5)) * 1.1;

    const s = this.def.style;
    for (let i = 0; i < this.count; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        this.spawn(i);
        continue;
      }
      const t = this.life[i] / this.max[i];
      const ix = i * 3;
      if (s === "rise") {
        this.pos[ix] += this.vx[i] * dt;
        this.pos[ix + 1] += this.vy[i] * dt;
        this.pos[ix + 2] += this.vz[i] * dt;
        const sw = dt * 1.6;
        const cx = this.pos[ix],
          cz = this.pos[ix + 2];
        this.pos[ix] = cx * Math.cos(sw) - cz * Math.sin(sw);
        this.pos[ix + 2] = cx * Math.sin(sw) + cz * Math.cos(sw);
      } else if (s === "vortex") {
        this.ang[i] += dt * (2.2 + this.vy[i]);
        const r = this.rad[i] * (1 - t * 0.35);
        this.pos[ix] = Math.cos(this.ang[i]) * r;
        this.pos[ix + 2] = Math.sin(this.ang[i]) * r;
        this.pos[ix + 1] += this.vy[i] * dt * 0.6;
      } else if (s === "orbit") {
        this.ang[i] += this.vy[i] * dt;
        this.pos[ix] = Math.cos(this.ang[i]) * this.rad[i];
        this.pos[ix + 2] = Math.sin(this.ang[i]) * this.rad[i];
        this.pos[ix + 1] = this.base[i] + Math.sin(this.age * 2 + i) * 0.12;
      } else if (s === "bubble") {
        this.ang[i] += this.vy[i] * dt * 0.5;
        const th = this.base[i];
        const r = this.rad[i];
        this.pos[ix] = Math.sin(th) * Math.cos(this.ang[i]) * r;
        this.pos[ix + 1] = 1.0 + Math.cos(th) * r;
        this.pos[ix + 2] = Math.sin(th) * Math.sin(this.ang[i]) * r;
      } else if (s === "sleep") {
        this.pos[ix] += this.vx[i] * dt;
        this.pos[ix + 1] += this.vy[i] * dt;
        this.pos[ix + 2] += Math.sin(this.age * 2 + i) * dt * 0.1;
      } else {
        this.pos[ix] += this.vx[i] * dt;
        this.pos[ix + 1] += this.vy[i] * dt;
        this.pos[ix + 2] += this.vz[i] * dt;
      }
      const c = this.cHi.clone().lerp(this.cBase, t);
      this.col[ix] = c.r;
      this.col[ix + 1] = c.g;
      this.col[ix + 2] = c.b;
      const fade =
        s === "spark" ? 1 - t : s === "sleep" ? Math.sin(Math.min(1, t) * Math.PI) : Math.sin(Math.min(1, t) * Math.PI);
      this.alpha[i] = Math.max(0, fade);
    }
    (this.geom.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geom.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    (this.geom.getAttribute("aAlpha") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.group);
    (this.ring.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    for (const m of this.shellMats) m.dispose();
    this.shell.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
    });
    for (const r of this.ribbons) {
      r.geometry.dispose();
    }
    if (this.bubble) this.bubble.geometry.dispose();
    this.geom.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// ── Short cast / charge-up aura (skill wind-up tell) ─────────────────────────

export interface CastAuraHandle {
  update(dt: number, center: THREE.Vector3): void;
  dispose(): void;
  readonly done: boolean;
}

/**
 * Brief charge-up aura at cast start — same visual language as status shells,
 * shorter lifetime. Used for skill wind-ups and status apply flash.
 */
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
    shellOpacity: 0.4,
    particleCount: 36,
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

/** Owns active-status timers + their auras and exposes notifier views. */
export class StatusController {
  private auras = new Map<StatusId, StatusAuraHandle[]>();
  private timers = new Map<StatusId, { remaining: number; duration: number }>();
  private anchors = new Map<StatusId, Array<(() => THREE.Vector3) | null>>();
  private makeAura: StatusAuraFactory;
  private castBursts: CastAuraHandle[] = [];
  private scene: THREE.Scene;
  /** False when tests inject a WebGL-free factory (no canvas cast bursts). */
  private enableCastBurst: boolean;

  constructor(scene: THREE.Scene, makeAura?: StatusAuraFactory) {
    this.scene = scene;
    this.enableCastBurst = !makeAura;
    this.makeAura = makeAura ?? ((def) => new StatusAura(scene, def));
  }

  /**
   * Flash a short cast/charge aura (skill wind-up or status apply punch).
   * Color defaults to white-gold when omitted.
   */
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
    // Apply flash at first anchor
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
    // Cast bursts
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
