/**
 * World of Warcraft spell names still shown in Open, awaiting Jonathan's
 * replacement names. Do not rename these until he provides the new names.
 *
 * Already renamed (ObjectStore #60): Fireball → Emberburst, Blink → Flicker Step.
 */
export const WOW_NAMES_AWAITING: readonly {
  name: string;
  where: readonly string[];
}[] = [
  {
    name: "Whirlwind",
    where: [
      "artifacts/animator/src/three/editor/playSkills.ts",
      "artifacts/animator/src/lib/grudgeSystems/_creatorClassData.json",
    ],
  },
  {
    name: "Hellfire",
    where: ["artifacts/animator/src/three/arsenal/gunClass.ts"],
  },
  {
    name: "Smite",
    where: ["artifacts/animator/src/three/arsenal/t0WeaponSkills.ts"],
  },
];
