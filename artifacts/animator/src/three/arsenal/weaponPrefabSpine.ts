/**
 * Weapon prefab spine — casting point, barrel, blade, blunt, special, physics, effect.
 *
 * SSOT docs: content/docs/WEAPON_PREFAB.md §3
 * Defaults fill when content JSON omits spine.points[id].
 * Runtime mount still uses MountedWeapon.tip; resolve helpers unify authors + combat.
 *
 * NOT an avatar customization system. Voxel body/look stays in voxelAvatarSave +
 * saveData.open.voxelLook (docs/VOXEL_ERA_AVATAR_GEAR_WIRING.md). Spine is only
 * local sockets on a held weapon mesh for combat FX / projectiles / colliders.
 */

export type SpinePointId =
  | "grip"
  | "blade"
  | "tip"
  | "blunt"
  | "barrel"
  | "cast"
  | "special"
  | "physics"
  | "effect";

export type SpineForward = "x+" | "x-" | "y+" | "y-" | "z+" | "z-";
export type SpineAlign = "y" | "z";

export type Vec3 = [number, number, number];

export type SpinePoint = {
  pos: Vec3;
  /** Optional local euler deg (rare) */
  rot?: Vec3;
  /** Physics helpers */
  radius?: number;
  halfHeight?: number;
  size?: Vec3;
};

export type WeaponSpine = {
  forward: SpineForward;
  align: SpineAlign;
  points: Partial<Record<SpinePointId, SpinePoint>>;
  status?: "ready" | "placeholder" | "missing";
};

/** Content-family strings (weapon_def + master packs). */
export type PrefabWeaponFamily =
  | "sword"
  | "greatsword"
  | "axe"
  | "greataxe"
  | "dagger"
  | "mace"
  | "hammer"
  | "spear"
  | "scythe"
  | "staff"
  | "wand"
  | "tome"
  | "bow"
  | "crossbow"
  | "gun"
  | "shield"
  | string;

const pt = (y: number, x = 0, z = 0): SpinePoint => ({
  pos: [x, y, z],
});

const ptZ = (z: number, y = 0.05, x = 0): SpinePoint => ({
  pos: [x, y, z],
});

/**
 * SI local defaults after normalize (grip at origin).
 * Melee: +Y along length. Guns: +Z along bore.
 */
export function defaultSpineForFamily(family: PrefabWeaponFamily): WeaponSpine {
  const f = String(family || "sword").toLowerCase();

  switch (f) {
    case "dagger":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blade: pt(0.27),
          tip: pt(0.45),
          blunt: pt(0.2),
          physics: { pos: [0, 0.25, 0], radius: 0.04, halfHeight: 0.2 },
          effect: pt(0.45),
        },
      };
    case "greatsword":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blade: pt(0.95),
          tip: pt(1.7),
          blunt: pt(0.5),
          physics: { pos: [0, 0.9, 0], radius: 0.06, halfHeight: 0.7 },
          effect: pt(1.7),
        },
      };
    case "axe":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blade: pt(0.9, 0, 0.12),
          tip: pt(1.0),
          blunt: pt(0.9),
          physics: { pos: [0, 0.55, 0], radius: 0.06, halfHeight: 0.45 },
          effect: pt(1.0),
        },
      };
    case "greataxe":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blade: pt(1.1, 0, 0.15),
          tip: pt(1.35),
          blunt: pt(1.1),
          physics: { pos: [0, 0.7, 0], radius: 0.07, halfHeight: 0.55 },
          effect: pt(1.35),
        },
      };
    case "mace":
    case "hammer":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blunt: pt(1.05),
          tip: pt(1.1),
          blade: pt(0.7),
          physics: { pos: [0, 0.7, 0], radius: 0.1, halfHeight: 0.35 },
          effect: pt(1.05),
        },
      };
    case "spear":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blade: pt(1.7),
          tip: pt(2.05),
          physics: { pos: [0, 1.0, 0], radius: 0.04, halfHeight: 0.9 },
          effect: pt(2.05),
        },
      };
    case "scythe":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blade: pt(1.2, 0, 0.25),
          tip: pt(1.5, 0, 0.4),
          special: pt(1.35, 0, 0.35),
          physics: { pos: [0, 0.9, 0], radius: 0.06, halfHeight: 0.7 },
          effect: pt(1.5, 0, 0.4),
        },
      };
    case "staff":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          cast: pt(1.45),
          tip: pt(1.45),
          special: pt(0.9),
          physics: { pos: [0, 0.8, 0], radius: 0.05, halfHeight: 0.7 },
          effect: pt(1.45),
        },
      };
    case "wand":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          cast: pt(0.55),
          tip: pt(0.55),
          physics: { pos: [0, 0.3, 0], radius: 0.03, halfHeight: 0.25 },
          effect: pt(0.55),
        },
      };
    case "tome":
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          cast: pt(0.25, 0.1, 0.05),
          special: pt(0.2),
          physics: { pos: [0, 0.15, 0], radius: 0.12, halfHeight: 0.08 },
          effect: pt(0.25, 0.1, 0.05),
        },
      };
    case "bow":
    case "crossbow":
      return {
        forward: "z+",
        align: "z",
        status: "placeholder",
        points: {
          grip: pt(0),
          barrel: ptZ(0.35, 0.08),
          special: ptZ(0.1, 0.2),
          physics: { pos: [0, 0.1, 0.15], radius: 0.06, halfHeight: 0.2 },
          effect: ptZ(0.35, 0.08),
        },
      };
    case "gun":
    case "pistol":
    case "rifle":
      return {
        forward: "z+",
        align: "z",
        status: "placeholder",
        points: {
          grip: pt(0),
          barrel: ptZ(0.36, 0.06),
          tip: ptZ(0.36, 0.06),
          special: ptZ(0.2, 0.04),
          physics: { pos: [0, 0.05, 0.15], radius: 0.04, halfHeight: 0.12 },
          effect: ptZ(0.36, 0.06),
        },
      };
    case "shield":
      return {
        forward: "z+",
        align: "z",
        status: "placeholder",
        points: {
          grip: pt(0),
          blunt: { pos: [0, 0.15, 0.08] },
          special: { pos: [0, 0.2, 0.1] },
          physics: { pos: [0, 0.15, 0.05], radius: 0.28, halfHeight: 0.05 },
          effect: { pos: [0, 0.15, 0.08] },
        },
      };
    case "sword":
    default:
      return {
        forward: "y+",
        align: "y",
        status: "placeholder",
        points: {
          grip: pt(0),
          blade: pt(0.62),
          tip: pt(1.12),
          blunt: pt(0.35),
          physics: { pos: [0, 0.55, 0], radius: 0.05, halfHeight: 0.45 },
          effect: pt(1.12),
        },
      };
  }
}

/** Primary combat socket for residual / impact by family. */
export function primaryCombatPointId(family: PrefabWeaponFamily): SpinePointId {
  const f = String(family || "sword").toLowerCase();
  if (f === "gun" || f === "pistol" || f === "rifle" || f === "bow" || f === "crossbow") {
    return "barrel";
  }
  if (f === "staff" || f === "wand" || f === "tome") return "cast";
  if (f === "mace" || f === "hammer" || f === "shield") return "blunt";
  return "tip";
}

export type SpineSource = {
  family?: string;
  spine?: WeaponSpine | null;
  mesh?: { spine?: WeaponSpine | null } | null;
};

/** Merge prefab JSON spine over family defaults. */
export function resolveWeaponSpine(src: SpineSource): WeaponSpine {
  const family = src.family || "sword";
  const base = defaultSpineForFamily(family);
  const override = src.spine || src.mesh?.spine || null;
  if (!override || override.status === "missing") return base;

  return {
    forward: override.forward || base.forward,
    align: override.align || base.align,
    status: override.status || base.status,
    points: {
      ...base.points,
      ...(override.points || {}),
    },
  };
}

export function resolveSpinePoint(
  src: SpineSource,
  id: SpinePointId,
): SpinePoint {
  const spine = resolveWeaponSpine(src);
  const p = spine.points[id];
  if (p) return p;
  // Fallbacks by role
  if (id === "effect") {
    return (
      spine.points.tip ||
      spine.points.cast ||
      spine.points.barrel ||
      spine.points.blunt ||
      spine.points.grip ||
      pt(0)
    );
  }
  if (id === "tip") {
    return spine.points.cast || spine.points.barrel || spine.points.blunt || pt(1);
  }
  if (id === "cast") {
    return spine.points.tip || spine.points.special || pt(1);
  }
  if (id === "barrel") {
    return spine.points.tip || ptZ(0.3);
  }
  if (id === "blunt") {
    return spine.points.tip || spine.points.blade || pt(0.8);
  }
  if (id === "blade") {
    return spine.points.tip || pt(0.6);
  }
  if (id === "physics") {
    return spine.points.blunt || spine.points.blade || { pos: [0, 0.5, 0], radius: 0.06, halfHeight: 0.4 };
  }
  return spine.points.grip || pt(0);
}

/**
 * Map skill VFX startAnchor strings → spine point.
 * Aligns content skill `vfx.travel.startAnchor` with runtime.
 */
export function spinePointForVfxAnchor(anchor: string | undefined | null): SpinePointId {
  const a = String(anchor || "weaponTip").toLowerCase();
  if (a === "muzzle" || a === "barrel" || a === "bore") return "barrel";
  if (a === "cast" || a === "orb" || a === "staff" || a === "wand") return "cast";
  if (a === "blunt" || a === "crush" || a === "impact") return "blunt";
  if (a === "blade" || a === "edge") return "blade";
  if (a === "special" || a === "aux") return "special";
  if (a === "hand" || a === "grip" || a === "root") return "grip";
  if (a === "physics" || a === "collider") return "physics";
  if (a === "effect" || a === "vfx") return "effect";
  return "tip"; // weaponTip / tip / default
}

/** Export envelope fragment for Unity / Warlords. */
export function spineExportFragment(src: SpineSource): Record<string, Vec3 | undefined> {
  const spine = resolveWeaponSpine(src);
  const out: Record<string, Vec3 | undefined> = {};
  for (const id of Object.keys(spine.points) as SpinePointId[]) {
    const p = spine.points[id];
    if (p) out[id] = p.pos;
  }
  return out;
}
