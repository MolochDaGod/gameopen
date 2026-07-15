/**
 * Loadout mesh stage — Three.js character + weapon hand mounts for the TI-style
 * equipment paperdoll center. Uses the same Character + Weapons stack as Danger Room.
 *
 * Ownership:
 *   Character (GLB + mixer) → hand bones
 *   mountWeaponModel → main / off-hand meshes on those bones
 *   idle loco + slow yaw turn for showcase
 */
import * as THREE from "three";
import { Character } from "../Character";
import { getCharacter, getWeapon, raceCharacterIdForFleetRace } from "../assets";
import { offHandEligible } from "../arsenal";
import {
  mountWeaponModel,
  unmountWeapon,
  type MountedWeapon,
} from "../Weapons";
import type { WeaponId } from "../types";

export type LoadoutPreviewRace =
  | "human"
  | "barbarian"
  | "dwarf"
  | "elf"
  | "orc"
  | "undead";

const RACE_TO_CHAR: Record<LoadoutPreviewRace, string> = {
  human: "race-human",
  barbarian: "race-barbarian",
  dwarf: "race-dwarf",
  elf: "race-high-elf",
  orc: "race-orc",
  undead: "race-undead",
};

/** Fallback rigs with baked clips if race GLB fails. */
const FALLBACK_CHARS = ["karate-boss", "orc", "sanji"] as const;

export class LoadoutMeshPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro?: ResizeObserver;

  private character: Character | null = null;
  private mountedMain: MountedWeapon | null = null;
  private mountedOff: MountedWeapon | null = null;
  private loadGen = 0;

  private weaponId: WeaponId = "sword";
  private offHandId: WeaponId | null = null;
  private race: LoadoutPreviewRace = "human";
  private yaw = 0;
  private dragX = 0;
  private dragging = false;

  private canvas: HTMLCanvasElement;
  private statusEl: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement, statusEl?: HTMLElement | null) {
    this.canvas = canvas;
    this.statusEl = statusEl ?? null;

    const w = Math.max(2, canvas.clientWidth || 240);
    const h = Math.max(2, canvas.clientHeight || 320);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.05, 40);
    this.camera.position.set(0, 1.35, 3.4);
    this.camera.lookAt(0, 0.95, 0);

    this.scene.fog = new THREE.FogExp2(0x0c0a09, 0.045);
    this.buildLights();
    this.buildGround();
    this.scene.add(this.root);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointermove", this.onPointerMove);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);

    this.raf = requestAnimationFrame(this.tick);
    void this.reloadCharacter();
  }

  private setStatus(msg: string) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffe8c8, 0x1a120c, 0.55));
    const key = new THREE.DirectionalLight(0xfff1d8, 1.45);
    key.position.set(2.2, 4.5, 2.8);
    key.castShadow = false;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc4a574, 0.55);
    rim.position.set(-2.5, 2.2, -1.5);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xffaa55, 0.35, 8);
    fill.position.set(0, 1.2, 1.5);
    this.scene.add(fill);
  }

  private buildGround() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 48),
      new THREE.MeshBasicMaterial({
        color: 0xb45309,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        roughness: 0.95,
        metalness: 0.05,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    this.scene.add(disc);
  }

  setRace(race: LoadoutPreviewRace) {
    if (this.race === race) return;
    this.race = race;
    void this.reloadCharacter();
  }

  setWeapons(main: WeaponId, off: WeaponId | null) {
    this.weaponId = main;
    this.offHandId = off;
    void this.remountWeapons();
  }

  private async reloadCharacter() {
    const gen = ++this.loadGen;
    this.setStatus("Loading mesh…");
    this.clearCharacter();

    const primary = RACE_TO_CHAR[this.race] ?? "race-human";
    const order = [primary, ...FALLBACK_CHARS.filter((id) => id !== primary)];

    for (const id of order) {
      if (this.disposed || gen !== this.loadGen) return;
      try {
        const def = getCharacter(id);
        if (!def?.file && id.startsWith("race-")) {
          // empty file defs skip; race entries have files
        }
        if (!def?.file) continue;
        const av = new Character(def);
        await av.load();
        if (this.disposed || gen !== this.loadGen) {
          av.dispose();
          return;
        }
        this.character = av;
        // Ground + fit: Character already normalizes height; place feet on disc
        av.root.position.set(0, 0, 0);
        av.root.rotation.y = 0;
        this.root.add(av.root);
        av.setLocomotion?.(0);
        av.playRole?.("idle", 0.15);
        this.setStatus("");
        await this.remountWeapons();
        return;
      } catch (err) {
        console.warn("[LoadoutMeshPreview] character failed:", id, err);
      }
    }
    this.setStatus("Mesh unavailable");
  }

  private async remountWeapons() {
    const ch = this.character;
    if (!ch) return;
    const rh = ch.rightHand;
    const lh = ch.leftHand;
    if (!rh || !lh) {
      // No hand bones — still show character without weapons
      return;
    }

    if (this.mountedMain) {
      unmountWeapon(this.mountedMain);
      this.mountedMain = null;
    }
    if (this.mountedOff) {
      unmountWeapon(this.mountedOff);
      this.mountedOff = null;
    }

    try {
      const mainDef = getWeapon(this.weaponId);
      this.mountedMain = await mountWeaponModel(mainDef, rh, lh);
    } catch (err) {
      console.warn("[LoadoutMeshPreview] main weapon failed", err);
    }

    if (
      this.offHandId &&
      this.offHandId !== "none" &&
      offHandEligible(this.weaponId)
    ) {
      try {
        // Same path as Studio.applyOffHandAsync — def.hand routes to left bone
        this.mountedOff = await mountWeaponModel(getWeapon(this.offHandId), rh, lh);
      } catch (err) {
        console.warn("[LoadoutMeshPreview] off-hand failed", err);
      }
    }
  }

  private clearCharacter() {
    if (this.mountedMain) {
      unmountWeapon(this.mountedMain);
      this.mountedMain = null;
    }
    if (this.mountedOff) {
      unmountWeapon(this.mountedOff);
      this.mountedOff = null;
    }
    if (this.character) {
      this.character.root.removeFromParent();
      this.character.dispose();
      this.character = null;
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.dragX = e.clientX;
    this.canvas.setPointerCapture?.(e.pointerId);
  };
  private onPointerUp = (e: PointerEvent) => {
    this.dragging = false;
    try {
      this.canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.dragX;
    this.dragX = e.clientX;
    this.yaw += dx * 0.01;
  };

  private resize() {
    const w = Math.max(2, this.canvas.clientWidth || 1);
    const h = Math.max(2, this.canvas.clientHeight || 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private tick = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Slow showcase spin when not dragging
    if (!this.dragging) this.yaw += dt * 0.35;
    this.root.rotation.y = this.yaw;

    if (this.character) {
      this.character.setLocomotion?.(0);
      this.character.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.clearCharacter();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}

export function loadoutRaceToPreview(race?: string | null): LoadoutPreviewRace {
  const id = raceCharacterIdForFleetRace(race ?? undefined);
  if (id === "race-orc") return "orc";
  if (id === "race-high-elf") return "elf";
  if (id === "race-dwarf") return "dwarf";
  if (id === "race-barbarian") return "barbarian";
  if (id === "race-undead") return "undead";
  return "human";
}
