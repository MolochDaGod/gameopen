/**
 * Fleet character portrait image — uses {@link resolveCharacterPortrait}.
 * Prefer this over ad-hoc races/*.png in pickers / roster / campfire UI.
 */
import type { CSSProperties } from "react";
import type { GrudgeCharacter } from "../lib/grudgeAuth";
import {
  portraitOnError,
  resolveCharacterPortrait,
} from "../lib/characterPortrait";

export interface CharacterAvatarProps {
  character: GrudgeCharacter | null | undefined;
  size?: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
  /** Show race/class caption under image */
  showMeta?: boolean;
}

export function CharacterAvatar({
  character,
  size = 48,
  className,
  style,
  alt,
  showMeta,
}: CharacterAvatarProps) {
  const p = resolveCharacterPortrait(character);
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        ...style,
      }}
    >
      <img
        src={p.url}
        alt={alt ?? character?.name ?? "Character"}
        width={size}
        height={size}
        draggable={false}
        loading="lazy"
        decoding="async"
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(6, Math.round(size * 0.16)),
          objectFit: "cover",
          border: "1px solid rgba(79,195,255,0.35)",
          background: "rgba(7,11,20,0.85)",
          flexShrink: 0,
        }}
        onError={(e) => portraitOnError(e.currentTarget, p.candidates)}
      />
      {showMeta ? (
        <span style={{ fontSize: 10, opacity: 0.75, textAlign: "center", maxWidth: size + 24 }}>
          {p.isVoxel ? "Voxel head" : `${p.paperRace} · ${p.presetId}`}
        </span>
      ) : null}
    </span>
  );
}
