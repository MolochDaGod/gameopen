/**
 * Pure cinema timeline — no WebGL. Drives beat index, captions, skip policy.
 * Used by ProductionCinemaScene and unit tests.
 */
import type { CinemaBeat, CinemaManifest, CinemaTimelineState } from "./types";

export class CinemaTimeline {
  private time = 0;
  private finished = false;
  private waitingContinue = false;

  constructor(private readonly manifest: CinemaManifest) {}

  get duration(): number {
    return this.manifest.durationSec;
  }

  get isLoop(): boolean {
    return this.manifest.loop;
  }

  reset(): void {
    this.time = 0;
    this.finished = false;
    this.waitingContinue = false;
  }

  /** Advance by dt seconds. Returns current state. */
  update(dt: number): CinemaTimelineState {
    if (this.finished && !this.manifest.loop) {
      return this.snapshot();
    }
    if (!this.waitingContinue) {
      this.time += Math.max(0, dt);
    }

    if (this.manifest.loop && this.time >= this.manifest.durationSec) {
      this.time = this.time % Math.max(this.manifest.durationSec, 0.001);
    } else if (!this.manifest.loop && this.time >= this.manifest.durationSec) {
      this.time = this.manifest.durationSec;
      this.finished = true;
    }

    const beat = this.currentBeat();
    if (beat?.waitContinue && !this.finished) {
      const local = this.time - beat.t;
      if (local >= beat.hold) this.waitingContinue = true;
    } else {
      this.waitingContinue = false;
    }

    return this.snapshot();
  }

  /** Player skip — jumps to end (linear) or next cycle (loop). */
  skip(): CinemaTimelineState {
    if (this.time < this.manifest.skippableAfterSec) {
      return this.snapshot();
    }
    if (this.manifest.loop) {
      this.time = 0;
      this.waitingContinue = false;
    } else {
      this.time = this.manifest.durationSec;
      this.finished = true;
      this.waitingContinue = false;
    }
    return this.snapshot();
  }

  /** Resolve waitContinue beat. */
  continue(): CinemaTimelineState {
    this.waitingContinue = false;
    const beat = this.currentBeat();
    if (beat) {
      // Jump just past this beat's window so the next beat can start.
      this.time = Math.max(this.time, beat.t + beat.hold + 0.001);
    }
    return this.snapshot();
  }

  currentBeat(): CinemaBeat | null {
    const beats = this.manifest.beats;
    if (!beats.length) return null;
    let active = beats[0]!;
    for (const b of beats) {
      if (b.t <= this.time) active = b;
      else break;
    }
    return active;
  }

  beatIndex(): number {
    const beats = this.manifest.beats;
    let idx = 0;
    for (let i = 0; i < beats.length; i++) {
      if (beats[i]!.t <= this.time) idx = i;
    }
    return idx;
  }

  snapshot(): CinemaTimelineState {
    const beat = this.currentBeat();
    return {
      time: this.time,
      beatIndex: this.beatIndex(),
      beat,
      finished: this.finished,
      caption: beat?.caption ?? "",
      sub: beat?.sub ?? "",
      canSkip: this.time >= this.manifest.skippableAfterSec,
    };
  }
}

/** Validate a manifest for production deploy (structure only). */
export function validateCinemaManifest(m: CinemaManifest): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!m.id) errors.push("id");
  if (!m.beats?.length) errors.push("beats empty");
  if (m.durationSec <= 0) errors.push("durationSec");
  let prevT = -1;
  for (const b of m.beats ?? []) {
    if (b.t < prevT) errors.push(`beat t out of order at ${b.t}`);
    if (b.hold < 0) errors.push(`negative hold at t=${b.t}`);
    prevT = b.t;
    if (b.cam) {
      if (b.cam.pos.length !== 3 || b.cam.look.length !== 3) {
        errors.push(`bad cam at t=${b.t}`);
      }
    }
  }
  for (const a of m.assets ?? []) {
    if (!a.meshKeys?.length) errors.push("asset without meshKeys");
  }
  return { ok: errors.length === 0, errors };
}
