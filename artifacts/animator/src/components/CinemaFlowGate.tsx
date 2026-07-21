/**
 * Plays a linear production cinema once per session before revealing children.
 * Used for character select establish, lobby, sector handoffs.
 *
 * Production pattern: while cinema plays, parallel same-origin REST + mesh
 * HEAD warmup (see productionSystemsPattern.ts) so roster/API is hot when UI mounts.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ProductionCinema } from "./ProductionCinema";
import { warmupProductionSurface } from "../lib/productionSystemsPattern";

function sessionKey(cinemaId: string): string {
  return `grudge.cinema.seen.${cinemaId}`;
}

function alreadySeen(cinemaId: string): boolean {
  try {
    return sessionStorage.getItem(sessionKey(cinemaId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(cinemaId: string): void {
  try {
    sessionStorage.setItem(sessionKey(cinemaId), "1");
  } catch {
    /* private mode */
  }
}

type Props = {
  cinemaId: string;
  /** Force play even if seen this session */
  force?: boolean;
  children: ReactNode;
  onFinished?: () => void;
};

/** Map cinema catalog id → SURFACE_LOAD_PLAN key for REST/mesh warmup. */
function surfaceForCinema(cinemaId: string): string {
  if (cinemaId === "intro_to_characters") return "intro_handoff";
  if (cinemaId === "char_select_establish") return "characters";
  if (cinemaId === "lobby_establish") return "lobby";
  if (cinemaId === "home_island_arrive") return "home_island";
  if (cinemaId === "sector_hellmaw") return "hellmaw";
  if (cinemaId === "danger_establish") return "danger";
  if (cinemaId === "intro_doors") return "doors";
  return "characters";
}

export function CinemaFlowGate({ cinemaId, force = false, children, onFinished }: Props) {
  const [done, setDone] = useState(() => !force && alreadySeen(cinemaId));

  // Parallel production warmup while cinema runs (REST + critical mesh HEAD).
  useEffect(() => {
    if (done) return;
    void warmupProductionSurface(surfaceForCinema(cinemaId)).catch(() => undefined);
  }, [cinemaId, done]);

  const complete = useCallback(() => {
    markSeen(cinemaId);
    setDone(true);
    onFinished?.();
  }, [cinemaId, onFinished]);

  if (done) return <>{children}</>;

  return (
    <ProductionCinema
      cinemaId={cinemaId}
      mode="flow"
      showHud
      onComplete={() => complete()}
    />
  );
}
