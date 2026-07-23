/**
 * Danger Room start gate — ENTER → pointer lock + combat.
 * Control legend SSOT: hud/quickActions.ts
 * Room look: three/RoomPresets.ts
 */
import "./dangerStartScreen.css";
import type { RoomPresetId } from "../three/RoomPresets";

export interface DangerRoomOption {
  id: RoomPresetId;
  name: string;
  blurb: string;
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
  onEnter: () => void;
  onOpenAccount?: () => void;
}

const DEFAULT_KEYS = [
  { keys: "W A S D", tip: "move · Shift sprint · Space jump" },
  { keys: "LMB", tip: "attack in FOCUS · select target (soft lock)" },
  { keys: "RMB", tip: "toggle hard FOCUS (face + lock)" },
  { keys: "X · C · E", tip: "roll · parry · forcefield" },
  { keys: "F · 1–4 · R", tip: "weapon skill · signatures · heavy" },
  { keys: "Q", tip: "mode cycle combat ↔ harvest ↔ build" },
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
  onEnter,
  onOpenAccount,
}: DangerStartScreenProps) {
  const canEnter = ready && warmReady !== false;

  return (
    <div
      className="danger-start-screen"
      data-testid="danger-start-screen"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="danger-start-card">
        <div className="danger-start-kicker">GRUDGE OPEN · COMBAT SANDBOX</div>
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
        </p>

        {roomOptions && roomOptions.length > 0 && onRoomPreset ? (
          <div className="danger-start-presets" role="group" aria-label="Arena environment">
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
            {canEnter ? "ENTER DANGER" : "LOADING…"}
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
          Click enters pointer lock · F8 free mouse · Esc equipment · multiplayer via room code
        </p>
      </div>
    </div>
  );
}
