/** Terms of Service overlay — static content, shown from the landing footer. */
interface Props {
  onClose: () => void;
}

export function TermsPage({ onClose }: Props) {
  return (
    <div className="legal-overlay">
      <div className="legal-panel">
        <button className="legal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last updated July 2026</p>

        <h2>Using the service</h2>
        <p>
          Animator and the rest of the Grudge Studio lineup are provided as-is for
          personal, non-commercial entertainment. By signing in with Grudge ID or
          continuing as a guest, you agree to these terms.
        </p>

        <h2>Accounts</h2>
        <p>
          You're responsible for the activity on your Grudge ID, including guest accounts
          upgraded from this device. Don't share accounts in ways that violate other
          players' access, and don't attempt to disrupt, exploit, or reverse-engineer the
          service.
        </p>

        <h2>User content</h2>
        <p>
          Avatars, scenes, and gallery posts you create remain yours, but by posting to a
          shared gallery you grant Grudge Studio a licence to display that content within
          the product. Don't upload content that's illegal, infringing, or that you don't
          have the rights to.
        </p>

        <h2>Availability</h2>
        <p>
          Grudge Studio is under active development. Features, worlds, and saved data may
          change or be reset as the game evolves; we'll do our best to communicate major
          changes through the game or our channels.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: <a href="mailto:games@grudgestudio.org">games@grudgestudio.org</a>.
        </p>
      </div>
    </div>
  );
}
