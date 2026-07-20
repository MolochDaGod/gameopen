import * as THREE from "three";
import { musicStation } from "./musicStation";

// Combat SFX library (self-hosted .wav one-shots). The engine forbids
// `@workspace/*` imports; these `@assets/*` URLs resolve to bundled audio files.
import kickLongWhoosh from "@assets/kick_long_whoosh_19_1781882547201.wav";
import metalPunchFinisher from "@assets/metal_punch_finisher_07_1781882547201.wav";
import punchLongWhoosh from "@assets/punch_long_whoosh_30_1781882547202.wav";
import punchShortWhoosh from "@assets/punch_short_whoosh_30_1781882547202.wav";
import somersault from "@assets/somersault_10_1781882547203.wav";
import woodBatFinisher from "@assets/wood_bat_finisher_05_1781882547203.wav";
import bladeHit07 from "@assets/blade_hit_07_1781882547204.wav";
import bladeHit08 from "@assets/blade_hit_08_1781882547204.wav";
import blockLarge59 from "@assets/block_large_59_1781882547205.wav";
import blockLarge71 from "@assets/block_large_71_1781882547205.wav";
import blockMedium09 from "@assets/block_medium_09_1781882547206.wav";
import blockMedium25 from "@assets/block_medium_25_1781882547206.wav";
import blockSmall69 from "@assets/block_small_69_1781882547206.wav";
import blockSmall73 from "@assets/block_small_73_1781882547207.wav";
import bodyHitFinisher from "@assets/body_hit_finisher_23_1781882547207.wav";
import bodyHitSmall11 from "@assets/body_hit_small_11_1781882547207.wav";
import bodyHitSmall79 from "@assets/body_hit_small_79_1781882547208.wav";
import boneBreaking from "@assets/bone_breaking_53_1781882547208.wav";
import faceHitLarge from "@assets/face_hit_Large_78_1781882547208.wav";
import faceHitSmall from "@assets/face_hit_small_78_1781882547209.wav";

/** A logical sound bucket; each maps to one or more clip variations picked at
 * random for variety. */
export type SfxCategory =
  | "whooshLight"
  | "whooshHeavy"
  | "bladeHit"
  | "bodyHit"
  | "heavyHit"
  | "boneBreak"
  | "block"
  | "somersault";

const SOURCES: Record<SfxCategory, readonly string[]> = {
  // Pool every air-swing clip into both buckets so consecutive combo cuts pick a
  // different "slash" — with the per-play rate jitter this reads as slash 1..N.
  whooshLight: [punchShortWhoosh, punchLongWhoosh, kickLongWhoosh],
  whooshHeavy: [kickLongWhoosh, punchLongWhoosh],
  bladeHit: [bladeHit07, bladeHit08],
  bodyHit: [bodyHitSmall11, bodyHitSmall79, faceHitSmall],
  heavyHit: [bodyHitFinisher, faceHitLarge, metalPunchFinisher, woodBatFinisher],
  boneBreak: [boneBreaking],
  block: [blockSmall69, blockSmall73, blockMedium09, blockMedium25, blockLarge59, blockLarge71],
  somersault: [somersault],
};

interface PlayOpts {
  /** Linear gain multiplier (0..1+). Default 1. */
  volume?: number;
  /** Playback-rate multiplier; small jitter is added on top for variety. */
  rate?: number;
}

interface Ambient {
  src: AudioBufferSourceNode;
  /** Tone-shaping lowpass; its cutoff is the bed's per-environment character. */
  lp: BiquadFilterNode;
  panLfo: OscillatorNode | null;
  breathLfo: OscillatorNode;
  /** Bed level, modulated by the breath LFO. */
  bedGain: GainNode;
  /** Depth of the breath modulation (scaled with the bed level). */
  breathDepth: GainNode;
  /** Post-mix master gain — the single point muting hard-zeroes. */
  master: GainNode;
}

/**
 * Per-environment ambient-bed character. `cutoff` shapes the bed's tone (lower =
 * darker rumble), `gain` multiplies the default bed level, and `drift` is the
 * slow stereo-pan rate. The Danger Room pushes one of these per room preset.
 */
export interface AmbientProfile {
  cutoff: number;
  gain: number;
  drift: number;
}

/** The original bed character — used until a room preset overrides it. */
const DEFAULT_AMBIENT: AmbientProfile = { cutoff: 420, gain: 1, drift: 0.05 };

/**
 * Fixed base gains tuned so a user level of 1.0 reproduces the original mix.
 * The user-facing mixer levels (0..1) multiply these — and the master level
 * multiplies every bucket on top.
 */
export const COMBAT_BASE = 0.9;
export const AMBIENT_BASE = 0.05;
/** Music sits softly under the action; level 1.0 = this gentle default. */
export const MUSIC_BASE = 0.12;

/**
 * The effective linear gain for a bucket: base × category level × master level.
 * Muting hard-zeroes the result regardless of the levels — silence is absolute.
 */
export function effectiveGain(base: number, level: number, master: number, muted = false): number {
  if (muted) return 0;
  return base * level * master;
}

/** User-tunable mixer levels (0..1). */
export interface SoundLevels {
  /** Scales every category. */
  master: number;
  /** Combat one-shot impacts/whooshes/blocks. */
  combat: number;
  /** Ambient room bed. */
  ambient: number;
  /** Low-integrity warning klaxon. */
  klaxon: number;
  /** Background music bed. */
  music: number;
}

interface Klaxon {
  /** The alarm tone, pitch-warbled by an LFO. */
  osc: OscillatorNode;
  /** Square LFO that swings the pitch between two tones (the "klaxon" warble). */
  pitchLfo: OscillatorNode;
  /** LFO pulsing the amplitude so the alarm throbs rather than drones. */
  ampLfo: OscillatorNode;
  /** Tremolo gain (center level ± pulse), feeds the master. */
  ampGain: GainNode;
  /** Depth of the tremolo modulation (scaled with the center level). */
  ampDepth: GainNode;
  /** Post-mix master gain — hard-zeroed when off or muted (mirrors ambient). */
  master: GainNode;
}

/**
 * Klaxon parameter envelope keyed by escalation intensity (0 = just-critical,
 * 1 = about to break). The alarm warbles faster, pitches higher, throbs harder,
 * and gets louder as integrity drops toward zero.
 */
const KLAXON_CALM = { warble: 2.4, pitch: 560, tremolo: 5.5, level: 0.13 };
const KLAXON_FRANTIC = { warble: 5.8, pitch: 840, tremolo: 9.5, level: 0.26 };

interface Music {
  /** Sum of all note envelopes — the dry voice bus. */
  bus: GainNode;
  /** Mellowing lowpass so the synth pad never gets harsh. */
  filter: BiquadFilterNode;
  /** Feedback delay tap that gives the pad some space/echo. */
  delay: DelayNode;
  /** Echo feedback amount. */
  feedback: GainNode;
  /** MUSIC_BASE × music × master — what the mixer slider drives. */
  level: GainNode;
  /** Post-mix master gain — hard-zeroed when muted (mirrors ambient/klaxon). */
  master: GainNode;
  /** Live oscillators per scheduled note (cleaned up after release). */
  voices: Set<OscillatorNode>;
  /** Self-rescheduling lookahead scheduler handle. */
  timer: ReturnType<typeof setTimeout> | null;
  /** ctx time of the next note to schedule. */
  nextNoteTime: number;
  /** Monotonic note counter driving the chord/arpeggio position. */
  step: number;
  /** Current spacing (s) between beats — shrinks as the set heats up. */
  noteDur: number;
}

/**
 * A snapshot of the live music bed used to drive diegetic actors (the resident
 * DJ) so their motion reads as synced to the actual soundtrack rather than a
 * private timer. `intensity` is the smoothed combat heat (0 calm .. 1 peak),
 * `beat` is a monotonic note counter, and `beatPhase` is how far through the
 * current beat we are (0 at each onset .. 1 just before the next).
 */
export interface MusicPulse {
  intensity: number;
  beat: number;
  beatPhase: number;
}

/**
 * Gentle generative background-music bed: a slow arpeggio cycling a four-chord
 * minor progression through a soft lowpass + echo. Synthesized in WebAudio (no
 * asset, mirroring the klaxon) and routed through the same level/mute plumbing
 * as the rest of the mixer so pilots can balance music against the action.
 */
const MUSIC_ROOTS = [110, 87.31, 130.81, 98] as const; // A2, F2, C3, G2
const MUSIC_CHORDS = [
  [0, 3, 7, 12], // Am
  [0, 4, 7, 12], // F
  [0, 4, 7, 12], // C
  [0, 4, 7, 12], // G
] as const;
/** Notes per chord (one arpeggio sweep before the progression advances). */
const MUSIC_NOTES_PER_CHORD = 8;
/** Seconds between scheduled notes (slow, ambient tempo). */
const MUSIC_NOTE_DUR = 0.55;
/** How far ahead (s) to schedule notes; the timer fires ~4× per window. */
const MUSIC_SCHEDULE_AHEAD = 0.25;

/**
 * Music feel envelope keyed by combat intensity (0 = idle/between fights,
 * 1 = peak combat). As a fight heats up the bed quickens (shorter note spacing),
 * brightens (higher lowpass cutoff), and swells (louder note peaks) — and an
 * octave-up shimmer layers in past the midpoint to thicken it. It eases back to
 * the calm loop when the action settles. Loudness still rides the mixer level.
 */
const MUSIC_CALM = { noteDur: MUSIC_NOTE_DUR, cutoff: 1300, peak: 0.5 };
const MUSIC_FRANTIC = { noteDur: 0.3, cutoff: 3000, peak: 0.72 };

/**
 * Spatial combat sound system for the Danger Room. Plays positional one-shot
 * impacts/whooshes through a {@link THREE.AudioListener} mounted on the camera
 * (so hits pan/attenuate with where they happen in the scene), plus a soft,
 * gently-drifting ambient noise bed that fills the room underneath the action.
 *
 * Browsers suspend the audio context until a user gesture, so {@link resume}
 * must be called from a click/key handler before anything is audible.
 */
export class CombatSfx {
  readonly listener: THREE.AudioListener;
  private readonly ctx: AudioContext;
  private readonly scene: THREE.Scene;
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Round-robin pool of positional emitters reused across one-shots. */
  private readonly pool: THREE.PositionalAudio[] = [];
  private poolIdx = 0;
  private ready = false;
  private disposed = false;
  private muted = false;
  /** User mixer levels (0..1). master scales every bucket; rest are per-bucket. */
  private levels: SoundLevels = { master: 1, combat: 1, ambient: 1, klaxon: 1, music: 1 };
  private ambient: Ambient | null = null;
  /** Active ambient-bed character (per room preset); defaults to the original. */
  private ambientProfile: AmbientProfile = { ...DEFAULT_AMBIENT };
  /** Generative background music bed (lazy synth loop); null until started. */
  private music: Music | null = null;
  /** Warning klaxon (lazy synth loop); null until first requested. */
  private klaxon: Klaxon | null = null;
  /** Whether the klaxon is currently requested on (independent of mute). */
  private klaxonOn = false;
  /** Escalation intensity 0..1 (0 = just-critical, 1 = about to break). */
  private klaxonIntensity = 0;
  /** Smoothed combat-music intensity 0..1 (eased toward the target each tick). */
  private musicIntensity = 0;
  /** Requested combat-music intensity 0..1 (0 = calm/idle, 1 = peak fight). */
  private musicIntensityTarget = 0;
  /** Spatial emitter the music bed plays out of (the DJ booth); null = flat. */
  private musicEmitter: THREE.PositionalAudio | null = null;
  /** Where to emit the music spatially, if anywhere. Applied once music starts. */
  private musicEmitterPos: THREE.Vector3 | null = null;

  constructor(camera: THREE.Camera, scene: THREE.Scene, poolSize = 14) {
    this.scene = scene;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = this.listener.context;

    for (let i = 0; i < poolSize; i++) {
      const holder = new THREE.Object3D();
      scene.add(holder);
      const pa = new THREE.PositionalAudio(this.listener);
      pa.setRefDistance(4);
      pa.setRolloffFactor(1);
      pa.setMaxDistance(45);
      pa.setDistanceModel("exponential");
      holder.add(pa);
      this.pool.push(pa);
    }

    void this.load();
  }

  private async load(): Promise<void> {
    const loader = new THREE.AudioLoader();
    const urls = Array.from(new Set(Object.values(SOURCES).flat()));
    await Promise.all(
      urls.map(async (url) => {
        try {
          const buf = await loader.loadAsync(url);
          this.buffers.set(url, buf);
        } catch (err) {
          console.warn("[CombatSfx] failed to load", url, err);
        }
      }),
    );
    if (this.disposed) return;
    this.ready = true;
    this.startAmbient();
    // Prefer app-wide CPT RAC / radio (real MP3s). Generative synth only if
    // the station has no playlist yet.
    if (!musicStation.isActive()) this.startMusic();
  }

  /** Resume the audio context (call from a user-gesture handler). */
  resume(): void {
    // "interrupted" is mobile-Safari's suspended-equivalent after a phone call etc.
    if (this.ctx.state === "suspended" || (this.ctx.state as string) === "interrupted") {
      void this.ctx.resume();
    }
    // Keep the persistent station alive across mode rebuilds / gesture gates.
    musicStation.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    // Hard-zero the post-mix master so the breath LFO can't bleed around the bed
    // gain — muting must be absolute silence.
    if (this.ambient) this.ambient.master.gain.value = muted ? 0 : 1;
    // The music bed respects the same mute control.
    if (this.music) this.music.master.gain.value = muted ? 0 : 1;
    musicStation.setMuted(muted);
    // The klaxon respects the same mute control.
    this.applyKlaxonGain();
  }

  /**
   * Update the user mixer levels (0..1). Combat one-shots read the level at play
   * time; the ambient bed and klaxon are re-applied live. Muting is unaffected —
   * it still hard-silences everything, and unmuting restores these levels.
   */
  setLevels(levels: Partial<SoundLevels>): void {
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    if (levels.master != null) this.levels.master = clamp(levels.master);
    if (levels.combat != null) this.levels.combat = clamp(levels.combat);
    if (levels.ambient != null) this.levels.ambient = clamp(levels.ambient);
    if (levels.klaxon != null) this.levels.klaxon = clamp(levels.klaxon);
    if (levels.music != null) this.levels.music = clamp(levels.music);
    this.applyAmbientLevel();
    this.applyMusicLevel();
    // Keep the app-level station in lock-step with the mixer.
    musicStation.setLevel(this.levels.music, this.levels.master);
    // Klaxon level folds into the intensity envelope.
    this.applyKlaxonIntensity();
  }

  /**
   * The effective ambient bed level: the default base scaled by the active
   * profile's gain, then through the mixer's ambient × master levels. Folding the
   * profile gain in here means the per-environment loudness still rides the mixer
   * and is hard-zeroed by mute (the post-mix master handles that separately).
   */
  private ambientBedLevel(): number {
    return effectiveGain(AMBIENT_BASE * this.ambientProfile.gain, this.levels.ambient, this.levels.master);
  }

  /** Push the current bed level onto the live bed gain + breath depth. */
  private applyAmbientLevel(): void {
    if (!this.ambient) return;
    const base = this.ambientBedLevel();
    const now = this.ctx.currentTime;
    // The breath LFO modulates around bedGain.gain; set the center + its depth.
    this.ambient.bedGain.gain.setTargetAtTime(base, now, 0.05);
    this.ambient.breathDepth.gain.setTargetAtTime(base * 0.4, now, 0.05);
  }

  /**
   * Switch the ambient bed's per-environment character (tone, level and stereo
   * drift). Applied live to the running bed when present, and remembered so a
   * not-yet-started bed picks it up. Loudness still rides the mixer/mute via
   * {@link applyAmbientLevel}, so this respects the master-gain + mute controls.
   */
  setAmbientProfile(profile: Partial<AmbientProfile>): void {
    if (profile.cutoff != null) this.ambientProfile.cutoff = profile.cutoff;
    if (profile.gain != null) this.ambientProfile.gain = profile.gain;
    if (profile.drift != null) this.ambientProfile.drift = profile.drift;
    const a = this.ambient;
    if (a) {
      const now = this.ctx.currentTime;
      a.lp.frequency.setTargetAtTime(this.ambientProfile.cutoff, now, 0.15);
      a.panLfo?.frequency.setTargetAtTime(this.ambientProfile.drift, now, 0.15);
    }
    this.applyAmbientLevel();
  }

  /** Push the current master×music level onto the live music bus gain. */
  private applyMusicLevel(): void {
    if (!this.music) return;
    const base = MUSIC_BASE * this.levels.music * this.levels.master;
    this.music.level.gain.setTargetAtTime(base, this.ctx.currentTime, 0.08);
  }

  /**
   * Emit the generative music bed spatially from `pos` (the DJ booth) so it
   * reads as the resident DJ's live set, or pass `null` to play it flat. Reuses
   * the same positional-audio chain as the combat one-shots (a
   * {@link THREE.PositionalAudio} on the camera listener). Safe to call before
   * the music has started — it is re-applied when the bed is built.
   */
  setMusicSource(pos: THREE.Vector3 | null): void {
    this.musicEmitterPos = pos ? pos.clone() : null;
    if (this.musicEmitter && this.musicEmitterPos) {
      this.musicEmitter.parent?.position.copy(this.musicEmitterPos);
    }
    this.applyMusicRouting();
  }

  /**
   * Connect the music master to its output: a spatial booth emitter when a
   * source position is set, otherwise flat to the destination. Spatial routing
   * falls back to flat on any failure so the music can never go silent.
   */
  private applyMusicRouting(): void {
    const m = this.music;
    if (!m) return; // re-applied from startMusic once the bed exists
    try {
      m.master.disconnect();
    } catch {
      // nothing connected yet
    }
    if (this.musicEmitterPos) {
      if (!this.musicEmitter) {
        try {
          const holder = new THREE.Object3D();
          this.scene.add(holder);
          const pa = new THREE.PositionalAudio(this.listener);
          // Gentle rolloff: audible across the room but clearly centred on the booth.
          pa.setRefDistance(10);
          pa.setRolloffFactor(0.7);
          pa.setMaxDistance(70);
          pa.setDistanceModel("exponential");
          holder.add(pa);
          this.musicEmitter = pa;
        } catch {
          this.musicEmitter = null;
        }
      }
      if (this.musicEmitter) {
        this.musicEmitter.parent?.position.copy(this.musicEmitterPos);
        try {
          this.musicEmitter.setNodeSource(m.master);
          return;
        } catch {
          // fall through to flat routing
        }
      }
    }
    m.master.connect(this.ctx.destination);
  }

  /**
   * Snapshot the live music bed for diegetic actors (the DJ) to sync to, or
   * `null` when the bed isn't running yet. Prefers the app-level CPT RAC Station
   * pulse when that station is active (same as controll lab).
   */
  getMusicPulse(): MusicPulse | null {
    // Live DJ / radio station pulse when real tracks are playing.
    if (musicStation.isActive()) {
      const p = musicStation.getPulse();
      if (p) return p;
    }
    const m = this.music;
    if (!m) return null;
    const dur = m.noteDur > 1e-4 ? m.noteDur : MUSIC_NOTE_DUR;
    const lastOnset = m.nextNoteTime - dur;
    const phase = Math.max(0, Math.min(1, (this.ctx.currentTime - lastOnset) / dur));
    return { intensity: this.musicIntensity, beat: m.step, beatPhase: phase };
  }

  /**
   * Drive the background music's combat intensity (0 = calm/idle, 1 = peak fight).
   * The bed quickens, brightens, swells, and layers up as the value rises, and
   * eases back as it falls — but the mixer level/mute still governs loudness.
   * The value is eased toward inside the scheduler, so callers can push it raw.
   */
  setMusicIntensity(intensity: number): void {
    this.musicIntensityTarget = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Build and start the generative background-music bed — a slow arpeggio over a
   * four-chord minor progression, softened by a lowpass and a feedback echo.
   * Synthesized in WebAudio (no asset), looped via a self-rescheduling lookahead
   * scheduler, and silenced by {@link setMuted}.
   */
  private startMusic(): void {
    if (this.music || this.disposed) return;
    const ctx = this.ctx;
    try {
      const bus = ctx.createGain();
      bus.gain.value = 1;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1300;

      // A short feedback delay gives the pad some air without a reverb node.
      const delay = ctx.createDelay(1);
      delay.delayTime.value = MUSIC_NOTE_DUR * 0.75;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.32;

      // Mixer-driven level, then a post-mix master that mute hard-zeroes.
      const level = ctx.createGain();
      level.gain.value = MUSIC_BASE * this.levels.music * this.levels.master;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;

      bus.connect(filter);
      filter.connect(level);
      // Wet echo tap (parallel to the dry path).
      filter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(level);
      level.connect(master);

      this.music = {
        bus,
        filter,
        delay,
        feedback,
        level,
        master,
        voices: new Set(),
        timer: null,
        nextNoteTime: ctx.currentTime + 0.1,
        step: 0,
        noteDur: MUSIC_NOTE_DUR,
      };
      // Route the master out — spatially from the DJ booth if one was set,
      // otherwise flat to the destination.
      this.applyMusicRouting();
      this.scheduleMusic();
    } catch {
      // Background music is non-essential; never let it break startup.
      this.music = null;
    }
  }

  /** Lookahead scheduler: queue any notes due within the next window, then
   * re-arm itself. Decoupled from the render loop so it keeps time precisely. */
  private scheduleMusic = (): void => {
    const m = this.music;
    if (!m || this.disposed) return;
    // Ease the live intensity toward its target so combat swells/settles smoothly
    // (~0.6s time constant at this ~8 Hz tick rate) instead of jumping.
    this.musicIntensity += (this.musicIntensityTarget - this.musicIntensity) * 0.18;
    const k = this.musicIntensity;
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const noteDur = lerp(MUSIC_CALM.noteDur, MUSIC_FRANTIC.noteDur);
    m.noteDur = noteDur;
    // Brighten the pad and keep the echo tap in step with the tempo as it heats up.
    const now = this.ctx.currentTime;
    m.filter.frequency.setTargetAtTime(lerp(MUSIC_CALM.cutoff, MUSIC_FRANTIC.cutoff), now, 0.2);
    m.delay.delayTime.setTargetAtTime(noteDur * 0.75, now, 0.2);
    while (m.nextNoteTime < now + MUSIC_SCHEDULE_AHEAD) {
      this.playMusicNote(m, m.step, m.nextNoteTime, noteDur, k);
      m.step++;
      m.nextNoteTime += noteDur;
    }
    m.timer = setTimeout(this.scheduleMusic, MUSIC_SCHEDULE_AHEAD * 1000 * 0.5);
  };

  /** Schedule one arpeggio note of the current chord at the given ctx time. The
   * tempo (`noteDur`) and combat intensity (`k`, 0..1) shape its swell/layering. */
  private playMusicNote(m: Music, step: number, at: number, noteDur: number, k: number): void {
    const chordIdx = Math.floor(step / MUSIC_NOTES_PER_CHORD) % MUSIC_CHORDS.length;
    const root = MUSIC_ROOTS[chordIdx];
    const chord = MUSIC_CHORDS[chordIdx];
    // Sweep up then down the chord tones for a gentle arpeggio.
    const arp = step % MUSIC_NOTES_PER_CHORD;
    const half = chord.length;
    const toneIdx = arp < half ? arp : MUSIC_NOTES_PER_CHORD - arp;
    const semis = chord[Math.max(0, Math.min(half - 1, toneIdx))];
    const freq = root * Math.pow(2, semis / 12);

    // Notes swell with intensity; release follows the live tempo so faster
    // arpeggios don't smear into one another.
    const peak = MUSIC_CALM.peak + (MUSIC_FRANTIC.peak - MUSIC_CALM.peak) * k;
    const release = noteDur * 1.6;
    this.spawnMusicVoice(m, freq, at, peak, release);

    // Past the midpoint, layer in an octave-up shimmer that grows with the heat
    // so peak combat reads thicker than the calm loop.
    const layer = Math.max(0, (k - 0.4) / 0.6);
    if (layer > 0.01) {
      this.spawnMusicVoice(m, freq * 2, at, peak * 0.4 * layer, release * 0.7);
    }
  }

  /** Spawn one enveloped triangle voice into the music bus and self-clean it. */
  private spawnMusicVoice(m: Music, freq: number, at: number, peak: number, release: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.value = 0;

    // Soft attack/decay envelope, peak well under 1 so overlapping tones blend.
    const attack = 0.04;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + attack);
    env.gain.exponentialRampToValueAtTime(0.001, at + attack + release);

    osc.connect(env);
    env.connect(m.bus);
    osc.start(at);
    osc.stop(at + attack + release + 0.05);
    m.voices.add(osc);
    osc.onended = () => {
      try {
        osc.disconnect();
        env.disconnect();
      } catch {
        /* already torn down */
      }
      m.voices.delete(osc);
    };
  }

  /**
   * Start/stop the low-integrity warning klaxon — a repeating two-tone alarm
   * synthesized in WebAudio (no asset). It loops continuously while on and is
   * silenced by {@link setMuted}. Driven by the mech cockpit's critical-integrity
   * condition (piloted + armour <= 25%).
   */
  setKlaxon(active: boolean, intensity = 0): void {
    if (this.disposed) return;
    this.klaxonOn = active;
    this.klaxonIntensity = Math.max(0, Math.min(1, intensity));
    if (active) this.ensureKlaxon();
    this.applyKlaxonGain();
    this.applyKlaxonIntensity();
  }

  /** Lazily build the klaxon node graph on first activation. */
  private ensureKlaxon(): void {
    if (this.klaxon) return;
    const ctx = this.ctx;
    try {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = KLAXON_CALM.pitch;

      // Square LFO swings the pitch up/down — the classic alarm two-tone warble.
      const pitchLfo = ctx.createOscillator();
      pitchLfo.type = "square";
      pitchLfo.frequency.value = KLAXON_CALM.warble;
      const pitchDepth = ctx.createGain();
      pitchDepth.gain.value = 150;
      pitchLfo.connect(pitchDepth);
      pitchDepth.connect(osc.frequency);

      // Tremolo so the alarm throbs instead of droning.
      const ampGain = ctx.createGain();
      ampGain.gain.value = KLAXON_CALM.level;
      const ampLfo = ctx.createOscillator();
      ampLfo.type = "sine";
      ampLfo.frequency.value = KLAXON_CALM.tremolo;
      const ampDepth = ctx.createGain();
      ampDepth.gain.value = KLAXON_CALM.level * 0.55;
      ampLfo.connect(ampDepth);
      ampDepth.connect(ampGain.gain);

      // Post-mix master, hard-zeroed when off/muted (mirrors the ambient bed).
      const master = ctx.createGain();
      master.gain.value = 0;

      osc.connect(ampGain);
      ampGain.connect(master);
      master.connect(ctx.destination);

      osc.start();
      pitchLfo.start();
      ampLfo.start();
      this.klaxon = { osc, pitchLfo, ampLfo, ampGain, ampDepth, master };
      // Snap the freshly-built graph to the current escalation level.
      this.applyKlaxonIntensity();
    } catch {
      // Synth alarm is non-essential; never let it break the frame.
      this.klaxon = null;
    }
  }

  /** Ramp the klaxon master to its on/off level, gated by mute. */
  private applyKlaxonGain(): void {
    if (!this.klaxon) return;
    const target = this.klaxonOn && !this.muted ? 1 : 0;
    const now = this.ctx.currentTime;
    const g = this.klaxon.master.gain;
    // Short ramp avoids clicks on start/stop.
    g.cancelScheduledValues(now);
    g.setTargetAtTime(target, now, 0.04);
  }

  /**
   * Ramp the klaxon's warble rate, pitch, throb rate, and volume toward the
   * current escalation intensity — so the alarm grows more frantic the closer
   * integrity is to zero. Smoothed to avoid audible steps as the value drifts.
   */
  private applyKlaxonIntensity(): void {
    if (!this.klaxon) return;
    const k = this.klaxonIntensity;
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const warble = lerp(KLAXON_CALM.warble, KLAXON_FRANTIC.warble);
    const pitch = lerp(KLAXON_CALM.pitch, KLAXON_FRANTIC.pitch);
    const tremolo = lerp(KLAXON_CALM.tremolo, KLAXON_FRANTIC.tremolo);
    const level = effectiveGain(lerp(KLAXON_CALM.level, KLAXON_FRANTIC.level), this.levels.klaxon, this.levels.master);
    const now = this.ctx.currentTime;
    const tc = 0.12;
    const { osc, pitchLfo, ampLfo, ampGain, ampDepth } = this.klaxon;
    osc.frequency.setTargetAtTime(pitch, now, tc);
    pitchLfo.frequency.setTargetAtTime(warble, now, tc);
    ampLfo.frequency.setTargetAtTime(tremolo, now, tc);
    ampGain.gain.setTargetAtTime(level, now, tc);
    ampDepth.gain.setTargetAtTime(level * 0.55, now, tc);
  }

  /** Play a positional one-shot from the given category at a world point. */
  play(category: SfxCategory, at: THREE.Vector3, opts: PlayOpts = {}): void {
    if (!this.ready || this.muted || this.disposed) return;
    const pool = SOURCES[category];
    const url = pool[(Math.random() * pool.length) | 0];
    const buffer = this.buffers.get(url);
    if (!buffer) return;

    // Round-robin to the next emitter, preferring an idle one.
    let pa: THREE.PositionalAudio | null = null;
    for (let i = 0; i < this.pool.length; i++) {
      const candidate = this.pool[(this.poolIdx + i) % this.pool.length];
      if (!candidate.isPlaying) {
        pa = candidate;
        this.poolIdx = (this.poolIdx + i + 1) % this.pool.length;
        break;
      }
    }
    if (!pa) {
      pa = this.pool[this.poolIdx];
      this.poolIdx = (this.poolIdx + 1) % this.pool.length;
    }

    pa.parent?.position.copy(at);
    if (pa.isPlaying) pa.stop();
    pa.setBuffer(buffer);
    const jitter = 0.92 + Math.random() * 0.16;
    pa.setPlaybackRate((opts.rate ?? 1) * jitter);
    pa.setVolume((opts.volume ?? 1) * effectiveGain(COMBAT_BASE, this.levels.combat, this.levels.master));
    pa.play();
  }

  /** Soft, slowly drifting ambient bed: filtered brown noise with a slow stereo
   * pan and a gentle gain "breath", kept well below the action. */
  private startAmbient(): void {
    const ctx = this.ctx;
    try {
      const seconds = 2;
      const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = this.ambientProfile.cutoff;

      // Bed level, "breathed" by an LFO. A separate master sits after it so mute
      // can hard-zero the output without fighting the LFO modulation.
      const bedGain = ctx.createGain();
      bedGain.gain.value = this.ambientBedLevel();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;

      // Slow stereo drift so the bed feels spatial — but StereoPanner isn't
      // universal, so fall back to a flat mono chain when it's missing.
      let panLfo: OscillatorNode | null = null;
      src.connect(lp);
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        lp.connect(panner);
        panner.connect(bedGain);
        panLfo = ctx.createOscillator();
        panLfo.frequency.value = this.ambientProfile.drift;
        const panDepth = ctx.createGain();
        panDepth.gain.value = 0.6;
        panLfo.connect(panDepth);
        panDepth.connect(panner.pan);
      } else {
        lp.connect(bedGain);
      }
      bedGain.connect(master);
      master.connect(ctx.destination);

      // Gentle "breathing" on the bed level.
      const breathLfo = ctx.createOscillator();
      breathLfo.frequency.value = 0.08;
      const breathDepth = ctx.createGain();
      breathDepth.gain.value = this.ambientBedLevel() * 0.4;
      breathLfo.connect(breathDepth);
      breathDepth.connect(bedGain.gain);

      src.start();
      panLfo?.start();
      breathLfo.start();
      this.ambient = { src, lp, panLfo, breathLfo, bedGain, breathDepth, master };
    } catch {
      // Ambient bed is non-essential; never let it break startup.
      this.ambient = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const pa of this.pool) {
      if (pa.isPlaying) pa.stop();
      pa.disconnect();
      pa.parent?.removeFromParent();
    }
    this.pool.length = 0;
    if (this.ambient) {
      const { src, panLfo, breathLfo, bedGain, master } = this.ambient;
      try {
        src.stop();
        panLfo?.stop();
        breathLfo.stop();
      } catch {
        // already stopped
      }
      bedGain.disconnect();
      master.disconnect();
      this.ambient = null;
    }
    if (this.music) {
      const { bus, filter, delay, feedback, level, master, voices, timer } = this.music;
      if (timer != null) clearTimeout(timer);
      for (const osc of voices) {
        try {
          osc.onended = null;
          osc.stop();
          osc.disconnect();
        } catch {
          // already stopped
        }
      }
      voices.clear();
      bus.disconnect();
      filter.disconnect();
      delay.disconnect();
      feedback.disconnect();
      level.disconnect();
      master.disconnect();
      this.music = null;
    }
    if (this.musicEmitter) {
      try {
        this.musicEmitter.disconnect();
      } catch {
        // already torn down
      }
      this.musicEmitter.parent?.removeFromParent();
      this.musicEmitter = null;
    }
    if (this.klaxon) {
      const { osc, pitchLfo, ampLfo, ampGain, master } = this.klaxon;
      try {
        osc.stop();
        pitchLfo.stop();
        ampLfo.stop();
      } catch {
        // already stopped
      }
      ampGain.disconnect();
      master.disconnect();
      this.klaxon = null;
    }
    this.listener.removeFromParent();
  }
}
