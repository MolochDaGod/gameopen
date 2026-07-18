/**
 * Three.js migration: dwarf main city + elf town on floating islands
 * above the fabledzone great tree island, connected by portals.
 *
 * Loads platform + town GLBs, builds portal rings, teleports player on interact.
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import {
  SKY_SITES,
  SKY_PORTALS,
  type SkyPortalLink,
  type SkySiteDef,
  type SkyTownId,
} from "../../game/factionTowns/skyTowns";

export type FabledSkyCallbacks = {
  flash?: (msg: string, t?: number) => void;
  /** Teleport player feet to world position */
  teleportPlayer?: (pos: THREE.Vector3, yaw?: number) => void;
};

type LivePortal = {
  link: SkyPortalLink;
  mesh: THREE.Mesh;
  worldPos: THREE.Vector3;
  destWorld: THREE.Vector3;
  cooldown: number;
};

type LiveSite = {
  def: SkySiteDef;
  root: THREE.Group;
  origin: THREE.Vector3;
};

function fitObject(
  obj: THREE.Object3D,
  opts: { targetHeight?: number; targetDiameter?: number; ground?: boolean },
): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  if (opts.ground !== false) obj.position.y -= box.min.y;

  let s = 1;
  if (opts.targetHeight && size.y > 1e-4) {
    s = opts.targetHeight / size.y;
  }
  if (opts.targetDiameter) {
    const diam = Math.max(size.x, size.z);
    if (diam > 1e-4) {
      const sd = opts.targetDiameter / diam;
      s = opts.targetHeight ? Math.min(s, sd) : sd;
    }
  }
  if (s !== 1 && Number.isFinite(s)) {
    obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true);
    if (opts.ground !== false) {
      const box2 = new THREE.Box3().setFromObject(obj);
      obj.position.y -= box2.min.y;
    }
  }
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function makePortalMesh(radius: number, color: number): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, radius * 0.12, 12, 32);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    metalness: 0.2,
    roughness: 0.35,
    transparent: true,
    opacity: 0.92,
  });
  const ring = new THREE.Mesh(geo, mat);
  // Fill disc
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.88, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  disc.position.z = 0.02;
  ring.add(disc);
  // Soft vertical spin axis for billboard-ish readability
  ring.rotation.x = Math.PI / 2;
  return ring;
}

export class FabledSkyTowns {
  readonly group = new THREE.Group();
  private sites = new Map<SkyTownId, LiveSite>();
  private portals: LivePortal[] = [];
  private readonly cbs: FabledSkyCallbacks;
  private readonly scene: THREE.Scene;
  private loaded = false;
  private spinT = 0;
  private interactRadius = 2.4;

  constructor(scene: THREE.Scene, cbs: FabledSkyCallbacks = {}) {
    this.scene = scene;
    this.cbs = cbs;
    this.group.name = "FabledSkyTowns";
    scene.add(this.group);
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  clear() {
    while (this.group.children.length) this.group.remove(this.group.children[0]!);
    this.sites.clear();
    this.portals = [];
    this.loaded = false;
  }

  /**
   * Load floating platforms + towns + portals.
   * Call after fabledzone terrain is in the scene (or alone for sky-only sandbox).
   */
  async load(): Promise<boolean> {
    this.clear();
    try {
      for (const def of SKY_SITES) {
        if (def.id === "tree-island-ground") {
          const root = new THREE.Group();
          root.name = def.id;
          root.position.set(def.world.x, def.world.y, def.world.z);
          this.group.add(root);
          this.sites.set(def.id, {
            def,
            root,
            origin: root.position.clone(),
          });
          continue;
        }
        await this.loadSite(def);
      }
      this.buildPortals();
      this.loaded = true;
      this.cbs.flash?.(
        "SKY TOWNS · Dwarf City + Elf Town above Great Tree · portals linked",
        2.2,
      );
      return true;
    } catch (err) {
      console.warn("[FabledSkyTowns] load failed", err);
      this.cbs.flash?.("Sky towns partial load — check models/worlds/sky/*", 2);
      // Still mark loaded if we got procedural platforms
      this.loaded = this.sites.size > 0;
      return this.loaded;
    }
  }

  private async loadSite(def: SkySiteDef) {
    const root = new THREE.Group();
    root.name = def.id;
    root.position.set(def.world.x, def.world.y, def.world.z);
    root.rotation.y = (def.yawDeg * Math.PI) / 180;

    // Platform
    let platformOk = false;
    if (def.platformMeshKeys.length) {
      try {
        const { scene } = await loadGltfFirst(def.platformMeshKeys, sharedGltfLoader(), {
          prepMaterials: true,
        });
        fitObject(scene, {
          targetDiameter: def.platformDiameterM,
          targetHeight: def.platformDiameterM * 0.35,
        });
        scene.name = `${def.id}:platform`;
        root.add(scene);
        platformOk = true;
      } catch (e) {
        console.warn("[FabledSkyTowns] platform missing", def.id, e);
      }
    }
    if (!platformOk) {
      root.add(this.proceduralPlatform(def.platformDiameterM, def.faction));
    }

    // Town mesh on top of platform
    let townOk = false;
    if (def.townMeshKeys.length) {
      try {
        const { scene } = await loadGltfFirst(def.townMeshKeys, sharedGltfLoader(), {
          prepMaterials: true,
        });
        fitObject(scene, {
          targetHeight: def.townHeightM,
          targetDiameter: def.platformDiameterM * 0.72,
        });
        // Lift slightly onto platform deck
        scene.position.y += 0.4;
        scene.name = `${def.id}:town`;
        root.add(scene);
        townOk = true;
      } catch (e) {
        console.warn("[FabledSkyTowns] town mesh missing", def.id, e);
      }
    }
    if (!townOk) {
      root.add(this.proceduralTown(def));
    }

    // Ambient race markers (simple capsules until full NPC system attaches)
    root.add(this.ambientNpcs(def));

    this.group.add(root);
    this.sites.set(def.id, {
      def,
      root,
      origin: root.position.clone(),
    });
  }

  private proceduralPlatform(diameter: number, faction: string): THREE.Group {
    const g = new THREE.Group();
    g.name = "proc-platform";
    const r = diameter * 0.5;
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.92, 1.2, 24),
      new THREE.MeshStandardMaterial({
        color: faction === "dwarf" ? 0x6a5a48 : 0x4a6a58,
        roughness: 0.9,
      }),
    );
    top.position.y = 0.6;
    top.receiveShadow = true;
    top.castShadow = true;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.85, diameter * 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 }),
    );
    rock.position.y = -diameter * 0.2;
    rock.rotation.x = Math.PI;
    rock.castShadow = true;
    g.add(top, rock);
    return g;
  }

  private proceduralTown(def: SkySiteDef): THREE.Group {
    const g = new THREE.Group();
    g.name = "proc-town";
    const color = def.faction === "dwarf" ? 0x8a7a60 : 0x70a888;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 4 + (i % 3);
      const h = 2.5 + (i % 4) * 0.7;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, h, 1.6),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
      b.position.set(Math.cos(a) * r, h * 0.5 + 0.5, Math.sin(a) * r);
      b.castShadow = true;
      g.add(b);
    }
    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(4, 3.2, 4),
      new THREE.MeshStandardMaterial({
        color: def.faction === "dwarf" ? 0xb0a080 : 0x90d0b0,
        roughness: 0.7,
      }),
    );
    hall.position.y = 2.1;
    hall.castShadow = true;
    g.add(hall);
    return g;
  }

  private ambientNpcs(def: SkySiteDef): THREE.Group {
    const g = new THREE.Group();
    g.name = "ambient-npcs";
    const n = def.faction === "dwarf" ? 5 : 4;
    const tint = def.faction === "dwarf" ? 0xc4a574 : 0xa0e0c0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.75, 4, 8),
        new THREE.MeshStandardMaterial({ color: tint, roughness: 0.6 }),
      );
      body.position.set(Math.cos(a) * 5.5, 1.15, Math.sin(a) * 5.5);
      body.castShadow = true;
      body.userData.skyNpc = true;
      body.userData.raceId = def.ambientRace;
      body.userData.npcTable = def.npcTableId;
      g.add(body);
    }
    return g;
  }

  private buildPortals() {
    for (const link of SKY_PORTALS) {
      const from = this.sites.get(link.from);
      const to = this.sites.get(link.to);
      if (!from || !to) continue;

      const mesh = makePortalMesh(link.radius, link.color);
      mesh.name = link.id;
      mesh.position.set(link.local.x, link.local.y, link.local.z);
      mesh.userData.portalId = link.id;
      mesh.userData.label = link.label;
      from.root.add(mesh);

      // World destinations
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);
      const destWorld = to.origin
        .clone()
        .add(
          new THREE.Vector3(link.destLocal.x, link.destLocal.y, link.destLocal.z).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            to.root.rotation.y,
          ),
        );

      // Label sprite (canvas)
      const label = this.makeLabel(link.label, link.color);
      label.position.set(0, link.radius + 0.8, 0);
      mesh.add(label);

      this.portals.push({
        link,
        mesh,
        worldPos,
        destWorld,
        cooldown: 0,
      });
    }
  }

  private makeLabel(text: string, color: number): THREE.Sprite {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.roundRect?.(12, 16, 488, 64, 12);
    ctx.fillRect(12, 16, 488, 64);
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.font = "bold 32px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(3.2, 0.6, 1);
    return spr;
  }

  /**
   * Per-frame: animate portals, check player proximity for auto-teleport.
   * Hold E is preferred — if `wantInteract` true when in range, teleport.
   */
  update(
    dt: number,
    playerPos: THREE.Vector3 | null,
    opts?: { wantInteract?: boolean; autoTeleport?: boolean },
  ) {
    if (!this.loaded) return;
    this.spinT += dt;
    for (const p of this.portals) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.mesh.rotation.z = this.spinT * 0.7;
      p.mesh.getWorldPosition(p.worldPos);
      // pulse emissive
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity != null) {
        mat.emissiveIntensity = 0.65 + Math.sin(this.spinT * 3 + p.link.radius) * 0.25;
      }
    }
    if (!playerPos) return;

    let nearest: LivePortal | null = null;
    let nearestD = Infinity;
    for (const p of this.portals) {
      const d = playerPos.distanceTo(p.worldPos);
      if (d < nearestD) {
        nearestD = d;
        nearest = p;
      }
    }
    if (!nearest || nearestD > this.interactRadius) return;
    if (nearest.cooldown > 0) return;

    const fire =
      opts?.wantInteract ||
      (opts?.autoTeleport !== false && nearestD < nearest.link.radius * 0.85);
    if (!fire) {
      // Soft hint
      if (nearestD < this.interactRadius && Math.floor(this.spinT * 2) % 4 === 0) {
        /* host can poll getHint */
      }
      return;
    }

    this.usePortal(nearest, playerPos);
  }

  /** Manual portal use (E key). */
  tryInteract(playerPos: THREE.Vector3): boolean {
    let nearest: LivePortal | null = null;
    let nearestD = Infinity;
    for (const p of this.portals) {
      p.mesh.getWorldPosition(p.worldPos);
      const d = playerPos.distanceTo(p.worldPos);
      if (d < nearestD) {
        nearestD = d;
        nearest = p;
      }
    }
    if (!nearest || nearestD > this.interactRadius || nearest.cooldown > 0) return false;
    this.usePortal(nearest, playerPos);
    return true;
  }

  getHint(playerPos: THREE.Vector3 | null): string | null {
    if (!playerPos || !this.loaded) return null;
    for (const p of this.portals) {
      p.mesh.getWorldPosition(p.worldPos);
      if (playerPos.distanceTo(p.worldPos) < this.interactRadius) {
        return `[E] ${p.link.label}`;
      }
    }
    return null;
  }

  private usePortal(p: LivePortal, _from: THREE.Vector3) {
    p.cooldown = 1.4;
    // Refresh dest (site may have moved — shouldn't, but keep correct)
    const to = this.sites.get(p.link.to);
    if (to) {
      p.destWorld = to.origin
        .clone()
        .add(
          new THREE.Vector3(
            p.link.destLocal.x,
            p.link.destLocal.y,
            p.link.destLocal.z,
          ).applyAxisAngle(new THREE.Vector3(0, 1, 0), to.root.rotation.y),
        );
    }
    this.cbs.teleportPlayer?.(p.destWorld.clone(), undefined);
    this.cbs.flash?.(p.link.label, 1.4);
  }

  /** World origins of sky sites (for minimap / debug). */
  siteOrigins(): Array<{ id: SkyTownId; pos: THREE.Vector3; name: string }> {
    return [...this.sites.values()].map((s) => ({
      id: s.def.id,
      pos: s.origin.clone(),
      name: s.def.name,
    }));
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}
