/**
 * GRUDOX Realms — collection surface on open.grudge-studio.com/realms
 *
 * Mine-Loader SPA runs in the in-app canvas with fleet SSO handoff.
 * Feels like one Open product; world authority stays Mine-Loader (1 replica).
 */
import { useMemo } from "react";
import { gameSession } from "../game/GameSession";
import { getStoredToken } from "../lib/grudgeAuth";
import { buildMineLoaderUrl } from "../auth/mineLoaderConfig";
import { posterUrl } from "../game/gameLibrary";
import { InAppGameCanvas } from "./InAppGameCanvas";

interface Props {
  onExit: () => void;
  /** Optional surface hash target (lobby / play / editor). */
  surface?: "lobby" | "play" | "home" | "editor";
}

export function RealmsSurface({ onExit, surface = "lobby" }: Props) {
  const url = useMemo(() => {
    const snap = gameSession.snapshot;
    const ch = gameSession.selectedCharacter();
    return buildMineLoaderUrl({
      surface,
      token: getStoredToken(),
      characterId: snap.selectedCharacterId,
      characterName: ch?.name ?? null,
      baseId:
        (typeof ch?.config?.baseId === "string" && ch.config.baseId) ||
        (ch?.raceId ? `race-${ch.raceId}` : null),
    });
  }, [surface]);

  return (
    <InAppGameCanvas
      id="realms"
      url={url}
      title="GRUDOX Realms"
      tone="#7ee0a0"
      poster={posterUrl("library-mine")}
      returnMode="doors"
      onClose={onExit}
      onPopOut={(u) => window.open(u, "_blank", "noopener,noreferrer")}
    />
  );
}
