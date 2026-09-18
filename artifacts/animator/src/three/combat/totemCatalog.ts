/**
 * Norse totem poles (XList CC-BY) — combat deploy gadgets.
 * Same placement law as snare field / turret: a few feet (2.2 m) ahead of
 * the caster, or 2.2 m from the locked target for taunt.
 *
 * Meshes: production GLB baked Y-up, feet on ground, SI height (tier 2.15–3.85 m).
 * Source: Documents xlist_totem_*.glb (Sketchfab Z-up). Spawn rises from underground.
 */

export type TotemEffect = "heal_mist" | "attack_ward" | "trap" | "taunt" | "stun";

export type TotemPlace = "caster_forward" | "target";

export type TotemDef = {
  id: string;
  name: string;
  god: string;
  tier: number;
  /** Production CDN key (not the 50 MB Sketchfab dump). */
  meshKey: string;
  /** Baked Y-up, feet at y=0. */
  authorUp: "y";
  /** Baked world height (SI m). */
  heightM: number;
  /** Seconds the pole rises from underground. */
  riseSec: number;
  effect: TotemEffect;
  place: TotemPlace;
  /** Metres from caster forward, or from target. */
  offsetM: number;
  aoeRadius: number;
  life: number;
  color: number;
  credit: string;
};

const CDN = "models/vfx/totems";

export const TOTEM_DEFS: readonly TotemDef[] = [
  {
    id: "nordin_t0",
    name: "Nordin Totem T0",
    god: "nordin",
    tier: 0,
    meshKey: `${CDN}/totem_nordin_t0.glb`,
    authorUp: "y",
    heightM: 2.15,
    riseSec: 0.48,
    effect: "trap",
    place: "caster_forward",
    offsetM: 2.2,
    aoeRadius: 3.2,
    life: 8,
    color: 0x6b8f5e,
    credit: "XList CC-BY-4.0",
  },
  {
    id: "nordin_t1",
    name: "Nordin Totem T1",
    god: "nordin",
    tier: 1,
    meshKey: `${CDN}/totem_nordin_t1.glb`,
    authorUp: "y",
    heightM: 2.3,
    riseSec: 0.5,
    effect: "trap",
    place: "caster_forward",
    offsetM: 2.2,
    aoeRadius: 3.4,
    life: 8,
    color: 0x7a9a68,
    credit: "XList CC-BY-4.0",
  },
  {
    id: "tyr_t2",
    name: "Týr Totem T2",
    god: "tyr",
    tier: 2,
    meshKey: `${CDN}/totem_tyr_t2.glb`,
    authorUp: "y",
    heightM: 2.5,
    riseSec: 0.5,
    effect: "stun",
    place: "caster_forward",
    offsetM: 2.2,
    aoeRadius: 3.6,
    life: 7,
    color: 0xc9a227,
    credit: "XList CC-BY-4.0",
  },
  {
    id: "freya_t3",
    name: "Freya Totem T3",
    god: "freya",
    tier: 3,
    meshKey: `${CDN}/totem_freya_t3.glb`,
    authorUp: "y",
    heightM: 2.7,
    riseSec: 0.52,
    effect: "heal_mist",
    place: "caster_forward",
    offsetM: 2.2,
    aoeRadius: 4.0,
    life: 9,
    color: 0xf0a0c8,
    credit: "XList CC-BY-4.0",
  },
  {
    id: "loki_t4",
    name: "Loki Totem T4",
    god: "loki",
    tier: 4,
    meshKey: `${CDN}/totem_loki_t4.glb`,
    authorUp: "y",
    heightM: 2.9,
    riseSec: 0.52,
    effect: "trap",
    place: "caster_forward",
    offsetM: 2.2,
    aoeRadius: 3.5,
    life: 8,
    color: 0x88cc55,
    credit: "XList CC-BY-4.0",
  },
  {
    id: "thor_t5",
    name: "Thor Totem T5",
    god: "thor",
    tier: 5,
    meshKey: `${CDN}/totem_thor_t5.glb`,
    authorUp: "y",
    heightM: 3.15,
    riseSec: 0.55,
    effect: "attack_ward",
    place: "caster_forward",
    offsetM: 2.2,
    aoeRadius: 4.2,
    life: 8,
    color: 0x4aa3ff,
    credit: "XList CC-BY-4.0",
  },
  {
    id: "odin_t6",
    name: "Odin Totem T6",
    god: "odin",
    tier: 6,
    meshKey: `${CDN}/totem_odin_t6.glb`,
    authorUp: "y",
    heightM: 3.4,
    riseSec: 0.58,
    effect: "taunt",
    place: "target",
    offsetM: 2.2,
    aoeRadius: 10,
    life: 7,
    color: 0xd4c4a0,
    credit: "XList CC-BY-4.0",
  },
  {
    id: "valhalla_t7",
    name: "Valhalla Totem Pole T7",
    god: "valhalla",
    tier: 7,
    meshKey: `${CDN}/totem_valhalla_t7.glb`,
    authorUp: "y",
    heightM: 3.85,
    riseSec: 0.62,
    effect: "stun",
    place: "caster_forward",
    offsetM: 2.4,
    aoeRadius: 4.5,
    life: 9,
    color: 0xe8d48a,
    credit: "XList CC-BY-4.0",
  },
];

/** HUD 1–4 on nature staff: trap, heal mist, attack ward, taunt-at-target. */
export const TOTEM_T0_SLOTS: readonly TotemDef[] = [
  TOTEM_DEFS[0], // nordin trap
  TOTEM_DEFS[3], // freya heal
  TOTEM_DEFS[5], // thor ward
  TOTEM_DEFS[6], // odin taunt
];

export function totemById(id: string): TotemDef | undefined {
  return TOTEM_DEFS.find((t) => t.id === id);
}

export function totemForSlot(slot: number): TotemDef {
  return TOTEM_T0_SLOTS[Math.max(0, Math.min(3, slot))] ?? TOTEM_DEFS[0];
}
