/**
 * Player-vs-NPC arena match state machine for the Danger Room.
 *
 * Modes:
 *   1v1 — player alone vs one AI foe (high skill usage)
 *   2v2 — player + support ally vs two AI foes
 *   ffa4 — up to 4 fighters (player + 3 AI explorers), first to {@link KILL_GOAL} kills
 *
 * Flow:
 *   idle → countdown (3…2…1…FIGHT) → fighting → result (2s WIN/LOSE banner)
 *        → choice (Retry | Return)
 *
 * FFA uses auto-respawn; score wins (not wipe). Classic modes end on wipe/KO.
 */
import type { WeaponId } from "./types";

export type ArenaPhase = "idle" | "countdown" | "fighting" | "result" | "choice";

export type ArenaOutcome = "win" | "lose" | null;

/** 1v1 = solo; 2v2 = team; ffa4 = deathmatch first-to-N. */
export type ArenaMode = "1v1" | "2v2" | "ffa4";

/** First to this many kills wins FFA. */
export const FFA_KILL_GOAL = 10;

/** Max combatants in FFA (1 human + AI fillers). */
export const FFA_MAX_PLAYERS = 4;

/** Snapshot of one combatant to re-spawn on retry. */
export interface ArenaOpponentSpec {
  weaponId: WeaponId;
  boss?: boolean;
  scale?: number;
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
  timer: number;
  label: string;
  outcome: ArenaOutcome;
  canChoose: boolean;
  opponentLabel: string;
  allyLabel: string;
  mode: ArenaMode;
  modeLabel: string;
  round: number;
  livingEnemies: number;
  livingAllies: number;
  skillCue: string;
  bars: ArenaFighterHudBar[];
  /** FFA: player kill count. */
  playerKills: number;
  /** FFA: deaths / field kills against player (aggregate). */
  fieldKills: number;
  /** FFA kill goal (default 10). */
  killGoal: number;
}

const COUNTDOWN_SEC = 3;
const RESULT_SEC = 2.4;

/**
 * Arena floor priority for classic 1v1/2v2.
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

/**
 * Ultimate Assassination Grounds — FFA battleground (R2).
 * Local stage: artifacts/animator/public/models/maps/ (gitignored preferred).
 */
export const ASSASSINATION_MAP_PATHS = [
  "models/maps/ultimate_assasination_grounds.glb",
  "models/maps/ultimate_assassination_grounds.glb",
  "models/ultimate_assasination_grounds.glb",
] as const;

/** Default loadouts per mode. */
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
  if (mode === "ffa4") {
    // 3 AI explorers with varied weapon skills (player is 4th)
    return {
      enemies: [
        { weaponId: "sword", role: "duelist" },
        { weaponId: "greatsword", role: "bruiser" },
        { weaponId: "gunblade", role: "skirmisher" },
      ],
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
  private playerKills = 0;
  private fieldKills = 0;
  private killGoal = FFA_KILL_GOAL;

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

  get isFfa(): boolean {
    return this.mode === "ffa4";
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

  start(
    mode: ArenaMode,
    enemies?: ArenaOpponentSpec[],
    allies?: ArenaOpponentSpec[],
    opts?: { killGoal?: number },
  ): void {
    this.mode = mode;
    this.killGoal = opts?.killGoal ?? FFA_KILL_GOAL;
    const def = defaultArenaLoadout(mode);
    this.enemies = (enemies?.length ? enemies : def.enemies).map((o) => ({ ...o }));
    this.allies = (allies ?? def.allies).map((o) => ({ ...o }));
    if (mode === "1v1" || mode === "ffa4") this.allies = [];
    if (!this.enemies.length) return;
    this.round = 0;
    this.outcome = null;
    this.skillCue = "";
    this.skillCueT = 0;
    this.bars = [];
    this.playerKills = 0;
    this.fieldKills = 0;
    this.beginCountdown();
  }

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
    this.playerKills = 0;
    this.fieldKills = 0;
  }

  retry(): { enemies: ArenaOpponentSpec[]; allies: ArenaOpponentSpec[]; mode: ArenaMode } {
    if (this.phase !== "choice" && this.phase !== "result") {
      return { enemies: [], allies: [], mode: this.mode };
    }
    this.outcome = null;
    this.skillCue = "";
    this.skillCueT = 0;
    this.playerKills = 0;
    this.fieldKills = 0;
    this.beginCountdown();
    return {
      enemies: this.enemies.map((o) => ({ ...o })),
      allies: this.allies.map((o) => ({ ...o })),
      mode: this.mode,
    };
  }

  returnToRoom(): void {
    this.stop();
  }

  pushSkillCue(text: string, holdSec = 1.1): void {
    if (!text) return;
    this.skillCue = text;
    this.skillCueT = holdSec;
  }

  setHudLive(opts: {
    livingEnemies: number;
    livingAllies: number;
    bars?: ArenaFighterHudBar[];
  }): void {
    this.livingEnemies = Math.max(0, opts.livingEnemies);
    this.livingAllies = Math.max(0, opts.livingAllies);
    if (opts.bars) this.bars = opts.bars;
  }

  /**
   * FFA: player scored a kill (enemy downed).
   * Returns true if that hit the goal.
   */
  recordPlayerKill(): boolean {
    if (this.mode !== "ffa4" || this.phase !== "fighting") return false;
    this.playerKills += 1;
    this.pushSkillCue(`KILL ${this.playerKills}/${this.killGoal}`, 0.9);
    if (this.playerKills >= this.killGoal) {
      this.enterResult("win");
      return true;
    }
    return false;
  }

  /**
   * FFA: player was downed (field / AI score).
   * Returns true if field hit the goal.
   */
  recordPlayerDeath(): boolean {
    if (this.mode !== "ffa4" || this.phase !== "fighting") return false;
    this.fieldKills += 1;
    this.pushSkillCue(`DOWN · Field ${this.fieldKills}/${this.killGoal}`, 0.9);
    if (this.fieldKills >= this.killGoal) {
      this.enterResult("lose");
      return true;
    }
    return false;
  }

  private beginCountdown(): void {
    this.round += 1;
    this.phase = "countdown";
    this.timer = COUNTDOWN_SEC;
    this.label = String(COUNTDOWN_SEC);
    this.outcome = null;
  }

  /**
   * Advance timers.
   * Classic: playerDefeated or livingEnemies==0 ends match.
   * FFA: score-driven; playerDefeated is ignored (host respawns + recordPlayerDeath).
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
        if (this.timer > 0.85) {
          this.label =
            this.mode === "ffa4"
              ? `${this.playerKills}–${this.fieldKills} · FIRST TO ${this.killGoal}`
              : "";
        }
      } else if (this.mode === "ffa4") {
        this.label = `${this.playerKills}–${this.fieldKills} · FIRST TO ${this.killGoal}`;
      }

      if (this.mode === "ffa4") {
        // Score handled via recordPlayerKill / recordPlayerDeath
        return {};
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
    if (this.mode === "ffa4") {
      this.label =
        outcome === "win"
          ? `FIRST TO ${this.killGoal} · YOU WIN`
          : `FIRST TO ${this.killGoal} · DEFEAT`;
    } else {
      this.label = outcome === "win" ? "VICTORY" : "DEFEAT";
    }
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
      allyLabel: this.mode === "ffa4" ? "FFA · no allies" : formatAllies(this.allies),
      mode: this.mode,
      modeLabel:
        this.mode === "1v1"
          ? "1v1 DUEL"
          : this.mode === "2v2"
            ? "2v2 TEAM"
            : `FFA ×${FFA_MAX_PLAYERS} · TO ${this.killGoal}`,
      round: this.round,
      livingEnemies: this.livingEnemies,
      livingAllies: this.livingAllies,
      skillCue: this.skillCue,
      bars: this.bars.slice(),
      playerKills: this.playerKills,
      fieldKills: this.fieldKills,
      killGoal: this.killGoal,
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
