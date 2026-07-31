/**
 * Phantom wallet client (Solana) for Grudge Studio.
 *
 * Thin wrapper around `@phantom/browser-sdk` **injected provider only**.
 * We use Phantom solely to PROVE ownership (sign a server nonce). The app never
 * touches keys, balances, tokens, or custodial Auth2 embedded wallets.
 *
 * IMPORTANT (Auth2 400):
 * Do NOT use provider `"phantom"` or embedded OAuth (`google`/`apple`) unless
 * the exact origin is allowlisted in Phantom Portal for this App ID.
 * Invalid provider `"phantom"` + authOptions causes:
 *   "Auth2 /login/start request failed (400). Bad Request"
 * Docs: providers are only `injected` | `google` | `apple`.
 */
import {
  BrowserSDK,
  AddressType,
  NetworkId,
  isMobileDevice,
  getDeeplinkToPhantom,
  waitForPhantomExtension,
} from "@phantom/browser-sdk";
import bs58 from "bs58";

/**
 * Public Phantom App ID for Grudge Studio (safe to ship).
 * Only needed if we re-enable embedded OAuth later with portal allowlists.
 */
const PHANTOM_APP_ID = "399d2638-ad4a-4306-84ea-7270d7a7bef9";

/** Where to install Phantom when the extension isn't present. */
export const PHANTOM_INSTALL_URL = "https://phantom.app/download";

/**
 * Origins that must be allowlisted in Phantom Portal if embedded Auth is used.
 * Injected extension connect does not need Auth2 /login/start.
 */
export const PHANTOM_ALLOWED_ORIGINS = [
  "https://open.grudge-studio.com",
  "https://character.grudge-studio.com",
  "https://client.grudge-studio.com",
  "https://grudgewarlords.com",
  "http://localhost:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
] as const;

let sdk: BrowserSDK | null = null;

/**
 * Injected-only SDK. No Auth2 redirect, no embedded wallet.
 * Fixes "Unable to complete login / Auth2 /login/start 400".
 */
export function getPhantom(): BrowserSDK {
  if (!sdk) {
    sdk = new BrowserSDK({
      // ONLY the browser extension — never "phantom" (invalid) or OAuth without portal setup
      providers: ["injected"],
      addressTypes: [AddressType.solana],
      // appId optional for injected-only; keep for future dual-mode without enabling Auth2
      appId: PHANTOM_APP_ID,
    });
  }
  return sdk;
}

/**
 * Reset cached SDK (e.g. after provider-config change during HMR).
 */
export function resetPhantomSdk(): void {
  sdk = null;
}

export { isMobileDevice, getDeeplinkToPhantom, waitForPhantomExtension, PHANTOM_APP_ID };

/** Re-export so callers don't reach into the SDK package directly. */
export const SOLANA_MAINNET = NetworkId.SOLANA_MAINNET;

/** Encode a raw signature (Uint8Array) as base58 for transport to the server. */
export function encodeSignature(sig: Uint8Array): string {
  return bs58.encode(sig);
}

/** Shorten a base58 address for display, e.g. `7Xk9…3Fad`. */
export function shortenAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Map SDK / network errors to actionable UI copy.
 * Special-cases Auth2 400 which used to appear as "Unable to complete login".
 */
export function humanizePhantomError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Something went wrong. Please try again.";

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    if (parsed?.error) return humanizePhantomError(parsed.error);
    if (parsed?.message) return humanizePhantomError(parsed.message);
  } catch {
    /* not JSON */
  }

  if (/reject|denied|cancel/i.test(raw)) {
    return "Request was cancelled in Phantom.";
  }
  if (/Auth2|login\/start|Unable to complete login|400|Bad Request/i.test(raw)) {
    return (
      "Phantom Auth2 login failed (400). " +
      "Use the Phantom browser extension (injected) — embedded login is disabled. " +
      "Install Phantom, unlock it, then try Connect again. " +
      `If this persists on a custom domain, allowlist ${typeof window !== "undefined" ? window.location.origin : "this origin"} in Phantom Portal.`
    );
  }
  if (/not found|no provider|extension/i.test(raw)) {
    return "Phantom extension not detected. Install from phantom.app/download and refresh.";
  }
  return raw;
}

/**
 * Prefer window.phantom.solana / window.solana when SDK still fails.
 * Pure injected path — never hits Auth2.
 */
export async function connectInjectedSolanaFallback(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: InjectedSolana };
    solana?: InjectedSolana;
  };
  const provider = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
  if (!provider?.connect) return null;
  const resp = await provider.connect();
  const pk = resp.publicKey;
  if (!pk) return null;
  if (typeof pk === "string") return pk;
  if (typeof pk.toBase58 === "function") return pk.toBase58();
  if (typeof pk.toString === "function") return pk.toString();
  return null;
}

export async function signMessageInjectedFallback(
  message: string,
): Promise<Uint8Array | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: InjectedSolana };
    solana?: InjectedSolana;
  };
  const provider = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
  if (!provider?.signMessage) return null;
  const encoded = new TextEncoder().encode(message);
  const signed = await provider.signMessage(encoded, "utf8");
  if (signed instanceof Uint8Array) return signed;
  if (signed?.signature instanceof Uint8Array) return signed.signature;
  return null;
}

interface InjectedSolana {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey?: { toBase58?: () => string; toString?: () => string } | string | null;
  }>;
  signMessage?: (
    message: Uint8Array,
    display?: string,
  ) => Promise<Uint8Array | { signature: Uint8Array }>;
  publicKey?: { toBase58?: () => string } | null;
  disconnect?: () => Promise<void>;
}
