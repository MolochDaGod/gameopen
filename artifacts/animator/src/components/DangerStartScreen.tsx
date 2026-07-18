/**
 * Danger Room start gate — mirrors polished three.js boot flows:
 * load complete → overlay → click ENTER → pointer lock + combat.
 *
 * Blocks accidental canvas lock until the player is ready.
 */
import "./dangerStartScreen.css";

export interface DangerStartScreenProps {
  characterLabel?: string;
  weaponLabel?: string;
  ready?: boolean;
  onEnter: () => void;
}

export function DangerStartScreen({
  characterLabel = "Hero",
  weaponLabel = "Weapon",
  ready = true,
  onEnter,
}: DangerStartScreenProps) {
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
        <div className="danger-start-kicker">GRUDGE OPEN</div>
        <h1 className="danger-start-title">
          DANGER<span className="accent">ROOM</span>
        </h1>
        <p className="danger-start-sub">
          {characterLabel}
          <span className="sep">·</span>
          {weaponLabel}
        </p>

        <ul className="danger-start-keys">
          <li>
            <kbd>W A S D</kbd> move · <kbd>Shift</kbd> sprint
          </li>
          <li>
            <kbd>A A</kbd> / <kbd>D D</kbd> side dash · <kbd>X</kbd> dodge roll
          </li>
          <li>
            <kbd>Space</kbd> jump · wall run / wall jump near walls
          </li>
          <li>
            <kbd>LMB</kbd> select · <kbd>RMB</kbd> focus toggle · attack in focus
          </li>
          <li>
            <kbd>F</kbd> skill · <kbd>1–4</kbd> signatures · <kbd>Q</kbd> combat/harvest
          </li>
        </ul>

        <button
          type="button"
          className="danger-start-btn"
          disabled={!ready}
          onClick={onEnter}
          data-testid="danger-start-btn"
        >
          {ready ? "ENTER DANGER" : "LOADING…"}
        </button>
        <p className="danger-start-hint">
          Click enters pointer lock · mouse look · hard refresh if clips feel old
        </p>
      </div>
    </div>
  );
}
