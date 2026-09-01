/**
 * F1 / ? — full hotkey guide for Danger Room & Play.
 * Non-blocking layout: dim backdrop, Esc/F1 closes, pointer free for reading.
 */
import { useEffect, useMemo } from "react";
import {
  HOTKEY_GROUPS,
  type HotkeyGroup,
} from "../hud/hotkeyMap";
import "./hotkeyHelp.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** danger | play — filters a few mode-tagged rows */
  surface?: "danger" | "play";
  activityMode?: "combat" | "harvest" | "build";
};

function filterGroup(
  g: HotkeyGroup,
  surface: "danger" | "play",
  activity: string,
): HotkeyGroup | null {
  const entries = g.entries.filter((e) => {
    if (!e.modes?.length) return true;
    return e.modes.some(
      (m) =>
        m === surface ||
        m === activity ||
        (activity === "build" && m === "harvest"),
    );
  });
  if (!entries.length) return null;
  return { ...g, entries };
}

export function HotkeyHelpOverlay({
  open,
  onClose,
  surface = "danger",
  activityMode = "combat",
}: Props) {
  const groups = useMemo(() => {
    return HOTKEY_GROUPS.map((g) => filterGroup(g, surface, activityMode)).filter(
      Boolean,
    ) as HotkeyGroup[];
  }, [surface, activityMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "F1" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="hk-help-root"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard controls"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hk-help-card">
        <header className="hk-help-head">
          <div>
            <h2 className="hk-help-title">Controls</h2>
            <p className="hk-help-sub">
              {surface === "danger" ? "Danger Room" : "Play"} ·{" "}
              <span className="hk-help-mode">{activityMode}</span>
              {" · "}
              <kbd className="hk-kbd">F1</kbd> / <kbd className="hk-kbd">Esc</kbd> close
            </p>
          </div>
          <button type="button" className="hk-help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="hk-help-grid">
          {groups.map((g) => (
            <section key={g.id} className="hk-help-group">
              <h3 className="hk-help-group-title">{g.title}</h3>
              <ul className="hk-help-list">
                {g.entries.map((e) => (
                  <li key={`${g.id}-${e.keys}-${e.action}`} className="hk-help-row">
                    <span className="hk-help-keys">
                      {e.keys.split(" · ").map((k) => (
                        <kbd key={k} className="hk-kbd">
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="hk-help-action">
                      <strong>{e.action}</strong>
                      {e.tip ? <em>{e.tip}</em> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="hk-help-foot">
          <span>VFX previews need <kbd className="hk-kbd">Alt</kbd> so combat keys stay free.</span>
          <button type="button" className="hk-help-done" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}
