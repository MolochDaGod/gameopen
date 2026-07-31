import { useEffect, useState } from "react";
import { iconUrl, iconUrlLive, type IconName } from "../three/icons";
import { FLEET_ASSET_HOSTS } from "../three/fleetAssetResolver";

interface Props {
  /** Local icon registry name under public/icons/. */
  name?: IconName | string;
  /** Absolute CDN / asset URL — preferred when set (skill pack art). */
  src?: string | null;
  /** Fallback when CDN 404s (local name). */
  fallbackName?: IconName | string;
  size?: number;
  className?: string;
  title?: string;
}

/** skill_nobg is not on assets.grudge-studio.com R2 — prefer same-origin / info. */
function rewriteBrokenSkillHost(u: string): string {
  if (!u) return u;
  try {
    if (/assets\.grudge-studio\.com\/icons\/skill/i.test(u)) {
      const file = u.split("/").pop() || "";
      if (/^Warriorskill_\d+_nobg\.png$/i.test(file)) {
        return `/icons/skill_nobg/${file}`;
      }
      const idx = u.indexOf("/icons/");
      if (idx >= 0) {
        return `https://info.grudge-studio.com${u.slice(idx)}`;
      }
    }
  } catch {
    /* keep */
  }
  return u;
}

/**
 * Render a framed RPG icon by name and/or absolute URL.
 * Tries same-origin, then fleet R2 / ObjectStore live resolve on error.
 */
export function Icon({ name, src, fallbackName, size = 22, className, title }: Props) {
  const local = name || fallbackName || "skill-slot";
  const rawPrimary =
    src && (src.startsWith("http") || src.startsWith("/")) ? src : src || iconUrl(local);
  // Never hit assets R2 for skill_nobg (404) — rewrite on first paint
  const primary = rewriteBrokenSkillHost(rawPrimary);
  const [url, setUrl] = useState(primary);
  const [triedLive, setTriedLive] = useState(false);

  useEffect(() => {
    setUrl(primary);
    setTriedLive(false);
  }, [primary]);

  return (
    <img
      src={url}
      width={size}
      height={size}
      className={`icon ${className ?? ""}`}
      alt=""
      title={title}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => {
        // skill_nobg on assets CDN → same-origin or info (R2 does not host these)
        if (!triedLive && /skill_nobg|icons\/skill\//i.test(url)) {
          setTriedLive(true);
          const file = url.split("/").pop();
          if (file && /Warriorskill_/i.test(file)) {
            // Same-origin first (shipped under public/icons/skill_nobg)
            if (!url.startsWith("/icons/skill_nobg/")) {
              setUrl(`/icons/skill_nobg/${file}`);
              return;
            }
            setUrl(`https://info.grudge-studio.com/icons/skill_nobg/${file}`);
            return;
          }
          if (file) {
            setUrl(`https://info.grudge-studio.com/icons/skill_nobg/${file}`);
            return;
          }
        }
        if (!triedLive && name) {
          setTriedLive(true);
          void iconUrlLive(name).then((live) => {
            setUrl((cur) => (live && live !== cur ? live : cur));
          });
          // Immediate R2 root candidate while async resolves (pack icons only)
          if (!/skill_nobg/i.test(String(local))) {
            setUrl(`${FLEET_ASSET_HOSTS.r2}/icons/${String(local).replace(/\.png$/i, "")}.png`);
          }
          return;
        }
        const fb = iconUrl(fallbackName || local || "skill-slot");
        setUrl((cur) => (cur !== fb ? fb : cur));
      }}
    />
  );
}
