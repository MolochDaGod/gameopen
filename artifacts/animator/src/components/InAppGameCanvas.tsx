/**
 * Full-bleed in-app game canvas — keeps fleet titles inside Open instead of
 * opening a new browser page. Production SPAs load in an iframe with SSO
 * query handoff; pop-out is secondary if the host blocks framing.
 *
 * Visuals: poster backdrop + soft particle curtain (CSS) while loading —
 * no Meshy / capsule placeholders; posters resolve via fleet assetUrl.
 * D1 registry warm for zone packs; gamepad + pointer-lock permissions.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { InAppEmbedSession } from "../lib/inAppLaunch";
import {
  isLikelyEmbeddable,
  loadingParticleColor,
  rewriteEmbedUrlForOpen,
} from "../lib/inAppLaunch";
import { warmZoneD1Assets, profileForZone } from "../lib/zoneGamePlay";
import "./inAppGameCanvas.css";

export interface InAppGameCanvasProps extends InAppEmbedSession {
  onClose: () => void;
  /** Optional — defaults to window.open of the same url. */
  onPopOut?: (url: string) => void;
}

export function InAppGameCanvas({
  url: rawUrl,
  title,
  tone,
  poster,
  id,
  onClose,
  onPopOut,
}: InAppGameCanvasProps) {
  // Same-origin arcade rewrite (open.grudge-studio.com/arcade → CF → GRUDOX)
  const url = rewriteEmbedUrlForOpen(rawUrl);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [d1Note, setD1Note] = useState<string | null>(null);
  const accent = loadingParticleColor(tone);
  const embedOk = isLikelyEmbeddable(url);
  const profile = id ? profileForZone(id) : null;

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    setElapsed(0);
    setD1Note(null);
    // Warm D1 asset_registry for this zone (CDN keys / metadata)
    if (id) {
      void warmZoneD1Assets(id).then((rows) => {
        if (rows.length) setD1Note(`D1 packs · ${rows.length} assets`);
      });
    }
    // Host known to refuse frames → fail fast with pop-out (do not wait 8s)
    if (!embedOk) {
      setFailed(true);
      setLoading(false);
      return;
    }
    const t0 = performance.now();
    const tick = window.setInterval(() => {
      setElapsed((performance.now() - t0) / 1000);
    }, 250);
    // If load never fires (X-Frame-Options), surface fallback after 8s
    const failTimer = window.setTimeout(() => {
      setFailed(true);
      setLoading(false);
    }, 8000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(failTimer);
    };
  }, [url, embedOk, id]);

  // Notify iframe of Open host focus / gamepad (best-effort; cross-origin may ignore)
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || loading) return;
    try {
      win.postMessage(
        {
          type: "grudge-open-host",
          source: "open.grudge-studio.com",
          zoneId: id,
          controller: profile?.controller ?? "embed",
          goreImpact: profile?.goreImpact ?? false,
          postfx: profile?.postfx ?? false,
        },
        "*",
      );
    } catch {
      /* cross-origin */
    }
  }, [loading, id, profile]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setFailed(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setFailed(true);
  }, []);

  const popOut = useCallback(() => {
    if (onPopOut) onPopOut(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }, [onPopOut, url]);

  // Escape closes canvas (does not kill native engines — this is embed-only)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="iagc-root" style={{ "--iagc-tone": accent } as CSSProperties} data-zone={id}>
      <header className="iagc-bar">
        <div className="iagc-bar-left">
          <button type="button" className="iagc-btn ghost" onClick={onClose} title="Back (Esc)">
            ⏎ Close
          </button>
          <div className="iagc-title">
            <span className="iagc-dot" style={{ background: accent }} />
            <span>{title}</span>
            <span className="iagc-sub">
              play in Open
              {profile?.controller === "danger-room" ? " · DR controller" : ""}
              {profile?.goreImpact ? " · gore/impact" : ""}
              {profile?.postfx ? " · postfx" : ""}
            </span>
          </div>
        </div>
        <div className="iagc-bar-right">
          {d1Note && <span className="iagc-sub" style={{ marginRight: 8 }}>{d1Note}</span>}
          <button type="button" className="iagc-btn ghost" onClick={() => iframeRef.current?.contentWindow?.location.reload()}>
            Reload
          </button>
          <button type="button" className="iagc-btn primary" onClick={popOut}>
            Pop out ↗
          </button>
        </div>
      </header>

      <div className="iagc-stage">
        {/* Poster + particle loading curtain */}
        {(loading || failed) && (
          <div
            className="iagc-curtain"
            style={
              poster
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(4,8,16,0.72), rgba(4,8,16,0.92)), url(${poster})`,
                  }
                : undefined
            }
          >
            <div className="iagc-particles" aria-hidden>
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className="iagc-spark" style={{ "--i": i } as CSSProperties} />
              ))}
            </div>
            <div className="iagc-curtain-card">
              <div className="iagc-spinner" style={{ borderTopColor: accent }} />
              <h2 style={{ color: accent }}>{title}</h2>
              {failed ? (
                <>
                  <p>
                    This host may block embedding (X-Frame-Options). Stay in Open via pop-out, or
                    try again.
                  </p>
                  <div className="iagc-curtain-actions">
                    <button type="button" className="iagc-btn primary" onClick={popOut}>
                      Open pop-out ↗
                    </button>
                    <button type="button" className="iagc-btn ghost" onClick={onClose}>
                      Back to Open
                    </button>
                  </div>
                </>
              ) : (
                <p>
                  Loading fleet game… {elapsed.toFixed(1)}s
                  {!embedOk ? " · host may require pop-out" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          className="iagc-frame"
          title={title}
          src={url}
          allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write; xr-spatial-tracking; pointer-lock; accelerometer; magnetometer"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
}
