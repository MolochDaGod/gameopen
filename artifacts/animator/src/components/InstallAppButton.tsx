/**
 * "Download app" control — uses beforeinstallprompt when available,
 * otherwise shows platform-specific install hints (iOS Share, desktop menu).
 */
import { useEffect, useState } from "react";
import { Download, Check, Smartphone } from "lucide-react";
import {
  canInstallPwa,
  isStandalone,
  onInstallAvailability,
  promptInstall,
} from "../lib/pwa";

interface Props {
  /** Visual density for shell chrome vs library sidebar. */
  variant?: "steam" | "pill" | "sidebar";
  className?: string;
}

export function InstallAppButton({ variant = "steam", className = "" }: Props) {
  const [canInstall, setCanInstall] = useState(canInstallPwa);
  const [installed, setInstalled] = useState(isStandalone);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onInstallAvailability(setCanInstall), []);
  useEffect(() => {
    setInstalled(isStandalone());
  }, []);

  if (installed) {
    return (
      <span className={`go-install go-install--done go-install--${variant} ${className}`}>
        <Check size={14} strokeWidth={2.5} />
        <span>Installed</span>
      </span>
    );
  }

  const onClick = async () => {
    if (canInstall) {
      setBusy(true);
      const result = await promptInstall();
      setBusy(false);
      if (result === "accepted") setInstalled(true);
      if (result === "unavailable") setHint(true);
      return;
    }
    setHint((v) => !v);
  };

  const isIos =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  return (
    <div className={`go-install-wrap go-install-wrap--${variant}`}>
      <button
        type="button"
        className={`go-install go-install--${variant} ${className}`}
        onClick={() => void onClick()}
        disabled={busy}
        title="Install Grudge Open as an app"
      >
        {canInstall ? <Download size={14} strokeWidth={2.5} /> : <Smartphone size={14} strokeWidth={2.5} />}
        <span>{busy ? "Installing…" : canInstall ? "Install app" : "Get app"}</span>
      </button>
      {hint && (
        <div className="go-install-hint" role="status">
          {isIos ? (
            <>
              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
            </>
          ) : canInstall ? (
            <>Follow the browser install prompt.</>
          ) : (
            <>
              Use the browser menu → <strong>Install app</strong> / <strong>App available</strong>
            </>
          )}
          <button type="button" className="go-install-hint-x" onClick={() => setHint(false)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
