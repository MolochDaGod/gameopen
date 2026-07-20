/**
 * NPC AI behavior profiles for Worldbuilder — inspectable, scriptable-ish
 * policies that serialize with the map via localStorage overlay (map id optional).
 *
 * Play mode / enterArena can later read these; for now they power the Inspector
 * and Forge-style AI tools so designers can author intent without code.
 */

export type BehaviorId =
  | "idle"
  | "guard"
  | "patrol"
  | "aggressive"
  | "flanker"
  | "support"
  | "sniper"
  | "custom";

export interface NpcBehavior {
  id: BehaviorId;
  /** Designer-facing name */
  label: string;
  blurb: string;
  /** Metres — soft lock / engage */
  aggroRange: number;
  /** Metres — leash / patrol radius from spawn */
  patrolRadius: number;
  /** 0..1 health ratio when AI prefers retreat */
  fleeHealth: number;
  /** Prefer cover / range */
  preferRanged: boolean;
  /** Short policy “script” shown in inspector (human + AI editable) */
  policy: string;
  /** Free notes for AI agents / designers */
  notes: string;
}

export const BEHAVIOR_CATALOG: readonly NpcBehavior[] = [
  {
    id: "idle",
    label: "Idle",
    blurb: "Stand at spawn. Only react if attacked.",
    aggroRange: 4,
    patrolRadius: 0,
    fleeHealth: 0.1,
    preferRanged: false,
    policy: "on spawn: idle\non hit: target attacker, engage\nif health < 10%: flee",
    notes: "",
  },
  {
    id: "guard",
    label: "Guard",
    blurb: "Hold spawn. Engage threats in range, return when clear.",
    aggroRange: 12,
    patrolRadius: 2,
    fleeHealth: 0.15,
    preferRanged: false,
    policy:
      "loop:\n  if enemy in aggroRange: chase + attack\n  else: return to spawn, idle\nif health < 15%: hold ground, call allies",
    notes: "",
  },
  {
    id: "patrol",
    label: "Patrol",
    blurb: "Walk a radius around spawn; engage on sight.",
    aggroRange: 14,
    patrolRadius: 8,
    fleeHealth: 0.2,
    preferRanged: false,
    policy:
      "loop:\n  wander within patrolRadius of spawn\n  if enemy in aggroRange: engage\n  if lost target: resume patrol",
    notes: "",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    blurb: "Rush player hard. Low flee threshold.",
    aggroRange: 22,
    patrolRadius: 4,
    fleeHealth: 0.05,
    preferRanged: false,
    policy: "on detect: sprint engage\ncombo melee / skills on cooldown\nnever flee unless health < 5%",
    notes: "",
  },
  {
    id: "flanker",
    label: "Flanker",
    blurb: "Circle to sides; hit and move.",
    aggroRange: 16,
    patrolRadius: 10,
    fleeHealth: 0.25,
    preferRanged: false,
    policy:
      "if enemy facing me: strafe to side\nif flank angle good: attack\nif health < 25%: break line of sight",
    notes: "",
  },
  {
    id: "support",
    label: "Support",
    blurb: "Stay mid-range; favor allies and heal/buff patterns.",
    aggroRange: 18,
    patrolRadius: 6,
    fleeHealth: 0.35,
    preferRanged: true,
    policy:
      "keep mid range\nprefer ally near player\nif ally low: support skill\nif alone: kiting shots",
    notes: "",
  },
  {
    id: "sniper",
    label: "Sniper",
    blurb: "Hold distance; ranged kit preferred.",
    aggroRange: 28,
    patrolRadius: 5,
    fleeHealth: 0.3,
    preferRanged: true,
    policy:
      "maintain max comfortable range\nprefer high ground if available\nif player closes < 6m: kite back",
    notes: "",
  },
  {
    id: "custom",
    label: "Custom",
    blurb: "Blank slate — write policy for AI / play scripts.",
    aggroRange: 12,
    patrolRadius: 4,
    fleeHealth: 0.2,
    preferRanged: false,
    policy: "# write steps\n# on spawn:\n# on see player:\n# on low health:",
    notes: "",
  },
] as const;

const STORE_KEY = "worldbuilder:npc-behavior:v1";

export type BehaviorStore = Record<string, NpcBehavior>;

export function loadBehaviorStore(): BehaviorStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as BehaviorStore;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function saveBehaviorStore(store: BehaviorStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function getBehaviorForNpc(npcId: string, store?: BehaviorStore): NpcBehavior {
  const s = store ?? loadBehaviorStore();
  const b = s[npcId];
  if (b && BEHAVIOR_CATALOG.some((c) => c.id === b.id)) {
    return { ...BEHAVIOR_CATALOG.find((c) => c.id === b.id)!, ...b, id: b.id };
  }
  return { ...BEHAVIOR_CATALOG.find((c) => c.id === "guard")! };
}

export function setBehaviorForNpc(npcId: string, behavior: NpcBehavior): BehaviorStore {
  const store = loadBehaviorStore();
  store[npcId] = behavior;
  saveBehaviorStore(store);
  return store;
}

export function behaviorById(id: BehaviorId): NpcBehavior {
  return { ...(BEHAVIOR_CATALOG.find((c) => c.id === id) ?? BEHAVIOR_CATALOG[0]!) };
}

/** Pretty dump for AI context / inspector. */
export function formatBehaviorReport(npcLabel: string, b: NpcBehavior): string {
  return [
    `NPC: ${npcLabel}`,
    `Behavior: ${b.label} (${b.id})`,
    b.blurb,
    `aggro=${b.aggroRange}m patrol=${b.patrolRadius}m flee@${Math.round(b.fleeHealth * 100)}% ranged=${b.preferRanged}`,
    "— policy —",
    b.policy,
    b.notes ? `— notes —\n${b.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
