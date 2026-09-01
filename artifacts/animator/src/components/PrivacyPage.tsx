/** Privacy policy overlay — static content, shown from the landing footer. */
interface Props {
  onClose: () => void;
}

export function PrivacyPage({ onClose }: Props) {
  return (
    <div className="legal-overlay">
      <div className="legal-panel">
        <button className="legal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated July 2026</p>

        <h2>What we collect</h2>
        <p>
          Grudge Studio (Animator) uses Grudge ID (built on Puter) to sign you in and
          persist your saved builds, avatars, and progress. When you sign in — including
          as a guest — we store an account identifier and the game data you create
          (avatar configs, scenes, gallery posts, settings). We do not collect payment
          information in this product.
        </p>

        <h2>How we use it</h2>
        <p>
          Your data is used solely to run the game: restoring your session, syncing your
          creations across visits, and displaying content you choose to share (e.g.
          gallery posts). We don't sell your data or share it with third parties for
          advertising.
        </p>

        <h2>Guest accounts</h2>
        <p>
          Continuing as a guest creates a temporary Grudge account so your progress still
          persists between sessions on the same browser. You can upgrade it to a full
          Grudge ID at any time without losing your saved data.
        </p>

        <h2>Your choices</h2>
        <p>
          You can sign out at any time from the landing page. To request deletion of your
          account and associated data, email{" "}
          <a href="mailto:games@grudgestudio.org">games@grudgestudio.org</a>.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy: <a href="mailto:games@grudgestudio.org">games@grudgestudio.org</a>.
        </p>
      </div>
    </div>
  );
}
