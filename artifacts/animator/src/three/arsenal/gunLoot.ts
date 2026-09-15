/**
 * World dropables for Ultimate Guns + ammo (Arc Raiders-style looting).
 *
 * Spawns lightweight pickups in the scene; host (Studio / openworld) calls
 * {@link GunLootField.update} and {@link tryPickupNear}.
 */
import * as THREE from "three";
import {
  AMMO_LABEL,
  AMMO_STACK_MAX,
  ULTIMATE_GUNS,
  type AmmoTypeId,
  type UltimateGunDef,
  ultimateGunById,
} from "./ultimateGuns";

export type GunLootKind = "weapon" | "ammo";

export interface GunLootItem {
  id: string;
  kind: GunLootKind;
  /** ug_* when weapon */
  weaponSkinId?: string;
  weaponId?: string;
  ammo?: AmmoTypeId;
  amount?: number;
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  /** Seconds until despawn; Infinity = permanent */
  ttl: number;
  age: number;
}

export interface GunInventorySink {
  /** Add weapon skin / equip candidate */
  grantWeapon?(skinId: string, weaponId: string): void;
  /** Add reserve ammo */
  grantAmmo?(ammo: AmmoTypeId, amount: number): void;
}

const _v = new THREE.Vector3();

function makeMarker(
  THREE_NS: typeof THREE,
  color: number,
  kind: GunLootKind,
): THREE.Group {
  const g = new THREE.Group();
  g.name = kind === "weapon" ? "loot_weapon" : "loot_ammo";
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.4,
    roughness: 0.45,
  });
  if (kind === "weapon") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.42), mat);
    body.position.y = 0.12;
    g.add(body);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.18), mat);
    box.position.y = 0.08;
    g.add(box);
  }
  // Soft ground glow disc
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 20),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  g.add(disc);
  return g;
}

function weightedPick<T extends { weight: number }>(list: T[], rng: () => number): T {
  let total = 0;
  for (const e of list) total += e.weight;
  let r = rng() * total;
  for (const e of list) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return list[list.length - 1]!;
}

export class GunLootField {
  readonly root = new THREE.Group();
  private items: GunLootItem[] = [];
  private seq = 0;
  private rng: () => number;

  constructor(
    private scene: THREE.Scene,
    opts?: { seed?: number },
  ) {
    this.root.name = "GunLootField";
    scene.add(this.root);
    let s = (opts?.seed ?? 7) >>> 0;
    this.rng = () => {
      s = (Math.imul(s ^ (s >>> 15), s | 1) + Math.imul(s ^ (s >>> 7), s | 61)) >>> 0;
      return (s >>> 0) / 4294967296;
    };
  }

  get itemsReadonly(): readonly GunLootItem[] {
    return this.items;
  }

  /** Drop a specific weapon skin at world position. */
  dropWeapon(skinId: string, position: THREE.Vector3, ttl = 120): GunLootItem | null {
    const def = ultimateGunById(skinId);
    if (!def) return null;
    const mesh = makeMarker(THREE, 0x66ccff, "weapon");
    mesh.position.copy(position);
    mesh.position.y = Math.max(position.y, 0) + 0.02;
    this.root.add(mesh);
    const item: GunLootItem = {
      id: `loot_w_${++this.seq}`,
      kind: "weapon",
      weaponSkinId: def.id,
      weaponId: def.weaponId,
      position: mesh.position.clone(),
      mesh,
      ttl,
      age: 0,
    };
    this.items.push(item);
    return item;
  }

  dropAmmo(ammo: AmmoTypeId, amount: number, position: THREE.Vector3, ttl = 90): GunLootItem {
    const colors: Record<AmmoTypeId, number> = {
      light: 0xffe080,
      medium: 0x80c8ff,
      heavy: 0xff9040,
      shell: 0xffb070,
    };
    const mesh = makeMarker(THREE, colors[ammo], "ammo");
    mesh.position.copy(position);
    mesh.position.y = Math.max(position.y, 0) + 0.02;
    mesh.userData.label = `${AMMO_LABEL[ammo]} x${amount}`;
    this.root.add(mesh);
    const item: GunLootItem = {
      id: `loot_a_${++this.seq}`,
      kind: "ammo",
      ammo,
      amount: Math.min(AMMO_STACK_MAX[ammo], Math.max(1, amount | 0)),
      position: mesh.position.clone(),
      mesh,
      ttl,
      age: 0,
    };
    this.items.push(item);
    return item;
  }

  /** Weighted world_common table near a point (death / crate). */
  dropRandomLoot(position: THREE.Vector3, table: "world_common" | "raid_cache" = "world_common"): void {
    const common: Array<
      | { kind: "ammo"; ammo: AmmoTypeId; min: number; max: number; weight: number }
      | { kind: "weapon"; weapon: string; weight: number }
    > =
      table === "raid_cache"
        ? [
            { kind: "weapon", weapon: "ug_assault", weight: 1 },
            { kind: "weapon", weapon: "ug_sniper", weight: 0.6 },
            { kind: "weapon", weapon: "ug_shotgun", weight: 0.7 },
            { kind: "weapon", weapon: "ug_bullpup", weight: 0.5 },
            { kind: "ammo", ammo: "medium", min: 30, max: 60, weight: 2 },
            { kind: "ammo", ammo: "heavy", min: 8, max: 16, weight: 1.2 },
            { kind: "ammo", ammo: "shell", min: 8, max: 16, weight: 1.2 },
          ]
        : [
            { kind: "ammo", ammo: "light", min: 12, max: 30, weight: 3 },
            { kind: "ammo", ammo: "medium", min: 12, max: 24, weight: 2.5 },
            { kind: "ammo", ammo: "shell", min: 4, max: 10, weight: 1.5 },
            { kind: "ammo", ammo: "heavy", min: 4, max: 8, weight: 1 },
            { kind: "weapon", weapon: "ug_pistol", weight: 0.8 },
            { kind: "weapon", weapon: "ug_smg", weight: 0.5 },
            { kind: "weapon", weapon: "ug_assault", weight: 0.4 },
          ];

    const rolls = table === "raid_cache" ? 2 : 1;
    for (let i = 0; i < rolls; i++) {
      const pick = weightedPick(common, this.rng);
      const jitter = _v.set(
        position.x + (this.rng() - 0.5) * 1.2,
        position.y,
        position.z + (this.rng() - 0.5) * 1.2,
      );
      if (pick.kind === "ammo") {
        const n = pick.min + Math.floor(this.rng() * (pick.max - pick.min + 1));
        this.dropAmmo(pick.ammo, n, jitter);
      } else {
        this.dropWeapon(pick.weapon, jitter);
      }
    }
  }

  /**
   * Pickup nearest loot within radius. Returns true if something was taken.
   */
  tryPickupNear(
    playerPos: THREE.Vector3,
    sink: GunInventorySink,
    radius = 1.6,
  ): GunLootItem | null {
    let best: GunLootItem | null = null;
    let bestD = radius * radius;
    for (const it of this.items) {
      const d = it.mesh.position.distanceToSquared(playerPos);
      if (d <= bestD) {
        bestD = d;
        best = it;
      }
    }
    if (!best) return null;
    if (best.kind === "weapon" && best.weaponSkinId && best.weaponId) {
      sink.grantWeapon?.(best.weaponSkinId, best.weaponId);
    } else if (best.kind === "ammo" && best.ammo && best.amount) {
      sink.grantAmmo?.(best.ammo, best.amount);
    }
    this.remove(best);
    return best;
  }

  private remove(it: GunLootItem) {
    this.root.remove(it.mesh);
    it.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else (mat as THREE.Material | undefined)?.dispose?.();
      }
    });
    this.items = this.items.filter((x) => x.id !== it.id);
  }

  update(dt: number) {
    const doomed: GunLootItem[] = [];
    for (const it of this.items) {
      it.age += dt;
      // Bob + spin for readability
      it.mesh.position.y = it.position.y + 0.06 + Math.sin(it.age * 3) * 0.04;
      it.mesh.rotation.y += dt * 1.2;
      if (Number.isFinite(it.ttl) && it.age >= it.ttl) doomed.push(it);
    }
    for (const d of doomed) this.remove(d);
  }

  dispose() {
    for (const it of [...this.items]) this.remove(it);
    this.scene.remove(this.root);
  }
}

/** All dropable weapon skins (for UI lists). */
export function allDropableGuns(): UltimateGunDef[] {
  return ULTIMATE_GUNS;
}
