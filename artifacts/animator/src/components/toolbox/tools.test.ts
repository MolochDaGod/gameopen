import { describe, expect, it } from "vitest";
import { UI_ICONS } from "../../three/icons";
import {
  TOOLBOX_TOOLS,
  THREEJS_STACK_TOOLS,
  RAPIER_STACK_TOOLS,
  R3F_STACK_TOOLS,
  CREATE_STACK_TOOLS,
  toolsForTab,
  onDressingPanelRequest,
  requestDressingPanel,
  type DangerPanelId,
  type DressingPanelId,
} from "./tools";

const DANGER_IDS: DangerPanelId[] = ["admin", "editor", "anim", "animdbg"];
const DRESSING_IDS: DressingPanelId[] = [
  "hierarchy",
  "wardrobe",
  "anim",
  "arsenal",
  "vfx",
  "playground",
];

function assertValidAction(tool: (typeof TOOLBOX_TOOLS)[number]) {
  expect(tool.label.length).toBeGreaterThan(0);
  expect(tool.hint.length).toBeGreaterThan(0);
  const a = tool.action;
  if (a.kind === "danger-panel") expect(DANGER_IDS).toContain(a.id);
  if (a.kind === "dressing-panel") expect(DRESSING_IDS).toContain(a.id);
  if (a.kind === "external") {
    expect(a.url.length).toBeGreaterThan(8);
    expect(/^https?:\/\//i.test(a.url)).toBe(true);
  }
  if (a.kind === "mode") {
    // Modes that Open App.tsx actually mounts (must stay in sync).
    const LIVE_MODES = new Set([
      "doors",
      "danger",
      "voxel",
      "play",
      "editor",
      "lobby",
      "ledmask",
      "avatar",
      "anim",
      "anim-ai",
      "ui",
    ]);
    expect(LIVE_MODES.has(a.mode)).toBe(true);
  }
}

/** Every sheet icon file must exist under public/icons/{name}.png (or skill_nobg). */
const REQUIRED_ICON_FILES = [...UI_ICONS];

describe("TOOLBOX_TOOLS", () => {
  it("covers all 25 sheet icons exactly once, in sheet order", () => {
    expect(TOOLBOX_TOOLS).toHaveLength(25);
    expect(TOOLBOX_TOOLS.map((t) => t.icon)).toEqual([...UI_ICONS]);
  });

  it("every tool has a label, hint, and a valid action target", () => {
    for (const tool of TOOLBOX_TOOLS) assertValidAction(tool);
  });

  it("every tool icon is a declared UI_ICONS name (sheet order)", () => {
    for (const tool of TOOLBOX_TOOLS) {
      expect(UI_ICONS).toContain(tool.icon);
    }
  });

  it("no two tools claim the same icon", () => {
    const icons = TOOLBOX_TOOLS.map((t) => t.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("required icon name list is complete", () => {
    expect(REQUIRED_ICON_FILES).toHaveLength(25);
  });
});

describe("stack tools", () => {
  it("every stack tab tool has a real external or mode action", () => {
    for (const tool of [
      ...THREEJS_STACK_TOOLS,
      ...RAPIER_STACK_TOOLS,
      ...R3F_STACK_TOOLS,
      ...CREATE_STACK_TOOLS,
    ]) {
      assertValidAction(tool);
    }
  });

  it("toolsForTab returns non-empty lists for each production tab", () => {
    for (const tab of ["tools", "three", "rapier", "r3f", "create"] as const) {
      expect(toolsForTab(tab).length).toBeGreaterThan(0);
    }
  });
});

describe("stack best-practice toolboxes", () => {
  it("Three.js stack has systems/scripts/tools/helpers coverage", () => {
    expect(THREEJS_STACK_TOOLS.length).toBeGreaterThanOrEqual(8);
    for (const t of THREEJS_STACK_TOOLS) {
      assertValidAction(t);
      expect(t.stack).toBe("three");
      expect(t.action.kind).toBe("external");
    }
    const labels = THREEJS_STACK_TOOLS.map((t) => t.label.toLowerCase()).join(" ");
    expect(labels).toMatch(/helper/);
    expect(labels).toMatch(/script|loader|camera|scene|anim/);
  });

  it("Rapier stack covers world, CCT, colliders, queries, debug", () => {
    expect(RAPIER_STACK_TOOLS.length).toBeGreaterThanOrEqual(8);
    for (const t of RAPIER_STACK_TOOLS) {
      assertValidAction(t);
      expect(t.stack).toBe("rapier");
    }
    const labels = RAPIER_STACK_TOOLS.map((t) => t.label.toLowerCase()).join(" ");
    expect(labels).toMatch(/cct|character|collider|query|debug|joint|layer/);
  });

  it("R3F stack covers canvas, hooks, drei, rapier bridge, perf", () => {
    expect(R3F_STACK_TOOLS.length).toBeGreaterThanOrEqual(8);
    for (const t of R3F_STACK_TOOLS) {
      assertValidAction(t);
      expect(t.stack).toBe("r3f");
    }
    const labels = R3F_STACK_TOOLS.map((t) => t.label.toLowerCase()).join(" ");
    expect(labels).toMatch(/canvas|hook|drei|rapier|perf|suspense|animation|forge|docs/);
  });

  it("Create stack deep-links Grok Builder game modes", () => {
    expect(CREATE_STACK_TOOLS.length).toBeGreaterThanOrEqual(8);
    for (const t of CREATE_STACK_TOOLS) {
      assertValidAction(t);
      expect(t.stack).toBe("create");
      expect(t.action.kind).toBe("external");
      if (t.action.kind === "external") {
        expect(t.action.url).toMatch(/grok-builder|forge|threejs|rapier|pmnd/i);
      }
    }
  });

  it("toolsForTab routes each tab", () => {
    expect(toolsForTab("tools")).toBe(TOOLBOX_TOOLS);
    expect(toolsForTab("three")).toBe(THREEJS_STACK_TOOLS);
    expect(toolsForTab("rapier")).toBe(RAPIER_STACK_TOOLS);
    expect(toolsForTab("r3f")).toBe(R3F_STACK_TOOLS);
    expect(toolsForTab("create")).toBe(CREATE_STACK_TOOLS);
  });
});

describe("dressing panel request bus", () => {
  it("buffers a request made before any subscriber and delivers it on subscribe", () => {
    requestDressingPanel("vfx");
    const got: string[] = [];
    const off = onDressingPanelRequest((id) => got.push(id));
    expect(got).toEqual(["vfx"]);
    off();
  });

  it("delivers live requests immediately while subscribed, and stops after unsubscribe", () => {
    const got: string[] = [];
    const off = onDressingPanelRequest((id) => got.push(id));
    requestDressingPanel("wardrobe");
    expect(got).toEqual(["wardrobe"]);
    off();
    requestDressingPanel("anim");
    expect(got).toEqual(["wardrobe"]);
    const got2: string[] = [];
    const off2 = onDressingPanelRequest((id) => got2.push(id));
    expect(got2).toEqual(["anim"]);
    off2();
  });

  it("does not re-deliver a consumed buffered request", () => {
    const first: string[] = [];
    const off = onDressingPanelRequest((id) => first.push(id));
    off();
    const second: string[] = [];
    const off2 = onDressingPanelRequest((id) => second.push(id));
    expect(second).toEqual([]);
    off2();
  });
});
