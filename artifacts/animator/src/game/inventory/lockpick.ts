/**
 * Lockpick skill-check (native web — not Skyrim SWF).
 * Used for foreign camp steal, hidden chests, hidden treasure.
 *
 * Design language: Kenney Lockpick Pro style (CC-BY settings reference only).
 * Runtime: pure math + optional UI panel; host fires via ScriptRunner open-ui.
 */

export type LockpickTargetKind =
  | "camp"
  | "hidden_chest"
  | "hidden_treasure"
  | "door"
  | "container";

export interface LockpickChallenge {
  /** Location storage id or prop id. */
  targetId: string;
  kind: LockpickTargetKind;
  /** Difficulty 0–100 (matches LocationStorageState.lockDifficulty). */
  difficulty: number;
  /** Display name. */
  label: string;
  /** Optional owner for anti-own-steal. */
  ownerAccountId?: string | null;
  /** Sweet-spot width on the dial (radians half-width). Tighter when harder. */
  sweetHalfWidth?: number;
  /** Random seed for determinism in tests. */
  seed?: number;
}

export interface LockpickSession {
  challenge: LockpickChallenge;
  /** Target angle on dial 0..2π. */
  sweetAngle: number;
  sweetHalfWidth: number;
  /** Attempts left before lock jams. */
  attemptsLeft: number;
  maxAttempts: number;
  /** Current pin angle (player control). */
  pinAngle: number;
  status: "active" | "success" | "failed" | "cancelled";
  /** 0–1 progress when holding in sweet zone. */
  holdProgress: number;
  startedAt: number;
}

export interface LockpickResult {
  ok: boolean;
  reason: "success" | "failed" | "cancelled" | "own_storage" | "unlocked";
  message: string;
  targetId: string;
  kind: LockpickTargetKind;
}

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Map difficulty → sweet zone half-width + attempts. */
export function lockpickParams(difficulty: number): {
  sweetHalfWidth: number;
  maxAttempts: number;
  holdSec: number;
} {
  const d = Math.max(0, Math.min(100, difficulty));
  // Easy wide zone (~0.45 rad), hard narrow (~0.08)
  const sweetHalfWidth = 0.45 - (d / 100) * 0.37;
  const maxAttempts = d >= 70 ? 2 : d >= 40 ? 3 : 4;
  const holdSec = 0.55 + (d / 100) * 0.45;
  return { sweetHalfWidth, maxAttempts, holdSec };
}

export function createLockpickSession(
  challenge: LockpickChallenge,
): LockpickSession {
  const p = lockpickParams(challenge.difficulty);
  const rand = mulberry32(
    (challenge.seed ??
      Math.floor(Date.now() % 1e9) +
        challenge.targetId.split("").reduce((s, c) => s + c.charCodeAt(0), 0)) |
      0,
  );
  const sweetAngle = rand() * Math.PI * 2;
  return {
    challenge: {
      ...challenge,
      sweetHalfWidth: challenge.sweetHalfWidth ?? p.sweetHalfWidth,
    },
    sweetAngle,
    sweetHalfWidth: challenge.sweetHalfWidth ?? p.sweetHalfWidth,
    attemptsLeft: p.maxAttempts,
    maxAttempts: p.maxAttempts,
    pinAngle: 0,
    status: "active",
    holdProgress: 0,
    startedAt: Date.now(),
  };
}

/** Angular distance on circle. */
export function angleDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

export function pinInSweetZone(session: LockpickSession): boolean {
  return (
    angleDelta(session.pinAngle, session.sweetAngle) <= session.sweetHalfWidth
  );
}

/**
 * Tick while player holds interact / mouse in sweet zone.
 * dt in seconds; holdSec from difficulty.
 */
export function tickLockpickHold(
  session: LockpickSession,
  dt: number,
  holding: boolean,
): LockpickSession {
  if (session.status !== "active") return session;
  const { holdSec } = lockpickParams(session.challenge.difficulty);
  if (!holding || !pinInSweetZone(session)) {
    return { ...session, holdProgress: Math.max(0, session.holdProgress - dt * 1.2) };
  }
  const next = session.holdProgress + dt / holdSec;
  if (next >= 1) {
    return {
      ...session,
      holdProgress: 1,
      status: "success",
    };
  }
  return { ...session, holdProgress: next };
}

/** Attempt tumble (space / click). Outside sweet zone costs an attempt. */
export function attemptLockpickTumble(
  session: LockpickSession,
): LockpickSession {
  if (session.status !== "active") return session;
  if (pinInSweetZone(session) && session.holdProgress >= 0.85) {
    return { ...session, status: "success", holdProgress: 1 };
  }
  if (pinInSweetZone(session)) {
    // Nudge progress on good click
    const next = Math.min(1, session.holdProgress + 0.35);
    if (next >= 1) {
      return { ...session, holdProgress: 1, status: "success" };
    }
    return { ...session, holdProgress: next };
  }
  const left = session.attemptsLeft - 1;
  if (left <= 0) {
    return { ...session, attemptsLeft: 0, status: "failed", holdProgress: 0 };
  }
  return { ...session, attemptsLeft: left, holdProgress: 0 };
}

export function setLockpickPinAngle(
  session: LockpickSession,
  angle: number,
): LockpickSession {
  if (session.status !== "active") return session;
  let a = angle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return { ...session, pinAngle: a };
}

export function cancelLockpick(session: LockpickSession): LockpickSession {
  if (session.status !== "active") return session;
  return { ...session, status: "cancelled" };
}

export function lockpickResultFromSession(
  session: LockpickSession,
): LockpickResult {
  const { challenge } = session;
  if (session.status === "success") {
    return {
      ok: true,
      reason: "success",
      message: `Lock picked · ${challenge.label}`,
      targetId: challenge.targetId,
      kind: challenge.kind,
    };
  }
  if (session.status === "failed") {
    return {
      ok: false,
      reason: "failed",
      message: `Lock jammed · ${challenge.label}`,
      targetId: challenge.targetId,
      kind: challenge.kind,
    };
  }
  return {
    ok: false,
    reason: "cancelled",
    message: "Lockpick cancelled",
    targetId: challenge.targetId,
    kind: challenge.kind,
  };
}

/**
 * Instant skill check (no UI) — for server-side / AI / tests.
 * successChance = clamp(skill - difficulty + 50, 5, 95) / 100
 */
export function rollLockpickInstant(opts: {
  difficulty: number;
  skillLevel?: number;
  rand?: () => number;
}): boolean {
  const skill = opts.skillLevel ?? 1;
  const d = opts.difficulty;
  const chance = Math.max(0.05, Math.min(0.95, (skill * 2 - d + 50) / 100));
  const r = opts.rand ?? Math.random;
  return r() < chance;
}
