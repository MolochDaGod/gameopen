import { useEffect, useState } from "react";
import { iconUrl, type IconName } from "../three/icons";

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
 * CDN skill art first; on error falls back to local public/icons/.
 */
export function Icon({ name, src, fallbackName, size = 22, className, title }: Props) {
  const local = name || fallbackName || "skill-slot";
  const primary = src && (src.startsWith("http") || src.startsWith("/")) ? src : src || iconUrl(local);
  const [url, setUrl] = useState(primary);

  useEffect(() => {
    setUrl(primary);
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
        const fb = iconUrl(fallbackName || local || "skill-slot");
        setUrl((cur) => (cur !== fb ? fb : cur));
      }}
    />
  );
}
