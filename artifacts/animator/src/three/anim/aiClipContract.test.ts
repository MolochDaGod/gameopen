import { describe, it, expect } from "vitest";
import {
  normalizeAiClip,
  resampleFramesExact,
  MAX_FRAMES,
  MIN_FRAME_DURATION,
  MAX_FRAME_DURATION,
  MAX_ROOT_COORD,
  type AiClipFrame,
} from "./aiClipContract";

function unit(): [number, number, number, number] {
  return [0, 0, 0, 1];
}

describe("normalizeAiClip", () => {
  it("rejects non-objects and empty frame sets", () => {
    expect(normalizeAiClip(null).ok).toBe(false);
    expect(normalizeAiClip(42).ok).toBe(false);
    expect(normalizeAiClip({}).ok).toBe(false);
    expect(normalizeAiClip({ frames: [] }).ok).toBe(false);
  });

  it("accepts a minimal valid clip", () => {
    const res = normalizeAiClip({
      frames: [{ duration: 0.4, pose: { mixamorigHips: unit() } }],
    });
    expect(res.ok).toBe(true);
    expect(res.clip?.bones).toEqual(["mixamorigHips"]);
    expect(res.clip?.frames).toHaveLength(1);
  });

  it("unwraps a { clip: {...} } envelope", () => {
    const res = normalizeAiClip({
      clip: { frames: [{ duration: 0.4, pose: { mixamorigHead: unit() } }] },
    });
    expect(res.ok).toBe(true);
    expect(res.clip?.bones).toEqual(["mixamorigHead"]);
  });

  it("drops unknown bones but keeps valid ones", () => {
    const res = normalizeAiClip({
      frames: [
        {
          duration: 0.4,
          pose: { mixamorigHips: unit(), notARealBone: unit(), "": unit() },
        },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.clip?.bones).toEqual(["mixamorigHips"]);
    expect(res.warnings.some((w) => w.includes("unknown bone"))).toBe(true);
  });

  it("fails when no recognized bones remain", () => {
    const res = normalizeAiClip({
      frames: [{ duration: 0.4, pose: { fakeBone: unit() } }],
    });
    expect(res.ok).toBe(false);
  });

  it("re-normalizes quaternions and replaces invalid ones with identity", () => {
    const res = normalizeAiClip({
      frames: [
        {
          duration: 0.4,
          pose: {
            mixamorigHips: [0, 2, 0, 0], // non-unit -> normalized to [0,1,0,0]
            mixamorigSpine: [0, 0, 0, 0], // zero-length -> identity
            mixamorigNeck: [NaN, 0, 0, 1], // NaN -> identity
          },
        },
      ],
    });
    expect(res.ok).toBe(true);
    const pose = res.clip!.frames[0].pose;
    const len = Math.hypot(...pose.mixamorigHips);
    expect(len).toBeCloseTo(1, 6);
    expect(pose.mixamorigHips).toEqual([0, 1, 0, 0]);
    expect(pose.mixamorigSpine).toEqual([0, 0, 0, 1]);
    expect(pose.mixamorigNeck).toEqual([0, 0, 0, 1]);
    expect(res.warnings.some((w) => w.includes("invalid rotation"))).toBe(true);
  });

  it("clamps out-of-range and non-finite durations", () => {
    const res = normalizeAiClip({
      frames: [
        { duration: 99, pose: { mixamorigHips: unit() } },
        { duration: 0, pose: { mixamorigHips: unit() } },
        { duration: "x" as unknown as number, pose: { mixamorigHips: unit() } },
      ],
    });
    expect(res.ok).toBe(true);
    const ds = res.clip!.frames.map((f) => f.duration);
    expect(ds[0]).toBe(MAX_FRAME_DURATION);
    expect(ds[1]).toBe(MIN_FRAME_DURATION);
    expect(ds[2]).toBe(MIN_FRAME_DURATION);
    expect(res.warnings.some((w) => w.includes("duration"))).toBe(true);
  });

  it("caps the frame count", () => {
    const frames = Array.from({ length: MAX_FRAMES + 20 }, () => ({
      duration: 0.2,
      pose: { mixamorigHips: unit() },
    }));
    const res = normalizeAiClip({ frames });
    expect(res.ok).toBe(true);
    expect(res.clip?.frames).toHaveLength(MAX_FRAMES);
    expect(res.warnings.some((w) => w.includes("Capped"))).toBe(true);
  });

  it("preserves a valid per-frame root position", () => {
    const res = normalizeAiClip({
      frames: [
        { duration: 0.4, pose: { mixamorigHips: unit() }, root: [0, 0, 0] },
        { duration: 0.4, pose: { mixamorigHips: unit() }, root: [1.5, 0.2, -3] },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.clip!.frames[0].root).toEqual([0, 0, 0]);
    expect(res.clip!.frames[1].root).toEqual([1.5, 0.2, -3]);
  });

  it("clamps out-of-range root coordinates", () => {
    const res = normalizeAiClip({
      frames: [
        { duration: 0.4, pose: { mixamorigHips: unit() }, root: [99999, -99999, 0] },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.clip!.frames[0].root).toEqual([MAX_ROOT_COORD, -MAX_ROOT_COORD, 0]);
  });

  it("drops an invalid root (wrong length or non-finite) without a position track", () => {
    const res = normalizeAiClip({
      frames: [
        { duration: 0.4, pose: { mixamorigHips: unit() }, root: [1, 2] },
        { duration: 0.4, pose: { mixamorigHips: unit() }, root: [NaN, 0, 0] },
        { duration: 0.4, pose: { mixamorigHips: unit() }, root: "nope" },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.clip!.frames.every((f) => f.root === undefined)).toBe(true);
  });

  it("fills missing bones in a frame with identity so tracks are complete", () => {
    const res = normalizeAiClip({
      frames: [
        { duration: 0.4, pose: { mixamorigHips: [0, 1, 0, 0] } },
        { duration: 0.4, pose: { mixamorigSpine: [0, 1, 0, 0] } },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.clip?.bones).toEqual(["mixamorigHips", "mixamorigSpine"]);
    // Frame 0 lacked Spine; frame 1 lacked Hips — both filled with identity.
    expect(res.clip!.frames[0].pose.mixamorigSpine).toEqual([0, 0, 0, 1]);
    expect(res.clip!.frames[1].pose.mixamorigHips).toEqual([0, 0, 0, 1]);
  });
});

describe("resampleFramesExact (A.L.E. exact frame count)", () => {
  const mk = (n: number): AiClipFrame[] =>
    Array.from({ length: n }, (_, i) => ({
      duration: 0.1 * (i + 1),
      pose: { mixamorigHips: [0, 0, 0, 1] as [number, number, number, number] },
    }));

  it("downsamples to exactly n frames", () => {
    expect(resampleFramesExact(mk(20), 8)).toHaveLength(8);
    expect(resampleFramesExact(mk(12), 8)).toHaveLength(8);
  });

  it("upsamples to exactly n frames", () => {
    expect(resampleFramesExact(mk(3), 8)).toHaveLength(8);
    expect(resampleFramesExact(mk(1), 8)).toHaveLength(8);
  });

  it("returns the requested count when already exact", () => {
    expect(resampleFramesExact(mk(8), 8)).toHaveLength(8);
  });

  it("keeps the first and last source frames at the endpoints", () => {
    const src = mk(12);
    const out = resampleFramesExact(src, 8);
    expect(out[0].duration).toBe(src[0].duration);
    expect(out[out.length - 1].duration).toBe(src[src.length - 1].duration);
  });

  it("clones frames so duplicated entries are independent", () => {
    const out = resampleFramesExact(mk(2), 8);
    out[0].pose.mixamorigHips[0] = 9;
    expect(out[1].pose.mixamorigHips[0]).toBe(0);
  });

  it("is a no-op for n<=0 or empty input", () => {
    expect(resampleFramesExact(mk(5), 0)).toHaveLength(5);
    expect(resampleFramesExact([], 8)).toHaveLength(0);
  });
});
