/**
 * Hold-Q mode radial: vertical wedges — combat (up) / harvest (down).
 * Aim is driven by pointer-lock mouse ΔY while Q is held (Studio owns math).
 */
import "./modeRadial.css";
import type { ActivityMode } from "../three/playerMode";

export interface ModeRadialState {
  open: boolean;
  /** Live highlight from mouse aim. */
  aim: ActivityMode | "neutral";
  /** Currently active mode (chip under radial). */
  current: ActivityMode;
}

interface Props {
  state: ModeRadialState | null;
}

export function ModeRadial({ state }: Props) {
  if (!state?.open) return null;
  const { aim, current } = state;
  return (
    <div className="mode-radial" role="dialog" aria-label="Activity mode">
      <div className="mode-radial-ring">
        <div
          className={`mode-radial-wedge mode-radial-up ${aim === "combat" ? "hot" : ""} ${
            current === "combat" ? "active" : ""
          }`}
        >
          <span className="mode-radial-icon">⚔</span>
          <span className="mode-radial-label">Combat</span>
          <span className="mode-radial-hint">mouse up</span>
        </div>
        <div className="mode-radial-core">
          <span className="mode-radial-core-title">Q hold</span>
          <span className="mode-radial-core-sub">
            {current === "combat" ? "Combat" : "Harvest"}
          </span>
        </div>
        <div
          className={`mode-radial-wedge mode-radial-down ${aim === "harvest" ? "hot" : ""} ${
            current === "harvest" ? "active" : ""
          }`}
        >
          <span className="mode-radial-icon">🪓</span>
          <span className="mode-radial-label">Harvest</span>
          <span className="mode-radial-hint">mouse down</span>
        </div>
      </div>
      <p className="mode-radial-foot">
        Release Q to confirm · tap Q swaps weapons · cancel = keep mode
      </p>
    </div>
  );
}
