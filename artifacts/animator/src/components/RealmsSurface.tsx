/**
 * GRUDOX Realms — collection surface on open.grudge-studio.com/realms
 *
 * Mine-Loader SPA runs in the in-app canvas with fleet SSO handoff.
 * World authority stays Mine-Loader (1 replica).
 *
 * Character law (voxel era only):
 *  - Open's selected hero is often **era=warlords** (Danger/Foundry).
 *  - Do **not** pass that characterId / race baseId into Realms.
 *  - Handoff: SSO token + era=voxel + baseId=explorer.
 *  - Mine-Loader loads Avatar Explorers via GET /api/characters?era=voxel
 *    and resolves player mesh with DRC voxel path (box_hero / TVS — never grudge6).
 *  - No saved voxel avatar → default colored textured Explorer (box_hero).
 */
import { useMemo } from "react";
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
    // Purge Open warlords player handoff — Realms owns era=voxel roster.
    return buildMineLoaderUrl({
      surface,
      token: getStoredToken(),
      characterId: null,
      characterName: null,
      baseId: "explorer",
      // Play surface → DRC combat focus with voxel-era explorer body
      worldMode: surface === "play" ? "drc" : null,
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
