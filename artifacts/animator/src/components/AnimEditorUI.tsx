import { useState } from "react";
import type { AnimEditorState } from "../three/anim/AnimEditor";
import "./animCreator.css";

/** Imperative bridge to the live {@link AnimEditor} engine. */
export interface AnimApi {
  selectBone: (name: string | null) => void;
  setGizmoSpace: (space: "local" | "world") => void;
  addFrame: () => void;
  duplicateFrame: (index: number) => void;
  deleteFrame: (index: number) => void;
  moveFrame: (index: number, dir: -1 | 1) => void;
  setActiveFrame: (index: number) => void;
  setFrameDuration: (index: number, seconds: number) => void;
  resetBone: () => void;
  resetFrame: () => void;
  undo: () => void;
  togglePlay: () => void;
  setScrub: (time: number) => void;
  save: (name: string) => boolean;
  loadClip: (name: string) => void;
  deleteSaved: (name: string) => void;
  newClip: () => void;
  getClip: () => { bones: string[]; frames: import("../three/anim/clipStore").ClipFrame[] };
  loadFrames: (
    frames: Array<{
      duration: number;
      pose: Record<string, [number, number, number, number]>;
      root?: [number, number, number];
    }>,
  ) => boolean;
  /** Bake travel (time/distance/direction) onto the current in-place clip. */
  applyMotion: (req: { time: number; distance: number; direction: number }) => void;
}

interface Props {
  state: AnimEditorState;
  api: AnimApi;
  onExit: () => void;
}

/**
 * The React shell for the Animation Creator door: a joint list (mirrors the 3D
 * handle picking), a frame timeline (add/duplicate/delete/reorder + per-frame
 * duration), scrub + preview transport, and a save/library bar. All state comes
 * from the engine's {@link AnimEditorState}; every action routes through
 * {@link AnimApi}.
 */
export function AnimEditorUI({ state, api, onExit }: Props) {
  const [name, setName] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const active = state.frames[state.activeFrame];
  const selectedLabel = state.bones.find((b) => b.name === state.selectedBone)?.label ?? null;

  return (
    <>
      <div className="ae-topbar">
        <span className="brand">
          ANIM<span className="brand-accent">CREATOR</span>
        </span>
        <div className="ae-top-actions">
          <button className="ae-btn" onClick={() => api.newClip()}>
            New
          </button>
          <button className="ae-btn" onClick={() => api.undo()} disabled={!state.canUndo}>
            ↶ Undo
          </button>
          <button className={`ae-btn ${libraryOpen ? "on" : ""}`} onClick={() => setLibraryOpen((v) => !v)}>
            Library
          </button>
          <button className="ae-btn" onClick={onExit}>
            ⬑ Doors
          </button>
        </div>
      </div>

      {!state.ready && (
        <div className="ae-loading">
          <p>Loading rig…</p>
        </div>
      )}

      {/* Joint picker — mirrors clicking a handle on the 3D rig. */}
      <div className="ae-panel ae-bones">
        <div className="ae-section">
          <h4>Joint</h4>
          <p className={`ae-selected ${selectedLabel ? "on" : ""}`}>
            {selectedLabel ? `Posing: ${selectedLabel}` : "Click a joint to pose it"}
          </p>
          <div className="ae-bone-list">
            {state.bones.map((b) => (
              <button
                key={b.name}
                className={`ae-bone ${state.selectedBone === b.name ? "active" : ""}`}
                onClick={() => api.selectBone(state.selectedBone === b.name ? null : b.name)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ae-section">
          <h4>Gizmo</h4>
          <div className="ae-row">
            <button
              className={`ae-opt ${state.gizmoSpace === "local" ? "active" : ""}`}
              onClick={() => api.setGizmoSpace("local")}
            >
              Local
            </button>
            <button
              className={`ae-opt ${state.gizmoSpace === "world" ? "active" : ""}`}
              onClick={() => api.setGizmoSpace("world")}
            >
              World
            </button>
          </div>
          <div className="ae-row">
            <button className="ae-btn ae-sm" onClick={() => api.resetBone()} disabled={!state.selectedBone}>
              Reset joint
            </button>
            <button className="ae-btn ae-sm" onClick={() => api.resetFrame()}>
              Reset frame
            </button>
          </div>
        </div>

        <div className="ae-hint">
          <p>
            <b>Click</b> a joint · <b>drag</b> the ring to rotate · <b>orbit</b> empty space
          </p>
        </div>
      </div>

      {/* Save / library bar. */}
      <div className="ae-savebar">
        <input
          className="ae-name"
          placeholder="Clip name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && api.save(name)) setName("");
          }}
        />
        <button
          className="ae-btn ae-save"
          onClick={() => {
            if (api.save(name)) setName("");
          }}
          disabled={!name.trim()}
        >
          ⬇ Save clip
        </button>
      </div>

      {libraryOpen && (
        <div className="ae-library">
          <div className="ae-lib-head">
            <h4>Saved clips</h4>
            <button className="ae-btn ae-sm" onClick={() => setLibraryOpen(false)}>
              ✕
            </button>
          </div>
          {state.savedClips.length === 0 ? (
            <p className="ae-empty">No saved clips yet. Pose some frames and save.</p>
          ) : (
            <ul className="ae-lib-list">
              {state.savedClips.map((clip) => (
                <li key={clip}>
                  <span className="ae-lib-name">{clip}</span>
                  <button className="ae-btn ae-sm" onClick={() => api.loadClip(clip)}>
                    Load
                  </button>
                  <button className="ae-btn ae-sm ae-danger" onClick={() => api.deleteSaved(clip)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Timeline + transport. */}
      <div className="ae-timeline">
        <div className="ae-frames">
          {state.frames.map((f, i) => (
            <div
              key={i}
              className={`ae-frame ${i === state.activeFrame ? "active" : ""}`}
              onClick={() => api.setActiveFrame(i)}
            >
              <span className="ae-frame-n">{i + 1}</span>
              <span className="ae-frame-d">{f.duration.toFixed(2)}s</span>
            </div>
          ))}
          <button className="ae-frame ae-add" onClick={() => api.addFrame()} title="Add frame">
            +
          </button>
        </div>

        <div className="ae-frame-ctl">
          <button className="ae-btn ae-sm" onClick={() => api.moveFrame(state.activeFrame, -1)} title="Move left">
            ◀
          </button>
          <button className="ae-btn ae-sm" onClick={() => api.moveFrame(state.activeFrame, 1)} title="Move right">
            ▶
          </button>
          <button className="ae-btn ae-sm" onClick={() => api.duplicateFrame(state.activeFrame)} title="Duplicate">
            ⧉
          </button>
          <button
            className="ae-btn ae-sm ae-danger"
            onClick={() => api.deleteFrame(state.activeFrame)}
            disabled={state.frames.length <= 1}
            title="Delete"
          >
            🗑
          </button>
          {active && (
            <label className="ae-dur">
              Hold
              <input
                type="number"
                min={0.05}
                max={5}
                step={0.05}
                value={active.duration}
                onChange={(e) => api.setFrameDuration(state.activeFrame, parseFloat(e.target.value) || 0.05)}
              />
              s
            </label>
          )}
        </div>

        <div className="ae-transport">
          <button
            className={`ae-btn ae-play ${state.playing ? "on" : ""}`}
            onClick={() => api.togglePlay()}
            disabled={state.frames.length < 2}
          >
            {state.playing ? "⏸ Stop" : "▶ Preview"}
          </button>
          <input
            className="ae-scrub"
            type="range"
            min={0}
            max={Math.max(0.01, state.duration)}
            step={0.01}
            value={Math.min(state.scrubTime, state.duration)}
            onChange={(e) => api.setScrub(parseFloat(e.target.value))}
          />
          <span className="ae-time">
            {state.scrubTime.toFixed(2)} / {state.duration.toFixed(2)}s
          </span>
        </div>
      </div>
    </>
  );
}
