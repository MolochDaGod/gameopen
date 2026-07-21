/**
 * Plays a linear production cinema once per session before revealing children.
 * Used for character select establish, lobby, sector handoffs.
 */
import { useCallback, useState, type ReactNode } from "react";
import { ProductionCinema } from "./ProductionCinema";

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

export function CinemaFlowGate({ cinemaId, force = false, children, onFinished }: Props) {
  const [done, setDone] = useState(() => !force && alreadySeen(cinemaId));

  const complete = useCallback(() => {
    markSeen(cinemaId);
    setDone(true);
    onFinished?.();
  }, [cinemaId, onFinished]);

  if (done) return <>{children}</>;

  return (
    <>
      {/* Pre-mount children invisibly? No — avoid double WebGL. Show cinema only. */}
      <ProductionCinema
        cinemaId={cinemaId}
        mode="flow"
        showHud
        onComplete={() => complete()}
      />
    </>
  );
}
