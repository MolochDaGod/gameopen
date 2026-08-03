/**
 * Isolated Leva debug dock for Danger Room skill / combat tuning.
 *
 * Design (no Settings/Admin conflicts):
 * - Own Leva store via `useCreateStore` + `LevaPanel` (never the global float).
 * - Mounted only while the "Leva Debug" dock panel is visible.
 * - Skill numbers live in `skillDebugSettings` (runtime overrides), not
 *   `EditorParams` / `controlsSettings`.
 * - Optional **shared** knobs (dash / AoE / skill force / blend) write through
 *   `onParam` so Settings stays SSOT for locomotion/camera persistence.
 * - Does not replace HUD, Q radial, weapon skill catalogs, or Admin spawn UI.
 *
 * Ref: https://threejsresources.com/tool/leva · pmndrs/leva
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LevaPanel, folder, useControls, useCreateStore } from "leva";
import type { EditorParams } from "../three/types";
import {
  exportSkillDebugJson,
  getSkillDebug,
  resetSkillDebug,
  setSkillDebug,
  type SkillDebugParams,
} from "../three/skillDebugSettings";

export interface LevaDangerDebugProps {
  /** Shared EditorParams (Settings panel SSOT). Read-only for display; write via onParam. */
  params: EditorParams;
  onParam: (patch: Partial<EditorParams>) => void;
  timeScale: number;
  onTimeScale: (scale: number) => void;
  onClose?: () => void;
}

export function LevaDangerDebug({
  params,
  onParam,
  timeScale,
  onTimeScale,
  onClose,
}: LevaDangerDebugProps) {
  // Isolated store — never touches Leva's global panel (avoids floating HUD clash).
  const store = useCreateStore();
  const [exportHint, setExportHint] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);

  const initial = useMemo(() => getSkillDebug(), [seed]);

  const skillSchema = useMemo(
    () => ({
      Uppercut: folder(
        {
          stamina: { value: initial.uppercut.stamina, min: 10, max: 100, step: 1 },
          gapMin: { value: initial.uppercut.gapMin, min: 0.4, max: 2.5, step: 0.05, label: "gap min (m)" },
          gapMax: { value: initial.uppercut.gapMax, min: 0.8, max: 4, step: 0.05, label: "gap max (m)" },
          launchUp: { value: initial.uppercut.launchUp, min: 4, max: 16, step: 0.1, label: "launch up" },
          hitRadius: { value: initial.uppercut.hitRadius, min: 1, max: 5, step: 0.05, label: "hit r (m)" },
          damage: { value: initial.uppercut.damage, min: 8, max: 120, step: 1 },
        },
        { collapsed: false },
      ),
      Kick: folder(
        {
          hurricaneStamina: { value: initial.kick.hurricaneStamina, min: 4, max: 40, step: 1, label: "hurricane ST" },
          hurricaneRadius: { value: initial.kick.hurricaneRadius, min: 1, max: 5, step: 0.05, label: "hurricane r" },
          hurricaneDamage: { value: initial.kick.hurricaneDamage, min: 8, max: 80, step: 1, label: "hurricane dmg" },
          hurricaneLaunch: { value: initial.kick.hurricaneLaunch, min: 0, max: 12, step: 0.1, label: "hurricane launch" },
          hurricaneCd: { value: initial.kick.hurricaneCd, min: 0.3, max: 4, step: 0.05, label: "hurricane CD" },
          mmaStamina: { value: initial.kick.mmaStamina, min: 4, max: 40, step: 1, label: "MMA ST" },
          mmaRadius: { value: initial.kick.mmaRadius, min: 1, max: 5, step: 0.05, label: "MMA r" },
          mmaDamage: { value: initial.kick.mmaDamage, min: 8, max: 80, step: 1, label: "MMA dmg" },
          mmaForceMult: { value: initial.kick.mmaForceMult, min: 0.5, max: 3, step: 0.05, label: "MMA force ×" },
          mmaLaunch: { value: initial.kick.mmaLaunch, min: 0, max: 12, step: 0.1, label: "MMA launch" },
          mmaCd: { value: initial.kick.mmaCd, min: 0.3, max: 4, step: 0.05, label: "MMA CD" },
        },
        { collapsed: true },
      ),
      Stab: folder(
        {
          openDamageMult: { value: initial.stab.openDamageMult, min: 0.25, max: 3, step: 0.05, label: "open dmg ×" },
          grabLandDamageMult: {
            value: initial.stab.grabLandDamageMult,
            min: 0.25,
            max: 3,
            step: 0.05,
            label: "grab land dmg ×",
          },
          openRecover: { value: initial.stab.openRecover, min: 0.2, max: 1.5, step: 0.02, label: "open recover (s)" },
        },
        { collapsed: true },
      ),
      "Weapon skill scale": folder(
        {
          damageMult: { value: initial.skill.damageMult, min: 0.25, max: 3, step: 0.05, label: "damage ×" },
          radiusMult: { value: initial.skill.radiusMult, min: 0.25, max: 3, step: 0.05, label: "radius ×" },
          staminaMult: { value: initial.skill.staminaMult, min: 0.25, max: 3, step: 0.05, label: "stamina ×" },
        },
        { collapsed: false },
      ),
      Harvest: folder(
        {
          harvestRadiusMult: {
            value: initial.harvest.radiusMult,
            min: 0.25,
            max: 3,
            step: 0.05,
            label: "radius ×",
          },
          harvestStaminaMult: {
            value: initial.harvest.staminaMult,
            min: 0.25,
            max: 3,
            step: 0.05,
            label: "stamina ×",
          },
        },
        { collapsed: true },
      ),
    }),
    [initial],
  );

  const skillVals = useControls(skillSchema, { store }, [seed]);

  // Shared locomotion / combat envelope — mirrors Settings, does not replace it.
  const sharedVals = useControls(
    {
      "Shared (Settings sync)": folder(
        {
          dashDistance: { value: params.dashDistance, min: 1, max: 14, step: 0.1, label: "dash (m)" },
          aoeRadius: { value: params.aoeRadius, min: 1, max: 10, step: 0.1, label: "AoE r (m)" },
          skillForce: { value: params.skillForce, min: 1, max: 30, step: 0.5, label: "skill force" },
          blendTime: { value: params.blendTime, min: 0.05, max: 0.8, step: 0.01, label: "blend (s)" },
          attackSteer: { value: params.attackSteer, min: 0, max: 1.5, step: 0.05, label: "attack steer" },
          timeScale: { value: timeScale, min: 0.1, max: 2, step: 0.05, label: "time scale" },
        },
        { collapsed: true },
      ),
    },
    { store },
    [params.dashDistance, params.aoeRadius, params.skillForce, params.blendTime, params.attackSteer, timeScale],
  );

  // Persist skill overrides whenever Leva changes them.
  // Folders flatten leaf keys into the returned object (leva SchemaToValues).
  useEffect(() => {
    const s = skillVals as Record<string, number>;
    const num = (key: string, fallback: number) => {
      const v = s[key];
      return typeof v === "number" && Number.isFinite(v) ? v : fallback;
    };
    const next: SkillDebugParams = {
      uppercut: {
        stamina: num("stamina", initial.uppercut.stamina),
        gapMin: num("gapMin", initial.uppercut.gapMin),
        gapMax: num("gapMax", initial.uppercut.gapMax),
        launchUp: num("launchUp", initial.uppercut.launchUp),
        hitRadius: num("hitRadius", initial.uppercut.hitRadius),
        damage: num("damage", initial.uppercut.damage),
      },
      kick: {
        hurricaneStamina: num("hurricaneStamina", initial.kick.hurricaneStamina),
        hurricaneRadius: num("hurricaneRadius", initial.kick.hurricaneRadius),
        hurricaneDamage: num("hurricaneDamage", initial.kick.hurricaneDamage),
        hurricaneLaunch: num("hurricaneLaunch", initial.kick.hurricaneLaunch),
        hurricaneCd: num("hurricaneCd", initial.kick.hurricaneCd),
        mmaStamina: num("mmaStamina", initial.kick.mmaStamina),
        mmaRadius: num("mmaRadius", initial.kick.mmaRadius),
        mmaDamage: num("mmaDamage", initial.kick.mmaDamage),
        mmaForceMult: num("mmaForceMult", initial.kick.mmaForceMult),
        mmaLaunch: num("mmaLaunch", initial.kick.mmaLaunch),
        mmaCd: num("mmaCd", initial.kick.mmaCd),
      },
      stab: {
        openDamageMult: num("openDamageMult", initial.stab.openDamageMult),
        grabLandDamageMult: num("grabLandDamageMult", initial.stab.grabLandDamageMult),
        openRecover: num("openRecover", initial.stab.openRecover),
      },
      skill: {
        damageMult: num("damageMult", initial.skill.damageMult),
        radiusMult: num("radiusMult", initial.skill.radiusMult),
        staminaMult: num("staminaMult", initial.skill.staminaMult),
      },
      harvest: {
        radiusMult: num("harvestRadiusMult", initial.harvest.radiusMult),
        staminaMult: num("harvestStaminaMult", initial.harvest.staminaMult),
      },
    };
    setSkillDebug(next);
  }, [skillVals, initial]);

  // Mirror shared knobs into EditorParams / time scale (Settings path).
  useEffect(() => {
    const s = sharedVals as Record<string, number>;
    const patch: Partial<EditorParams> = {};
    if (typeof s.dashDistance === "number" && s.dashDistance !== params.dashDistance) {
      patch.dashDistance = s.dashDistance;
    }
    if (typeof s.aoeRadius === "number" && s.aoeRadius !== params.aoeRadius) {
      patch.aoeRadius = s.aoeRadius;
    }
    if (typeof s.skillForce === "number" && s.skillForce !== params.skillForce) {
      patch.skillForce = s.skillForce;
    }
    if (typeof s.blendTime === "number" && s.blendTime !== params.blendTime) {
      patch.blendTime = s.blendTime;
    }
    if (typeof s.attackSteer === "number" && s.attackSteer !== params.attackSteer) {
      patch.attackSteer = s.attackSteer;
    }
    if (Object.keys(patch).length) onParam(patch);
    if (typeof s.timeScale === "number" && Math.abs(s.timeScale - timeScale) > 1e-4) {
      onTimeScale(s.timeScale);
    }
  }, [sharedVals, params, onParam, timeScale, onTimeScale]);

  const onReset = useCallback(() => {
    resetSkillDebug();
    setSeed((n) => n + 1);
    setExportHint("Reset to code defaults");
  }, []);

  const onExport = useCallback(async () => {
    const json = exportSkillDebugJson();
    try {
      await navigator.clipboard.writeText(json);
      setExportHint("Copied skill debug JSON (bake into weaponSkills / Studio)");
    } catch {
      setExportHint(json.slice(0, 120) + "…");
    }
  }, []);

  return (
    <div className="leva-danger-debug" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.72, lineHeight: 1.35 }}>
        Live skill overrides only. Settings still owns move/camera persistence. Catalogs in{" "}
        <code>weaponSkills.ts</code> stay production SSOT — export JSON to bake numbers.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="fx-test-btn" onClick={onReset}>
          Reset skills
        </button>
        <button type="button" className="fx-test-btn" onClick={onExport}>
          Export JSON
        </button>
        {onClose && (
          <button type="button" className="x" onClick={onClose} title="Close">
            ×
          </button>
        )}
      </div>
      {exportHint && (
        <pre
          style={{
            margin: 0,
            fontSize: 10,
            maxHeight: 72,
            overflow: "auto",
            opacity: 0.8,
            whiteSpace: "pre-wrap",
          }}
        >
          {exportHint}
        </pre>
      )}
      <div style={{ flex: 1, minHeight: 280, position: "relative" }}>
        <LevaPanel
          store={store}
          fill
          flat
          titleBar={false}
          theme={{
            sizes: { rootWidth: "100%" },
            colors: {
              elevation1: "transparent",
              elevation2: "rgba(12, 16, 24, 0.55)",
              elevation3: "rgba(20, 28, 40, 0.75)",
            },
          }}
        />
      </div>
    </div>
  );
}
