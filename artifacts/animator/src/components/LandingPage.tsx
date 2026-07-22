/**
 * Landing page — Open front door before the Steam-style hub.
 *
 * Grudge ID sign-in (fleet best practices) + guest continue. Welcome-back when
 * a session already exists in localStorage. Canonical host:
 * https://open.grudge-studio.com
 */
import { useEffect, useState } from "react";
import {
  getStoredAccount,
  getStoredToken,
  initFleetAuth,
  loginWithGrudgeId,
  logoutGrudge,
} from "../lib/grudgeAuth";
import { StormShipCinema } from "./StormShipCinema";
import "./landing.css";

const emblemArt = `${import.meta.env.BASE_URL}emblem.png`;

interface Props {
  /**
   * Proceed into the facility.
   * Production path: cinema handoff → character select/create (campfire).
   */
  onEnter: () => void;
}

type Phase = "checking" | "signedOut" | "busy" | "signedIn";

export function LandingPage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initFleetAuth();
      } catch {
        /* guest */
      }
      if (cancelled) return;
      const acct = getStoredAccount();
      const token = getStoredToken();
      if (token && acct) {
        setDisplayName(acct.displayName || acct.grudgeId || "Player");
        setPhase("signedIn");
      } else {
        setPhase("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const doSignIn = async () => {
    setError(null);
    setPhase("busy");
    try {
      // Full-page redirect to id.grudge-studio.com/login (fleet SSOT)
      await loginWithGrudgeId(true);
      // If smart skip returned without redirect, refresh local state
      const acct = getStoredAccount();
      if (getStoredToken() && acct) {
        setDisplayName(acct.displayName || acct.grudgeId || "Player");
        setPhase("signedIn");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed — try again.");
      setPhase("signedOut");
    }
  };

  const doGuest = () => {
    onEnter();
  };

  const doSwitch = () => {
    logoutGrudge();
    setDisplayName(null);
    setPhase("signedOut");
    void loginWithGrudgeId(true);
  };

  return (
    <div className="landing landing--storm">
      {/* Production Open · island-3d — Storm Ship Attack cinema */}
      <StormShipCinema
        interactive={false}
        className="landing-storm-cinema"
      />
      <div className="landing-vignette" aria-hidden />

      <div className="landing-inner">
        <img src={emblemArt} alt="" className="landing-emblem" />
        <h1 className="landing-brand">
          GRUDGE <span className="landing-brand-accent">OPEN</span>
        </h1>
        <p className="landing-tag">Production Open · island-3d · Storm Ship Attack</p>
        <p className="landing-hint">
          Fleet login. Survive the storm — play as your Grudge ID characters.
        </p>

        {error && <div className="landing-error">{error}</div>}

        {phase === "checking" && (
          <p className="landing-hint">Checking session…</p>
        )}

        {phase === "signedOut" && (
          <div className="landing-actions">
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => void doSignIn()}>
              Sign in with Grudge ID
            </button>
            <button type="button" className="landing-btn landing-btn-quiet" onClick={doGuest}>
              Continue as guest
            </button>
          </div>
        )}

        {phase === "busy" && (
          <p className="landing-hint">Redirecting to Grudge ID…</p>
        )}

        {phase === "signedIn" && (
          <div className="landing-actions">
            <p className="landing-user">
              Welcome back, <strong>{displayName}</strong>
            </p>
            <button type="button" className="landing-btn landing-btn-primary" onClick={onEnter}>
              Enter Open
            </button>
            <button type="button" className="landing-btn landing-btn-quiet" onClick={doSwitch}>
              Switch account
            </button>
          </div>
        )}

        <p className="landing-note">
          open.grudge-studio.com · SSOT for the Animator suite
        </p>
      </div>
    </div>
  );
}
