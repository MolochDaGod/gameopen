import { describe, expect, it } from "vitest";
import { ScriptRunner, type ScriptDoc } from "./scripting";
import { dangerRoomLocation } from "./location";

describe("ScriptRunner", () => {
  it("runs enter-radius actions without eval", async () => {
    const runner = new ScriptRunner();
    const log: string[] = [];
    runner.register("message", (a) => {
      log.push(String(a.payload?.text ?? ""));
    });
    const doc: ScriptDoc = {
      id: "scr_test",
      mode: "once",
      trigger: {
        kind: "enter-radius",
        radius: 2,
        position: { x: 0, y: 0, z: 0 },
      },
      actions: [{ kind: "message", payload: { text: "hello" } }],
    };
    runner.load([doc]);
    const ctx = {
      location: dangerRoomLocation(),
      flags: {},
      time: 0,
      now: Date.now(),
    };
    const n = await runner.tickProximity({ x: 0.5, y: 0, z: 0.5 }, ctx);
    expect(n).toBe(1);
    expect(log).toEqual(["hello"]);
    // once mode
    const n2 = await runner.tickProximity({ x: 0.5, y: 0, z: 0.5 }, ctx);
    expect(n2).toBe(0);
  });
});
