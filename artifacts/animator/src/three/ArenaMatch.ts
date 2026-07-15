/**
 * Player-vs-NPC arena match state machine for the Danger Room.
 *
 * Flow:
 *   idle → countdown (3…2…1…FIGHT) → fighting → result (2s WIN/LOSE banner)
 *        → choice (Retry | Return to Danger Room)
 *
 * Retry restarts the same opponent loadout. Return clears those opponents so
 * free roam continues with no more fights vs that matchup.
 */
import type { WeaponId } from "./types";

export type ArenaPhase = "idle" | "countdown" | "fighting" | "result" | "choice";

export type ArenaOutcome = "win" | "lose" | null;

/** Snapshot of one opponent to re-spawn on retry. */
export interface ArenaOpponentSpec {
  weaponId: WeaponId;
  /** Boss archetype when true. */
  boss?: boolean;
  scale?: number;
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
  round: number;
}

const COUNTDOWN_SEC = 3;
const RESULT_SEC = 2;

export class ArenaMatch {
  private phase: ArenaPhase = "idle";
  private timer = 0;
  private outcome: ArenaOutcome = null;
  private round = 0;
  private opponents: ArenaOpponentSpec[] = [];
  private label = "";

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

  /** Begin a match against the given opponent specs (must be non-empty). */
  start(opponents: ArenaOpponentSpec[]): void {
    if (!opponents.length) return;
    this.opponents = opponents.map((o) => ({ ...o }));
    this.round = 0;
    this.outcome = null;
    this.beginCountdown();
  }

  /** Abort completely and return to free roam (caller clears NPCs). */
  stop(): void {
    this.phase = "idle";
    this.timer = 0;
    this.outcome = null;
    this.label = "";
    this.opponents = [];
    this.round = 0;
  }

  /** Restart same opponents after result choice. */
  retry(): ArenaOpponentSpec[] {
    if (this.phase !== "choice" && this.phase !== "result") return [];
    this.outcome = null;
    this.beginCountdown();
    return this.opponents.map((o) => ({ ...o }));
  }

  /** Leave match after result — free roam, no more fights vs this loadout. */
  returnToRoom(): void {
    this.stop();
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
   * Returns events the Studio should react to (AI freeze/release, spawn, etc.).
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
      // Brief FIGHT flash, then clear
      return { releasedFight: true };
    }

    if (this.phase === "fighting") {
      // Clear the "FIGHT!" flash after a beat
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

    // result → choice after RESULT_SEC
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
      opponentLabel: formatOpponents(this.opponents),
      round: this.round,
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
