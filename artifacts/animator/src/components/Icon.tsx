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

/**
 * Render a framed RPG icon by name and/or absolute URL.
 * Tries same-origin, then fleet R2 / ObjectStore live resolve on error.
 */
export function Icon({ name, src, fallbackName, size = 22, className, title }: Props) {
  const local = name || fallbackName || "skill-slot";
  const primary = src && (src.startsWith("http") || src.startsWith("/")) ? src : src || iconUrl(local);
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
        // Local skill_nobg warrior → info CDN (ObjectStore)
        if (!triedLive && url.includes("/icons/skill_nobg/Warriorskill_")) {
          setTriedLive(true);
          const file = url.split("/").pop();
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
          // Immediate R2 root candidate while async resolves
          setUrl(`${FLEET_ASSET_HOSTS.r2}/icons/${String(local).replace(/\.png$/i, "")}.png`);
          return;
        }
        const fb = iconUrl(fallbackName || local || "skill-slot");
        setUrl((cur) => (cur !== fb ? fb : cur));
      }}
    />
  );
}
