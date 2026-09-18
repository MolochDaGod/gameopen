export const RACE_LAPS = 3;
export const CHECKPOINTS_PER_LAP = 12;
export const LAP_DISTANCE = 1_200;
export const RACE_DISTANCE = RACE_LAPS * LAP_DISTANCE;

export interface RaceProgress {
  lap: number;
  checkpoint: number;
  finished: boolean;
}

export function raceProgress(distance: number): RaceProgress {
  const clampedDistance = Math.max(0, distance);
  const finished = clampedDistance >= RACE_DISTANCE;
  const lap = Math.min(RACE_LAPS, Math.floor(clampedDistance / LAP_DISTANCE) + 1);
  const lapDistance = finished ? LAP_DISTANCE : clampedDistance % LAP_DISTANCE;
  const checkpoint = Math.min(
    CHECKPOINTS_PER_LAP,
    Math.floor(lapDistance / (LAP_DISTANCE / CHECKPOINTS_PER_LAP)) + 1,
  );

  return { lap, checkpoint, finished };
}
