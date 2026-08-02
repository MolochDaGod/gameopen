/**
 * Production HTML overlay layer for Danger Room / Open.
 *
 * Implements threejs-html-overlays best practices:
 *  - CSS2DRenderer dual-rig (WebGL + CSS, same camera)
 *  - Root pointer-events:none; interactive chips opt-in auto
 *  - DOM pool for damage/heal floats (no create/delete per hit)
 *  - Distance cull for persistent labels
 *
 * Use for: popup damage/heal numbers, blood flashes, interact chips,
 * building plates, enter/exit/portal identifiers.
 */

import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import "./htmlOverlay.css";

export type FloatKind = "damage" | "heal" | "crit" | "block" | "miss" | "stamina";

export type WorldLabelKind =
  | "label"
  | "building"
  | "portal"
  | "enter"
  | "exit"
  | "npc"
  | "hostile"
  | "claim"
  | "interact";

export interface WorldLabelOpts {
  text: string;
  sub?: string;
  kind?: WorldLabelKind;
  /** Metres above the anchor point. */
  yOffset?: number;
  /** Max camera distance to show (default 28). */
  maxDist?: number;
  /** Interactive chip (E to enter, etc.) — pointer-events auto. */
  interactive?: boolean;
  /** Key badge e.g. "E". */
  keyHint?: string;
  onClick?: () => void;
}

interface FloatSlot {
  el: HTMLDivElement;
  obj: CSS2DObject;
  age: number;
  life: number;
  vy: number;
  active: boolean;
}

interface BloodSlot {
  el: HTMLDivElement;
  obj: CSS2DObject;
  age: number;
  life: number;
  active: boolean;
}

interface WorldLabel {
  id: string;
  el: HTMLDivElement;
  obj: CSS2DObject;
  kind: WorldLabelKind;
  maxDist: number;
  interactive: boolean;
  onClick?: () => void;
}

const FLOAT_POOL = 40;
const BLOOD_POOL = 16;

export class HtmlOverlaySystem {
  private renderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private container: HTMLElement;
  private root: HTMLDivElement;
  private group = new THREE.Group();

  private floats: FloatSlot[] = [];
  private bloods: BloodSlot[] = [];
  private labels = new Map<string, WorldLabel>();

  private tmp = new THREE.Vector3();
  private enabled = true;

  constructor(container: HTMLElement, scene: THREE.Scene, camera: THREE.Camera) {
    if (!camera) {
      throw new Error("HtmlOverlaySystem requires a THREE.Camera (was undefined — init order bug)");
    }
    this.container = container;
    this.scene = scene;
    this.camera = camera;

    // CSS2D host — absolute over WebGL canvas, click-through by default
    this.root = document.createElement("div");
    this.root.className = "gxo-root";
    this.root.setAttribute("aria-hidden", "true");

    this.renderer = new CSS2DRenderer({ element: this.root });
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.renderer.domElement.style.pointerEvents = "none";
    this.renderer.domElement.style.zIndex = "6";
    container.appendChild(this.renderer.domElement);

    this.group.name = "HtmlOverlaySystem";
    scene.add(this.group);

    this.seedFloatPool();
    this.seedBloodPool();

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.setSize(w, h);
  }

  setCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.renderer.domElement.style.display = on ? "block" : "none";
  }

  setSize(w: number, h: number) {
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h);
  }

  /** Call after WebGL render each frame. */
  render() {
    if (!this.enabled || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** Animate floats / blood / distance-cull labels. */
  update(dt: number) {
    if (!this.enabled || !this.camera) return;
    for (const f of this.floats) {
      if (!f.active) continue;
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        this.releaseFloat(f);
        continue;
      }
      // Rise + slight ease-out fade
      f.obj.position.y += f.vy * dt;
      const fade = t < 0.15 ? t / 0.15 : t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      f.el.style.opacity = String(Math.max(0, fade));
      const scale = f.el.classList.contains("kind-crit")
        ? 1 + (1 - t) * 0.25
        : 1 + (1 - t) * 0.08;
      f.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
    for (const b of this.bloods) {
      if (!b.active) continue;
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) {
        this.releaseBlood(b);
        continue;
      }
      const s = 0.5 + t * 1.4;
      const fade = 1 - t;
      b.el.style.opacity = String(Math.max(0, fade * 0.9));
      b.el.style.transform = `translate(-50%, -50%) scale(${s}) rotate(${t * 40}deg)`;
    }

    // Distance cull persistent labels
    this.camera.getWorldPosition(this.tmp);
    const cam = this.tmp.clone();
    for (const lab of this.labels.values()) {
      lab.obj.getWorldPosition(this.tmp);
      const d = this.tmp.distanceTo(cam);
      const show = d <= lab.maxDist;
      lab.obj.visible = show;
      if (show) {
        const fade = d > lab.maxDist * 0.75 ? 1 - (d - lab.maxDist * 0.75) / (lab.maxDist * 0.25) : 1;
        lab.el.style.opacity = String(Math.max(0.15, fade));
      }
    }
  }

  // ── Combat / heal floats ──────────────────────────────────────────

  /**
   * Spawn a rising number (or MISS/BLOCK text) at a world position.
   * Pooled — safe to call every hit frame.
   */
  floatNumber(
    worldPos: THREE.Vector3,
    amount: number,
    kind: FloatKind = "damage",
    opts?: { life?: number; yOffset?: number },
  ) {
    if (!this.enabled) return;
    const slot = this.acquireFloat();
    if (!slot) return;
    const life = opts?.life ?? (kind === "crit" ? 1.05 : 0.85);
    const yOff = opts?.yOffset ?? 0.35;
    slot.active = true;
    slot.age = 0;
    slot.life = life;
    slot.vy = kind === "crit" ? 1.35 : kind === "heal" ? 1.1 : 1.2;
    slot.obj.position.set(worldPos.x, worldPos.y + yOff, worldPos.z);
    slot.obj.visible = true;

    slot.el.className = `gxo-float is-live kind-${kind}`;
    if (kind === "block") slot.el.textContent = "BLOCK";
    else if (kind === "miss") slot.el.textContent = "MISS";
    else if (kind === "heal") slot.el.textContent = `+${Math.max(1, Math.round(amount))}`;
    else if (kind === "stamina") slot.el.textContent = `+${Math.max(1, Math.round(amount))} SP`;
    else if (kind === "crit") slot.el.textContent = String(Math.max(1, Math.round(amount)));
    else slot.el.textContent = String(Math.max(0, Math.round(amount)));
    slot.el.style.opacity = "1";
    slot.el.style.transform = "translate(-50%, -50%) scale(1)";
  }

  /** Convenience: damage or crit from DefensiveResult-like data. */
  floatDamage(worldPos: THREE.Vector3, damage: number, crit = false) {
    if (damage <= 0) {
      this.floatNumber(worldPos, 0, "miss");
      return;
    }
    this.floatNumber(worldPos, damage, crit ? "crit" : "damage");
    if (damage >= 8 || crit) this.bloodSplash(worldPos);
  }

  floatHeal(worldPos: THREE.Vector3, amount: number) {
    if (amount <= 0) return;
    this.floatNumber(worldPos, amount, "heal");
  }

  // ── Blood 2D flash ────────────────────────────────────────────────

  bloodSplash(worldPos: THREE.Vector3) {
    if (!this.enabled) return;
    const slot = this.acquireBlood();
    if (!slot) return;
    slot.active = true;
    slot.age = 0;
    slot.life = 0.42;
    slot.obj.position.copy(worldPos);
    slot.obj.position.y += 0.15;
    slot.obj.visible = true;
    slot.el.className = "gxo-blood is-live";
    slot.el.style.opacity = "0.92";
    slot.el.style.transform = "translate(-50%, -50%) scale(0.45)";
  }

  // ── Persistent world labels / interact chips ──────────────────────

  /**
   * Upsert a world-space label or interactive chip.
   * ids are stable (e.g. "building:barracks-1", "portal:dungeon", "claim-flag").
   */
  setWorldLabel(id: string, worldPos: THREE.Vector3, opts: WorldLabelOpts) {
    const kind = opts.kind ?? "label";
    const yOff = opts.yOffset ?? (opts.interactive ? 1.85 : 2.1);
    let entry = this.labels.get(id);
    if (!entry) {
      const el = document.createElement("div");
      const obj = new CSS2DObject(el);
      obj.center.set(0.5, 1);
      this.group.add(obj);
      entry = {
        id,
        el,
        obj,
        kind,
        maxDist: opts.maxDist ?? 28,
        interactive: !!opts.interactive,
        onClick: opts.onClick,
      };
      this.labels.set(id, entry);
    }
    entry.kind = kind;
    entry.maxDist = opts.maxDist ?? 28;
    entry.interactive = !!opts.interactive;
    entry.onClick = opts.onClick;
    entry.obj.position.set(worldPos.x, worldPos.y + yOff, worldPos.z);
    entry.obj.visible = true;

    if (opts.interactive || opts.keyHint) {
      entry.el.className = `gxo-chip kind-${kind}`;
      entry.el.style.pointerEvents = "auto";
      entry.el.innerHTML = "";
      if (opts.keyHint) {
        const key = document.createElement("span");
        key.className = "gxo-chip-key";
        key.textContent = opts.keyHint;
        entry.el.appendChild(key);
      }
      const txt = document.createElement("span");
      txt.textContent = opts.text;
      entry.el.appendChild(txt);
      entry.el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        entry!.onClick?.();
      };
    } else {
      entry.el.className = `gxo-label kind-${kind} gxo-fade`;
      entry.el.style.pointerEvents = "none";
      entry.el.onclick = null;
      entry.el.innerHTML = "";
      const title = document.createElement("span");
      title.className = "gxo-label-title";
      title.textContent = opts.text;
      entry.el.appendChild(title);
      if (opts.sub) {
        const sub = document.createElement("span");
        sub.className = "gxo-label-sub";
        sub.textContent = opts.sub;
        entry.el.appendChild(sub);
      }
    }
  }

  clearWorldLabel(id: string) {
    const entry = this.labels.get(id);
    if (!entry) return;
    this.group.remove(entry.obj);
    entry.el.remove();
    this.labels.delete(id);
  }

  clearWorldLabels(prefix?: string) {
    for (const id of [...this.labels.keys()]) {
      if (prefix && !id.startsWith(prefix)) continue;
      this.clearWorldLabel(id);
    }
  }

  /** Building nameplate (non-interactive). */
  setBuildingLabel(id: string, worldPos: THREE.Vector3, name: string, sub?: string) {
    this.setWorldLabel(`building:${id}`, worldPos, {
      text: name,
      sub,
      kind: "building",
      yOffset: 2.4,
      maxDist: 36,
    });
  }

  /** Enter / exit / portal chip. */
  setPortalChip(
    id: string,
    worldPos: THREE.Vector3,
    text: string,
    opts?: { kind?: "enter" | "exit" | "portal"; keyHint?: string; onClick?: () => void },
  ) {
    this.setWorldLabel(`portal:${id}`, worldPos, {
      text,
      kind: opts?.kind ?? "enter",
      keyHint: opts?.keyHint ?? "E",
      interactive: true,
      yOffset: 1.7,
      maxDist: 14,
      onClick: opts?.onClick,
    });
  }

  /** Interact chip (claim flag, workbench, door). */
  setInteractChip(
    id: string,
    worldPos: THREE.Vector3,
    text: string,
    opts?: { keyHint?: string; kind?: WorldLabelKind; onClick?: () => void },
  ) {
    this.setWorldLabel(`interact:${id}`, worldPos, {
      text,
      kind: opts?.kind ?? "interact",
      keyHint: opts?.keyHint ?? "E",
      interactive: true,
      yOffset: 1.65,
      maxDist: 12,
      onClick: opts?.onClick,
    });
  }

  clearInteractChip(id: string) {
    this.clearWorldLabel(`interact:${id}`);
  }

  dispose() {
    for (const f of this.floats) {
      this.group.remove(f.obj);
      f.el.remove();
    }
    for (const b of this.bloods) {
      this.group.remove(b.obj);
      b.el.remove();
    }
    this.clearWorldLabels();
    this.floats = [];
    this.bloods = [];
    this.scene.remove(this.group);
    this.renderer.domElement.remove();
  }

  // ── Pools ─────────────────────────────────────────────────────────

  private seedFloatPool() {
    for (let i = 0; i < FLOAT_POOL; i++) {
      const el = document.createElement("div");
      el.className = "gxo-float";
      el.style.opacity = "0";
      const obj = new CSS2DObject(el);
      obj.visible = false;
      obj.center.set(0.5, 0.5);
      this.group.add(obj);
      this.floats.push({ el, obj, age: 0, life: 1, vy: 1, active: false });
    }
  }

  private seedBloodPool() {
    for (let i = 0; i < BLOOD_POOL; i++) {
      const el = document.createElement("div");
      el.className = "gxo-blood";
      el.style.opacity = "0";
      const obj = new CSS2DObject(el);
      obj.visible = false;
      obj.center.set(0.5, 0.5);
      this.group.add(obj);
      this.bloods.push({ el, obj, age: 0, life: 0.4, active: false });
    }
  }

  private acquireFloat(): FloatSlot | null {
    for (const f of this.floats) if (!f.active) return f;
    // Steal oldest
    let oldest = this.floats[0]!;
    for (const f of this.floats) if (f.age > oldest.age) oldest = f;
    this.releaseFloat(oldest);
    oldest.active = false;
    return oldest;
  }

  private releaseFloat(f: FloatSlot) {
    f.active = false;
    f.obj.visible = false;
    f.el.className = "gxo-float";
    f.el.style.opacity = "0";
    f.el.textContent = "";
  }

  private acquireBlood(): BloodSlot | null {
    for (const b of this.bloods) if (!b.active) return b;
    let oldest = this.bloods[0]!;
    for (const b of this.bloods) if (b.age > oldest.age) oldest = b;
    this.releaseBlood(oldest);
    return oldest;
  }

  private releaseBlood(b: BloodSlot) {
    b.active = false;
    b.obj.visible = false;
    b.el.className = "gxo-blood";
    b.el.style.opacity = "0";
  }
}
