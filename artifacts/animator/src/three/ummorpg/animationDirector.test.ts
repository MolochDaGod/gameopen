import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { AnimationDirector } from "./animationDirector";

function dummyClip(name: string, dur: number): THREE.AnimationClip {
  return new THREE.AnimationClip(name, dur, [
    new THREE.QuaternionKeyframeTrack(".quaternion", [0, dur], [0, 0, 0, 1, 0, 0, 0, 1]),
  ]);
}

describe("AnimationDirector mixer clock", () => {
  function makeDirector() {
    const root = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(root);
    return new AnimationDirector(mixer, {
      idle: dummyClip("idle", 1),
      attack: dummyClip("attack", 0.4),
    });
  }

  it("one-shot stays busy across a hitch because dt is capped", () => {
    const d = makeDirector();
    const dur = d.requestOneShot("attack");
    expect(dur).toBeCloseTo(0.4);
    expect(d.busyOverlay).toBe(true);
    // Wall-clock would have expired this swing; mixer clock must not.
    d.update(2);
    expect(d.busyOverlay).toBe(true);
    // MIXER_DT_MAX is 1/20 — ten frames ≈ 0.5s, past the 0.4s clip.
    for (let i = 0; i < 10; i++) d.update(0.05);
    expect(d.busyOverlay).toBe(false);
  });

  it("detach clears overlay bookkeeping without throwing", () => {
    const d = makeDirector();
    d.requestOneShot("attack");
    d.detach();
    expect(d.busyOverlay).toBe(false);
    d.update(0.016);
  });
});
