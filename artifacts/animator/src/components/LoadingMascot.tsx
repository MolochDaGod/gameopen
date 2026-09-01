/**
 * GRUDOX mascot animation — the foreground visual shown whenever the player
 * is stuck waiting: the dedicated play/danger session loader (LoadingScreen)
 * and any REST-backed fetch state (e.g. gallery loading in the Lobby).
 * Purely decorative/non-interactive; corner-anchored so it never blocks the
 * underlying progress text or content.
 */
const mascotGif = `${import.meta.env.BASE_URL}backdrops/landing.gif`;

export function LoadingMascot() {
  return <img className="loading-mascot" src={mascotGif} alt="" draggable={false} aria-hidden="true" />;
}
