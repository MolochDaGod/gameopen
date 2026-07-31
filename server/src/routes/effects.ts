import { Router } from "express";
import { config } from "../lib/config.js";

/**
 * VFX / skill-effect catalog for the client.
 * Prefers ObjectStore abilityEffects; falls back to a local curated list
 * matching models/vfx/*.glb shipped with gameopen.
 */
const LOCAL_EFFECTS = [
  { id: "attack-slashes", name: "Attack Slashes", glb: "models/vfx/attack-slashes.glb", kind: "melee" },
  { id: "lightning", name: "Lightning", glb: "models/vfx/lightning.glb", kind: "magic" },
  // Staff bolts = discrete orbs (never whole fireball demo scene)
  { id: "orb-fire", name: "Fire Orb", glb: "models/vfx/orbs/orb-fire.glb", kind: "projectile" },
  { id: "orb-ember", name: "Ember Orb", glb: "models/vfx/orbs/orb-ember.glb", kind: "projectile" },
  { id: "orb-core", name: "Arcane Core Orb", glb: "models/vfx/orbs/orb-core.glb", kind: "projectile" },
  { id: "orb-flare", name: "Flare Orb", glb: "models/vfx/orbs/orb-flare.glb", kind: "projectile" },
  { id: "fireball-scene", name: "Fireball Demo Scene", glb: "models/vfx/fireball.glb", kind: "demo" },
  { id: "explosion", name: "Explosion", glb: "models/vfx/explosion.glb", kind: "aoe" },
  { id: "explosive-orb", name: "Explosive Orb", glb: "models/vfx/explosive-orb.glb", kind: "projectile" },
  { id: "energy-beam", name: "Energy Beam", glb: "models/vfx/energy-beam.glb", kind: "beam" },
  { id: "laser-beam", name: "Laser Beam", glb: "models/vfx/laser-beam.glb", kind: "beam" },
  { id: "light-beam", name: "Light Beam", glb: "models/vfx/light-beam.glb", kind: "beam" },
  { id: "spell-glyph", name: "Spell Glyph", glb: "models/vfx/spell-glyph.glb", kind: "cast" },
  { id: "chaos-glyph", name: "Chaos Glyph", glb: "models/vfx/chaos-glyph.glb", kind: "cast" },
  { id: "aoe-warning", name: "AoE Warning", glb: "models/vfx/aoe-warning.glb", kind: "telegraph" },
  { id: "location", name: "Location Marker", glb: "models/vfx/location.glb", kind: "marker" },
  { id: "ring-green", name: "Ring Green", glb: "models/vfx/ring-green.glb", kind: "buff" },
  { id: "ring-red", name: "Ring Red", glb: "models/vfx/ring-red.glb", kind: "debuff" },
  { id: "yellow-light", name: "Yellow Light", glb: "models/vfx/yellow-light.glb", kind: "buff" },
  { id: "crystals", name: "Crystals", glb: "models/vfx/crystals.glb", kind: "prop" },
  { id: "muzzle", name: "Muzzle Flash", glb: "models/vfx/muzzle.glb", kind: "gun" },
  { id: "strawberry-strike", name: "Strawberry Strike", glb: "models/vfx/strawberry-strike.glb", kind: "melee" },
  { id: "light-of-slash", name: "Light of Slash", glb: "models/vfx/light-of-slash.glb", kind: "melee" },
  { id: "slash-red", name: "Getsuga Red", glb: "models/vfx/slash/slashred.glb", kind: "melee" },
  { id: "slash-blue", name: "Getsuga Blue", glb: "models/vfx/slash/slashblue.glb", kind: "melee" },
  { id: "slash-purple", name: "Getsuga Purple", glb: "models/vfx/slash/slashpurple.glb", kind: "melee" },
  { id: "slash-yellow", name: "Getsuga Yellow", glb: "models/vfx/slash/slashyellow.glb", kind: "melee" },
  { id: "fire-tornado", name: "Fire Tornado", glb: "models/vfx/stylized-fire-tornado.glb", kind: "aoe" },
  { id: "meteor", name: "Meteor", glb: "models/vfx/meteor.glb", kind: "projectile" },
  { id: "dragon", name: "Dragon Bolt", glb: "models/vfx/dragon.glb", kind: "projectile" },
  { id: "soul", name: "Soul", glb: "models/vfx/soul.glb", kind: "projectile" },
  { id: "burst-laser", name: "Burst Laser", glb: "models/vfx/burst-laser.glb", kind: "beam" },
] as const;

const router = Router();

function assetUrl(rel: string): string {
  const base = config.assetsCdn.replace(/\/$/, "");
  const prefix = config.gameopenAssetPrefix;
  return `${base}/${prefix}/${rel.replace(/^\//, "")}`;
}

router.get("/effects", async (_req, res) => {
  let remote: unknown = null;
  try {
    const r = await fetch(`${config.objectStoreUrl}/abilityEffects.json`, {
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) remote = await r.json();
  } catch {
    /* offline / cold ObjectStore — local catalog is fine */
  }

  const local = LOCAL_EFFECTS.map((e) => ({
    ...e,
    url: assetUrl(e.glb),
    localUrl: `/${e.glb}`,
  }));

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json({
    source: remote ? "objectstore+local" : "local",
    count: local.length,
    effects: local,
    objectStore: remote,
    cdn: config.assetsCdn,
  });
});

export default router;
