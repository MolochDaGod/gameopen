/**
 * Full-viewport load / intro overlay for Danger Room / arena boots.
 *
 * CSS-only on purpose: a second WebGLRenderer during Studio boot fights the
 * browser's context budget ("too many WebGL contexts" → "WebGL unavailable").
 * Progress + brand ring are pure DOM.
 */
import "./helpersLoadScreen.css";

interface Props {
  /** 0..1 progress; when omitted, indeterminate pulse. */
  progress?: number;
  label?: string;
  visible?: boolean;
}

export function HelpersLoadScreen({
  progress,
  label = "LOADING",
  visible = true,
}: Props) {
  if (!visible) return null;

  const pct =
    progress != null && Number.isFinite(progress)
      ? Math.round(Math.max(0, Math.min(1, progress)) * 100)
      : null;

  return (
    <div className="helpers-load" role="status" aria-live="polite" aria-label={label}>
      <div className="helpers-load-bg" aria-hidden>
        <div className="helpers-load-orb" />
        <div className="helpers-load-ring" />
      </div>
      <div className="helpers-load-vignette" aria-hidden />
      <div className="helpers-load-ui">
        <div className="helpers-load-title">{label}</div>
        <div className="helpers-load-bar-track">
          <div
            className="helpers-load-bar-fill"
            style={{
              width: pct != null ? `${pct}%` : undefined,
              animation:
                pct == null ? "helpers-load-indeterminate 1.4s ease-in-out infinite" : undefined,
            }}
          />
        </div>
        <div className="helpers-load-pct">{pct != null ? `${pct}%` : "…"}</div>
        <p className="helpers-load-hint">One GPU context · Danger Room engine</p>
      </div>
    </div>
  );
}
