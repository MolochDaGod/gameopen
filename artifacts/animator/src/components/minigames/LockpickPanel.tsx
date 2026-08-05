/**
 * Native lockpick minigame (Skyrim/Kenney style — HTML only, no SWF).
 * open-ui payload: { ui: "lockpick", targetId, difficulty, label, kind }
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  attemptLockpickTumble,
  cancelLockpick,
  createLockpickSession,
  lockpickResultFromSession,
  pinInSweetZone,
  setLockpickPinAngle,
  tickLockpickHold,
  type LockpickChallenge,
  type LockpickResult,
  type LockpickSession,
} from "../../game/inventory/lockpick";
import "./lockpick.css";

export interface LockpickPanelProps {
  open: boolean;
  challenge: LockpickChallenge | null;
  onClose: () => void;
  onResult: (result: LockpickResult) => void;
}

export function LockpickPanel({
  open,
  challenge,
  onClose,
  onResult,
}: LockpickPanelProps) {
  const [session, setSession] = useState<LockpickSession | null>(null);
  const holding = useRef(false);
  const drag = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    if (!open || !challenge) {
      setSession(null);
      return;
    }
    setSession(createLockpickSession(challenge));
    holding.current = false;
  }, [open, challenge]);

  useEffect(() => {
    if (!open || !session || session.status !== "active") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setSession((s) => {
        if (!s || s.status !== "active") return s;
        return tickLockpickHold(s, dt, holding.current);
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, session?.status, session?.challenge.targetId]);

  useEffect(() => {
    if (!session || session.status === "active") return;
    const result = lockpickResultFromSession(session);
    onResult(result);
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    setSession((s) => {
      if (!s || s.status !== "active") return s;
      return setLockpickPinAngle(s, s.pinAngle + dx * 0.012);
    });
  }, []);

  if (!open || !challenge || !session) return null;

  const sweet = pinInSweetZone(session);
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;
  const pinX = cx + Math.cos(session.pinAngle) * r;
  const pinY = cy + Math.sin(session.pinAngle) * r;
  const sweetStart = session.sweetAngle - session.sweetHalfWidth;
  const sweetEnd = session.sweetAngle + session.sweetHalfWidth;

  return (
    <div className="lpk-root" role="dialog" aria-label="Lockpick">
      <div
        className="lpk-backdrop"
        onClick={() => {
          setSession((s) => (s ? cancelLockpick(s) : s));
          onClose();
        }}
      />
      <div className="lpk-panel">
        <header className="lpk-head">
          <h2>Lockpick</h2>
          <p>
            {challenge.label} · DC {challenge.difficulty} · attempts{" "}
            {session.attemptsLeft}/{session.maxAttempts}
          </p>
        </header>

        <svg
          className="lpk-dial"
          width={size}
          height={size}
          onPointerDown={(e) => {
            drag.current = true;
            lastX.current = e.clientX;
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerUp={() => {
            drag.current = false;
          }}
          onPointerMove={onPointerMove}
        >
          <circle cx={cx} cy={cy} r={r + 8} className="lpk-ring" />
          {/* Sweet zone arc approximation as thick stroke path */}
          <path
            d={describeArc(cx, cy, r, sweetStart, sweetEnd)}
            className="lpk-sweet"
            fill="none"
          />
          <line
            x1={cx}
            y1={cy}
            x2={pinX}
            y2={pinY}
            className={sweet ? "lpk-pin in-sweet" : "lpk-pin"}
          />
          <circle cx={cx} cy={cy} r={10} className="lpk-hub" />
        </svg>

        <div className="lpk-progress" aria-hidden>
          <div
            className="lpk-progress-fill"
            style={{ width: `${Math.round(session.holdProgress * 100)}%` }}
          />
        </div>

        <div className="lpk-actions">
          <button
            type="button"
            className="lpk-btn hold"
            onPointerDown={() => {
              holding.current = true;
            }}
            onPointerUp={() => {
              holding.current = false;
            }}
            onPointerLeave={() => {
              holding.current = false;
            }}
          >
            Hold in sweet zone
          </button>
          <button
            type="button"
            className="lpk-btn tumble"
            onClick={() => setSession((s) => (s ? attemptLockpickTumble(s) : s))}
          >
            Tumble
          </button>
          <button
            type="button"
            className="lpk-btn cancel"
            onClick={() => {
              setSession((s) => (s ? cancelLockpick(s) : s));
              onClose();
            }}
          >
            Cancel
          </button>
        </div>
        <p className="lpk-hint">
          Drag dial · hold when pin is in the gold arc · or Tumble in the sweet zone.
          Foreign camps &amp; hidden chests only.
        </p>
      </div>
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
): string {
  const polar = (a: number) => ({
    x: cx + Math.cos(a) * r,
    y: cy + Math.sin(a) * r,
  });
  const s = polar(start);
  const e = polar(end);
  let delta = end - start;
  while (delta < 0) delta += Math.PI * 2;
  while (delta > Math.PI * 2) delta -= Math.PI * 2;
  const large = delta > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}
