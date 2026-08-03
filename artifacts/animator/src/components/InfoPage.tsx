/**
 * Info / About overlay — studio + creator background, shown from the
 * landing page footer. Static content, no auth/network dependency.
 */
const emblemArt = `${import.meta.env.BASE_URL}emblem.png`;
const jbPortrait = `${import.meta.env.BASE_URL}backdrops/jb_portrait.jpg`;

interface Props {
  onClose: () => void;
}

export function InfoPage({ onClose }: Props) {
  return (
    <div className="legal-overlay">
      <div className="legal-panel">
        <button className="legal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <img className="legal-emblem" src={emblemArt} alt="" draggable={false} />
        <h1 className="legal-title">About Grudge Studio</h1>

        <p>
          Grudge Studio builds browser-native games and creative tools — Warlords, a
          dark-fantasy RPG era with character creation, crafting, and Souls-like PvP;
          Warlord Genesis, a lane-based hero RTS; and the Animator you're standing in
          right now, a live 3D character, combat, and world-authoring sandbox. Everything
          runs straight in the browser under one Grudge ID, with cloud sync across
          products.
        </p>
        <p>
          Find the full lineup at{" "}
          <a href="https://grudge-studio.com" target="_blank" rel="noreferrer">
            grudge-studio.com
          </a>
          .
        </p>

        <div className="legal-person">
          <img className="legal-portrait" src={jbPortrait} alt="JB Emmons" draggable={false} />
          <div>
            <h2>JB Emmons</h2>
            <p>
              Founder of Grudge Studio. Background spanning blockchain, crypto-mining
              infrastructure, and legal research, now channelled into building game worlds
              and the tools that make them. More at{" "}
              <a href="https://jbemmons.com" target="_blank" rel="noreferrer">
                jbemmons.com
              </a>
              .
            </p>
          </div>
        </div>

        <h2>Get in touch</h2>
        <ul className="legal-links">
          <li>
            <a href="https://grudge-studio.com" target="_blank" rel="noreferrer">
              grudge-studio.com
            </a>
          </li>
          <li>
            <a href="https://x.com/GrudgeStudio" target="_blank" rel="noreferrer">
              @GrudgeStudio on X
            </a>
          </li>
          <li>
            <a href="https://discord.gg/Hq9h3QKDfg" target="_blank" rel="noreferrer">
              Grudge Studio Discord
            </a>
          </li>
          <li>
            <a href="mailto:games@grudgestudio.org">games@grudgestudio.org</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
