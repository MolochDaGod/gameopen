/**
 * Player-vs-NPC arena match state machine for the Danger Room / arena.glb.
 *
 * Modes:
 *   1v1 — player alone vs one AI foe (high skill usage)
 *   2v2 — player + support ally vs two AI foes
 *
 * Flow:
 *   idle → countdown (3…2…1…FIGHT) → fighting → result (2s WIN/LOSE banner)
 *        → choice (Retry | Return)
 *
 * Retry restarts the same loadout on the arena map. Return unloads the match.
 */
import type { WeaponId } from "./types";

export type ArenaPhase = "idle" | "countdown" | "fighting" | "result" | "choice";

export type ArenaOutcome = "win" | "lose" | null;

/** 1v1 = solo; 2v2 = player + one ally vs two enemies. */
export type ArenaMode = "1v1" | "2v2";

/** Snapshot of one combatant to re-spawn on retry. */
export interface ArenaOpponentSpec {
  weaponId: WeaponId;
  /** Boss archetype when true. */
  boss?: boolean;
  scale?: number;
  /** AI lean for spawn (host maps to bias / reaction). */
  role?: "bruiser" | "skirmisher" | "support" | "duelist";
}

export interface ArenaFighterHudBar {
  id: string;
  name: string;
  faction: "player" | "ally" | "enemy";
  health01: number;
  dead: boolean;
}

export interface ArenaMatchState {
  active: boolean;
  phase: ArenaPhase;
  /** Whole seconds left (countdown / result). 0 during fighting/choice. */
  timer: number;
  /** Large center label for countdown / result. */
  label: string;
  outcome: ArenaOutcome;
  /** True when Retry / Return buttons should show. */
  canChoose: boolean;
  /** Human-readable opponent line, e.g. "Sword × 2". */
  opponentLabel: string;
  /** Human-readable ally line (2v2), e.g. "Ally Healer". */
  allyLabel: string;
  mode: ArenaMode;
  modeLabel: string;
  round: number;
  /** Living counts for HUD strip. */
  livingEnemies: number;
  livingAllies: number;
  /** Optional last skill flash for UX ("SKILL · Slash"). */
  skillCue: string;
  /** Team bars (player / allies / enemies) for arena HUD. */
  bars: ArenaFighterHudBar[];
}

const COUNTDOWN_SEC = 3;
const RESULT_SEC = 2;

/**
 * Arena floor priority:
 *  1. arena3.glb — Clash-style Royale level (D:\Games\Models\arena3.glb)
 *  2. helpers forge pack (character stripped)
 *  3. legacy arena.glb
 */
export const ARENA_MAP_PATH = "models/arena/arena3.glb";
export const ARENA_MAP_PATHS = [
  "models/arena/arena3.glb",
  "models/maps/arena3.glb",
  "models/helpers-arena.glb",
  "models/landing/helpers.glb",
  "models/helpers-forge.glb",
  "models/arena.glb",
] as const;

/** Default loadouts per mode (host may override). */
export function defaultArenaLoadout(mode: ArenaMode): {
  enemies: ArenaOpponentSpec[];
  allies: ArenaOpponentSpec[];
} {
  if (mode === "1v1") {
    return {
      enemies: [{ weaponId: "sword", role: "duelist" }],
      allies: [],
    };
  }
  return {
    enemies: [
      { weaponId: "sword", role: "bruiser" },
      { weaponId: "axe", role: "skirmisher" },
    ],
    allies: [{ weaponId: "staff", role: "support" }],
  };
}

export class ArenaMatch {
  private phase: ArenaPhase = "idle";
  private timer = 0;
  private outcome: ArenaOutcome = null;
  private round = 0;
  private enemies: ArenaOpponentSpec[] = [];
  private allies: ArenaOpponentSpec[] = [];
  private mode: ArenaMode = "1v1";
  private label = "";
  private skillCue = "";
  private skillCueT = 0;
  private livingEnemies = 0;
  private livingAllies = 0;
  private bars: ArenaFighterHudBar[] = [];

  get isActive(): boolean {
    return this.phase !== "idle";
  }

  get isChoice(): boolean {
    return this.phase === "choice";
  }

  get isFighting(): boolean {
    return this.phase === "fighting";
  }

  get isCountdown(): boolean {
    return this.phase === "countdown";
  }

  get currentMode(): ArenaMode {
    return this.mode;
  }

  get enemySpecs(): ArenaOpponentSpec[] {
    return this.enemies.map((o) => ({ ...o }));
  }

  get allySpecs(): ArenaOpponentSpec[] {
    return this.allies.map((o) => ({ ...o }));
  }

  /**
   * Begin a match. Empty enemy list uses {@link defaultArenaLoadout}.
   */
  start(
    mode: ArenaMode,
    enemies?: ArenaOpponentSpec[],
    allies?: ArenaOpponentSpec[],
  ): void {
    this.mode = mode;
    const def = defaultArenaLoadout(mode);
    this.enemies = (enemies?.length ? enemies : def.enemies).map((o) => ({ ...o }));
    this.allies = (allies ?? def.allies).map((o) => ({ ...o }));
    if (mode === "1v1") this.allies = [];
    if (!this.enemies.length) return;
    this.round = 0;
    this.outcome = null;
    this.skillCue = "";
    this.skillCueT = 0;
    this.bars = [];
    this.beginCountdown();
  }

  /** Abort completely and return to free roam (caller clears NPCs + map). */
  stop(): void {
    this.phase = "idle";
    this.timer = 0;
    this.outcome = null;
    this.label = "";
    this.enemies = [];
    this.allies = [];
    this.round = 0;
    this.skillCue = "";
    this.skillCueT = 0;
    this.bars = [];
    this.livingEnemies = 0;
    this.livingAllies = 0;
  }

  /**
   * Restart same loadout after result choice.
   * Returns { enemies, allies } for the host to respawn.
   */
  retry(): { enemies: ArenaOpponentSpec[]; allies: ArenaOpponentSpec[]; mode: ArenaMode } {
    if (this.phase !== "choice" && this.phase !== "result") {
      return { enemies: [], allies: [], mode: this.mode };
    }
    this.outcome = null;
    this.skillCue = "";
    this.skillCueT = 0;
    this.beginCountdown();
    return {
      enemies: this.enemies.map((o) => ({ ...o })),
      allies: this.allies.map((o) => ({ ...o })),
      mode: this.mode,
    };
  }

  /** Leave match after result — free roam. */
  returnToRoom(): void {
    this.stop();
  }

  /** Flash a skill name on the arena HUD (weapon skills / heals). */
  pushSkillCue(text: string, holdSec = 1.1): void {
    if (!text) return;
    this.skillCue = text;
    this.skillCueT = holdSec;
  }

  /** Host refreshes living counts + bars every frame while active. */
  setHudLive(opts: {
    livingEnemies: number;
    livingAllies: number;
    bars?: ArenaFighterHudBar[];
  }): void {
    this.livingEnemies = Math.max(0, opts.livingEnemies);
    this.livingAllies = Math.max(0, opts.livingAllies);
    if (opts.bars) this.bars = opts.bars;
  }

  private beginCountdown(): void {
    this.round += 1;
    this.phase = "countdown";
    this.timer = COUNTDOWN_SEC;
    this.label = String(COUNTDOWN_SEC);
    this.outcome = null;
  }

  /**
   * Advance timers. Caller reports living enemies + whether player is defeated.
   * In 2v2, ally deaths alone do not end the match — only player KO or wipe enemies.
   */
  update(
    dt: number,
    livingEnemies: number,
    playerDefeated: boolean,
  ): {
    releasedFight?: boolean;
    enteredResult?: ArenaOutcome;
    enteredChoice?: boolean;
  } {
    this.livingEnemies = livingEnemies;
    if (this.skillCueT > 0) {
      this.skillCueT -= dt;
      if (this.skillCueT <= 0) this.skillCue = "";
    }

    if (this.phase === "idle" || this.phase === "choice") return {};

    if (this.phase === "countdown") {
      this.timer -= dt;
      const sec = Math.ceil(this.timer);
      if (this.timer > 0) {
        this.label = String(Math.max(1, sec));
        return {};
      }
      this.phase = "fighting";
      this.timer = 0;
      this.label = "FIGHT!";
      return { releasedFight: true };
    }

    if (this.phase === "fighting") {
      if (this.label === "FIGHT!") {
        this.timer += dt;
        if (this.timer > 0.85) this.label = "";
      }
      if (playerDefeated) {
        this.enterResult("lose");
        return { enteredResult: "lose" };
      }
      if (livingEnemies <= 0) {
        this.enterResult("win");
        return { enteredResult: "win" };
      }
      return {};
    }

    if (this.phase === "result") {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = "choice";
        this.timer = 0;
        this.label = this.outcome === "win" ? "VICTORY" : "DEFEAT";
        return { enteredChoice: true };
      }
      return {};
    }

    return {};
  }

  private enterResult(outcome: ArenaOutcome): void {
    this.outcome = outcome;
    this.phase = "result";
    this.timer = RESULT_SEC;
    this.label = outcome === "win" ? "VICTORY" : "DEFEAT";
  }

  state(): ArenaMatchState {
    return {
      active: this.phase !== "idle",
      phase: this.phase,
      timer: Math.max(0, Math.ceil(this.timer)),
      label: this.label,
      outcome: this.outcome,
      canChoose: this.phase === "choice",
      opponentLabel: formatOpponents(this.enemies),
      allyLabel: formatAllies(this.allies),
      mode: this.mode,
      modeLabel: this.mode === "1v1" ? "1v1 DUEL" : "2v2 TEAM",
      round: this.round,
      livingEnemies: this.livingEnemies,
      livingAllies: this.livingAllies,
      skillCue: this.skillCue,
      bars: this.bars.slice(),
    };
  }
}

function formatOpponents(ops: ArenaOpponentSpec[]): string {
  if (!ops.length) return "—";
  const counts = new Map<string, number>();
  for (const o of ops) {
    const key = o.boss ? `${o.weaponId} (Boss)` : o.weaponId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([k, n]) => (n > 1 ? `${k} × ${n}` : k))
    .join(", ");
}

function formatAllies(ops: ArenaOpponentSpec[]): string {
  if (!ops.length) return "Solo";
  return ops
    .map((o) => (o.role === "support" ? `Healer (${o.weaponId})` : `Ally (${o.weaponId})`))
    .join(", ");
}
