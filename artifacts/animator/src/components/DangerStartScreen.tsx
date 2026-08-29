/**
 * Danger Room start gate — ENTER → pointer lock + combat.
 * Control legend SSOT: hud/quickActions.ts
 * Room look: three/RoomPresets.ts
 * Playable maps: three/testWorlds.ts (climb / swim / harvest / combat labs)
 */
import { useEffect, useState } from "react";
import "./dangerStartScreen.css";
import type { RoomPresetId } from "../three/RoomPresets";
import type { TestWorldId, TestWorldKind } from "../three/testWorlds";
import {
  DANGER_ERA_OPTIONS,
  type DangerEraId,
} from "../lib/dangerPlayableCharacter";

export interface DangerRoomOption {
  id: RoomPresetId;
  name: string;
  blurb: string;
}

export interface DangerMapOption {
  id: TestWorldId;
  name: string;
  blurb: string;
  kind: TestWorldKind;
}

export interface DangerStartScreenProps {
  characterLabel?: string;
  weaponLabel?: string;
  raceLabel?: string;
  ready?: boolean;
  /** Parallel REST/CDN warmup finished (best-effort). */
  warmReady?: boolean;
  warmDetail?: string;
  roomPreset?: RoomPresetId;
  roomOptions?: DangerRoomOption[];
  onRoomPreset?: (id: RoomPresetId) => void;
  /** Loadable outdoor / loco / combat maps (TEST_WORLDS). */
  testWorldId?: TestWorldId;
  mapOptions?: DangerMapOption[];
  onTestWorld?: (id: TestWorldId) => void;
  onEnter: () => void;
  onOpenAccount?: () => void;
  /** Open /danger is all-era. GRUDOX voxel Danger is a separate host. */
  era?: DangerEraId;
  onEra?: (id: DangerEraId) => void;
}

const KIND_LABEL: Record<TestWorldKind, string> = {
  combat: "Combat",
  camp_sail: "Sail / camp",
  harvest_forest: "Harvest",
  survival_island: "Survival",
  faction_town: "Town",
  dock_kit: "Docks",
  loco_qa: "Loco Q&A",
  build_arena: "Build",
};

const DEFAULT_KEYS = [
  { keys: "W A S D", tip: "move · Shift sprint · Space jump / swim / climb" },
  { keys: "LMB", tip: "attack in FOCUS · select target (soft lock)" },
  { keys: "RMB", tip: "toggle hard FOCUS (face + lock)" },
  { keys: "X · C · E", tip: "roll · parry · forcefield / interact" },
  { keys: "F · 1–4 · R", tip: "weapon skill · signatures · heavy (harvest: hold R tools)" },
  { keys: "Hold Q", tip: "mode radial · ↑ combat · ↓ harvest" },
];

export function DangerStartScreen({
  characterLabel = "Hero",
  weaponLabel = "Weapon",
  raceLabel,
  ready = true,
  warmReady = true,
  warmDetail,
  roomPreset,
  roomOptions,
  onRoomPreset,
  testWorldId = "danger-room",
  mapOptions,
  onTestWorld,
  onEnter,
  onOpenAccount,
  era = "warlords",
  onEra,
}: DangerStartScreenProps) {
  // Never hard-block ENTER forever: warmup may hang on dead API — allow enter
  // once character/canvas is ready OR after a short grace period.
  const [graceEnter, setGraceEnter] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGraceEnter(true), 4500);
    return () => window.clearTimeout(t);
  }, []);
  // Warmup is best-effort only — never block ENTER if warm hangs.
  const canEnter = ready || graceEnter || warmReady === true;
  const selectedMap = mapOptions?.find((m) => m.id === testWorldId);

  return (
    <div
      className="danger-start-screen"
      data-testid="danger-start-screen"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="danger-start-card danger-start-card--wide">
        <div className="danger-start-kicker">GRUDGE OPEN · ALL-ERA COMBAT LAB</div>
        <h1 className="danger-start-title">
          DANGER<span className="accent">ROOM</span>
        </h1>
        <p className="danger-start-sub">
          {characterLabel}
          {raceLabel ? (
            <>
              <span className="sep">·</span>
              {raceLabel}
            </>
          ) : null}
          <span className="sep">·</span>
          {weaponLabel}
          {selectedMap ? (
            <>
              <span className="sep">·</span>
              {selectedMap.name}
            </>
          ) : null}
        </p>

        {onEra ? (
          <div className="danger-start-presets" role="group" aria-label="Character era">
            <div className="danger-start-maps-head">
              <span className="danger-start-maps-title">Era</span>
              <span className="danger-start-maps-hint">
                Voxel Mixamo · Warlords Toon · same room. GRUDOX voxel Danger is separate.
              </span>
            </div>
            <div className="danger-start-presets-row">
              {DANGER_ERA_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={"danger-start-preset" + (era === opt.id ? " is-active" : "")}
                  title={opt.blurb}
                  onClick={() => onEra(opt.id)}
                >
                  <span className="danger-start-preset-name">{opt.label}</span>
                  <span className="danger-start-preset-blurb">{opt.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mapOptions && mapOptions.length > 0 && onTestWorld ? (
          <div className="danger-start-maps" role="group" aria-label="Playable test maps">
            <div className="danger-start-maps-head">
              <span className="danger-start-maps-title">Playable maps</span>
              <span className="danger-start-maps-hint">
                Combat · climb · swim · harvest · build — load then ENTER
              </span>
            </div>
            <div className="danger-start-maps-grid">
              {mapOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    "danger-start-map" + (testWorldId === opt.id ? " is-active" : "")
                  }
                  title={opt.blurb}
                  onClick={() => onTestWorld(opt.id)}
                >
                  <span className="danger-start-map-kind">{KIND_LABEL[opt.kind] ?? opt.kind}</span>
                  <span className="danger-start-map-name">{opt.name}</span>
                  <span className="danger-start-map-blurb">{opt.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {roomOptions && roomOptions.length > 0 && onRoomPreset ? (
          <div className="danger-start-presets" role="group" aria-label="Chamber skin">
            <div className="danger-start-maps-head">
              <span className="danger-start-maps-title">Chamber look</span>
              <span className="danger-start-maps-hint">
                Holodeck skins (danger-room map only)
              </span>
            </div>
            <div className="danger-start-presets-row">
              {roomOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    "danger-start-preset" + (roomPreset === opt.id ? " is-active" : "")
                  }
                  title={opt.blurb}
                  onClick={() => onRoomPreset(opt.id)}
                >
                  <span className="danger-start-preset-name">{opt.name}</span>
                  <span className="danger-start-preset-blurb">{opt.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ul className="danger-start-keys">
          {DEFAULT_KEYS.map((row) => (
            <li key={row.keys}>
              <kbd>{row.keys}</kbd> {row.tip}
            </li>
          ))}
        </ul>

        <div className="danger-start-status" data-ready={canEnter ? "1" : "0"}>
          {canEnter
            ? warmDetail || "Systems ready · fleet loadout applied"
            : warmDetail || "Warming API + character…"}
        </div>

        <div className="danger-start-actions">
          <button
            type="button"
            className="danger-start-btn"
            disabled={!canEnter}
            onClick={onEnter}
            data-testid="danger-start-btn"
          >
            {canEnter
              ? selectedMap && selectedMap.id !== "danger-room"
                ? `ENTER · ${selectedMap.name.toUpperCase()}`
                : "ENTER DANGER"
              : "LOADING…"}
          </button>
          {onOpenAccount ? (
            <button
              type="button"
              className="danger-start-btn danger-start-btn--ghost"
              onClick={onOpenAccount}
            >
              ACCOUNT / HERO
            </button>
          ) : null}
        </div>
        <p className="danger-start-hint">
          One mixer · strip position tracks · feet on the same height field. Maps also in Admin →
          Test Maps · F8 free mouse · Hold Q mode
        </p>
      </div>
    </div>
  );
}
