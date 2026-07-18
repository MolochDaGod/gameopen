/**
 * Jade stone tool pack for voxel / harvest gameplay.
 * Source: D:\Games\Models\all_jade_stone_tools.glb
 * Split: public/models/tools/jade/jade_*.glb + catalog.json
 */
export type JadeToolRole =
  | "mine"
  | "chop"
  | "till"
  | "dig"
  | "fish"
  | "combat"
  | "craft"
  | "misc";

export interface JadeToolDef {
  id: string;
  label: string;
  role: JadeToolRole;
  /** Relative public path */
  glb: string;
  /** Profession / activity this tool unlocks or boosts */
  profession?: string;
}

/** Full multipack (all tools in one GLB — isolate by meshName at runtime if needed). */
export const JADE_TOOLS_PACK = "models/tools/all_jade_stone_tools.glb";

/**
 * Ordered split tools (Blender isolation from pack).
 * Names are gameplay IDs — verify mesh read in editor if order drifts.
 */
export const JADE_TOOLS: JadeToolDef[] = [
  { id: "jade_pickaxe", label: "Jade Pickaxe", role: "mine", glb: "models/tools/jade/jade_pickaxe.glb", profession: "mining" },
  { id: "jade_axe", label: "Jade Axe", role: "chop", glb: "models/tools/jade/jade_axe.glb", profession: "woodcutting" },
  { id: "jade_hoe", label: "Jade Hoe", role: "till", glb: "models/tools/jade/jade_hoe.glb", profession: "farming" },
  { id: "jade_shovel", label: "Jade Shovel", role: "dig", glb: "models/tools/jade/jade_shovel.glb", profession: "digging" },
  { id: "jade_sword", label: "Jade Sword", role: "combat", glb: "models/tools/jade/jade_sword.glb" },
  { id: "jade_fishing_pole", label: "Jade Fishing Pole", role: "fish", glb: "models/tools/jade/jade_fishing_pole.glb", profession: "fishing" },
  { id: "jade_hammer", label: "Jade Hammer", role: "craft", glb: "models/tools/jade/jade_hammer.glb", profession: "crafting" },
  { id: "jade_knife", label: "Jade Knife", role: "craft", glb: "models/tools/jade/jade_knife.glb" },
  { id: "jade_sickle", label: "Jade Sickle", role: "till", glb: "models/tools/jade/jade_sickle.glb", profession: "farming" },
  { id: "jade_rake", label: "Jade Rake", role: "till", glb: "models/tools/jade/jade_rake.glb", profession: "farming" },
  { id: "jade_spear", label: "Jade Spear", role: "combat", glb: "models/tools/jade/jade_spear.glb" },
  { id: "jade_club", label: "Jade Club", role: "combat", glb: "models/tools/jade/jade_club.glb" },
  { id: "jade_staff", label: "Jade Staff", role: "combat", glb: "models/tools/jade/jade_staff.glb" },
  { id: "jade_bow", label: "Jade Bow", role: "combat", glb: "models/tools/jade/jade_bow.glb" },
  { id: "jade_arrow", label: "Jade Arrow", role: "combat", glb: "models/tools/jade/jade_arrow.glb" },
  { id: "jade_bucket", label: "Jade Bucket", role: "misc", glb: "models/tools/jade/jade_bucket.glb" },
  { id: "jade_rod", label: "Jade Rod", role: "fish", glb: "models/tools/jade/jade_rod.glb", profession: "fishing" },
  { id: "jade_chisel", label: "Jade Chisel", role: "craft", glb: "models/tools/jade/jade_chisel.glb" },
  { id: "jade_saw", label: "Jade Saw", role: "chop", glb: "models/tools/jade/jade_saw.glb", profession: "woodcutting" },
  { id: "jade_mallet", label: "Jade Mallet", role: "craft", glb: "models/tools/jade/jade_mallet.glb" },
  { id: "jade_scythe", label: "Jade Scythe", role: "till", glb: "models/tools/jade/jade_scythe.glb", profession: "farming" },
  { id: "jade_dagger", label: "Jade Dagger", role: "combat", glb: "models/tools/jade/jade_dagger.glb" },
  { id: "jade_mace", label: "Jade Mace", role: "combat", glb: "models/tools/jade/jade_mace.glb" },
  { id: "jade_shield", label: "Jade Shield", role: "combat", glb: "models/tools/jade/jade_shield.glb" },
  { id: "jade_torch", label: "Jade Torch", role: "misc", glb: "models/tools/jade/jade_torch.glb" },
  { id: "jade_net", label: "Jade Net", role: "fish", glb: "models/tools/jade/jade_net.glb", profession: "fishing" },
  { id: "jade_hook", label: "Jade Hook", role: "fish", glb: "models/tools/jade/jade_hook.glb", profession: "fishing" },
  { id: "jade_bobber", label: "Jade Bobber", role: "fish", glb: "models/tools/jade/jade_bobber.glb", profession: "fishing" },
  { id: "jade_lure", label: "Jade Lure", role: "fish", glb: "models/tools/jade/jade_lure.glb", profession: "fishing" },
  { id: "jade_pick", label: "Jade Pick", role: "mine", glb: "models/tools/jade/jade_pick.glb", profession: "mining" },
  { id: "jade_mattock", label: "Jade Mattock", role: "mine", glb: "models/tools/jade/jade_mattock.glb", profession: "mining" },
  { id: "jade_crowbar", label: "Jade Crowbar", role: "misc", glb: "models/tools/jade/jade_crowbar.glb" },
];

export function jadeToolsByRole(role: JadeToolRole): JadeToolDef[] {
  return JADE_TOOLS.filter((t) => t.role === role);
}

export function jadeFishingTools(): JadeToolDef[] {
  return jadeToolsByRole("fish");
}
