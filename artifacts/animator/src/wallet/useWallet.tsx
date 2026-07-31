/**
 * Wallet connect + account-link state machine.
 *
 * Flow: connect Phantom (injected extension, mobile deeplink, or install
 * fallback) → ask the server for a one-time nonce → the user signs the exact
 * message in Phantom → the server verifies the ed25519 signature and stores the
 * address against the signed-in Clerk account.
 *
 * The provider exposes both the browser-session connection (Phantom) and the
 * server-side link (which survives across devices/sessions independently of
 * whether Phantom is currently connected).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyWallet,
  getGetMyWalletQueryKey,
  createWalletNonce,
  linkWallet,
  unlinkWallet,
  type WalletInfo,
} from "@workspace/api-client-react";
import {
  getPhantom,
  encodeSignature,
  isMobileDevice,
  getDeeplinkToPhantom,
  waitForPhantomExtension,
  humanizePhantomError,
  connectInjectedSolanaFallback,
  signMessageInjectedFallback,
} from "./phantom";

/** What the connect/link pipeline is currently doing. */
export type WalletPhase =
  | "idle"
  | "connecting"
  | "signing"
  | "linking"
  | "unlinking";

export interface WalletState {
  /** Address of the Phantom wallet connected in THIS browser session (or null). */
  connectedAddress: string | null;
  /** The wallet linked to the account server-side (survives sessions), or null. */
  linkedWallet: WalletInfo | null;
  /** True while the initial server-link query is loading. */
  linkedLoading: boolean;
  phase: WalletPhase;
  /** Human-readable failure from the last attempt (cleared on retry). */
  error: string | null;
  /** True when no extension was found on a desktop browser — show install CTA. */
  needsInstall: boolean;
  /** Whether the current visitor is signed in (linking requires an account). */
  isSignedIn: boolean;
  /** Connect Phantom and (when signed in) prove ownership + link to account. */
  connectAndLink: () => Promise<void>;
  /** Disconnect the browser session only (server link untouched). */
  disconnect: () => Promise<void>;
  /** Remove the server-side link from the account. */
  unlink: () => Promise<void>;
  /** Clear an error / install prompt without acting. */
  dismissError: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

/** Surface a readable message out of unknown SDK / fetch failures. */
function errorMessage(err: unknown): string {
  return humanizePhantomError(err);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [phase, setPhase] = useState<WalletPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsInstall, setNeedsInstall] = useState(false);
  const busyRef = useRef(false);

  // Server-side link (only meaningful when signed in).
  const walletQuery = useGetMyWallet({
    query: {
      queryKey: getGetMyWalletQueryKey(),
      enabled: !!isSignedIn,
      staleTime: 60_000,
    },
  });
  const linkedWallet = isSignedIn ? (walletQuery.data?.wallet ?? null) : null;

  // Resume injected session only — never autoConnect Auth2 (that caused 400s).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hasExt = await waitForPhantomExtension(800);
        if (!hasExt || cancelled) return;
        const sdk = getPhantom();
        // Injected-only resume; ignore Auth2 errors completely
        try {
          await sdk.autoConnect();
        } catch {
          /* Auth2/auto may fail — fall through to silent address read */
        }
        if (cancelled) return;
        try {
          const addresses = await sdk.getAddresses();
          const sol = addresses.find(
            (a) =>
              (a as { addressType?: string }).addressType === "Solana" ||
              (a as { addressType?: string }).addressType === "solana",
          );
          if (sol?.address) {
            setConnectedAddress(sol.address);
            return;
          }
        } catch {
          /* */
        }
        // window.solana trusted connect (no popup)
        const w = window as unknown as {
          phantom?: { solana?: { isConnected?: boolean; publicKey?: { toBase58(): string } } };
        };
        const inj = w.phantom?.solana;
        if (inj?.isConnected && inj.publicKey) {
          setConnectedAddress(inj.publicKey.toBase58());
        }
      } catch {
        /* no prior session */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLink = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetMyWalletQueryKey() });
  }, [queryClient]);

  const connectAndLink = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setNeedsInstall(false);
    try {
      // 1. Extension required for injected connect (avoids Auth2 /login/start 400)
      setPhase("connecting");
      const hasExtension = await waitForPhantomExtension(2000);
      if (!hasExtension) {
        if (isMobileDevice()) {
          window.location.href = getDeeplinkToPhantom("grudge-studio");
          return;
        }
        setNeedsInstall(true);
        setError("Install the Phantom browser extension to connect (embedded Auth2 is disabled).");
        return;
      }

      // 2. Connect via SDK injected provider, with window.solana fallback
      let address: string | null = null;
      try {
        const sdk = getPhantom();
        await sdk.connect({ provider: "injected" });
        const addresses = await sdk.getAddresses();
        const sol = addresses.find(
          (a) =>
            String((a as { addressType?: string }).addressType || "").toLowerCase() ===
            "solana",
        );
        address = sol?.address ?? null;
      } catch (sdkErr) {
        // Never surface raw Auth2 400 if we can recover via inject
        console.warn("[wallet] SDK connect failed, trying window.phantom.solana", sdkErr);
        address = await connectInjectedSolanaFallback();
        if (!address) throw sdkErr;
      }
      if (!address) {
        address = await connectInjectedSolanaFallback();
      }
      if (!address) throw new Error("No Solana address available in this wallet.");
      setConnectedAddress(address);

      // 3. Ownership proof + account link (needs a signed-in account).
      if (!isSignedIn) return;

      setPhase("signing");
      const { message } = await createWalletNonce({ address });
      let sigBytes: Uint8Array | null = null;
      try {
        const sdk = getPhantom();
        const signed = await sdk.solana.signMessage(message);
        sigBytes = signed.signature;
      } catch {
        sigBytes = await signMessageInjectedFallback(message);
      }
      if (!sigBytes) throw new Error("Could not sign message in Phantom.");

      setPhase("linking");
      await linkWallet({
        address,
        signature: encodeSignature(sigBytes),
      });
      await refreshLink();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPhase("idle");
      busyRef.current = false;
    }
  }, [isSignedIn, refreshLink]);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await getPhantom().disconnect();
    } catch {
      /* already disconnected */
    }
    setConnectedAddress(null);
  }, []);

  const unlink = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setPhase("unlinking");
    try {
      await unlinkWallet();
      await refreshLink();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPhase("idle");
      busyRef.current = false;
    }
  }, [refreshLink]);

  const dismissError = useCallback(() => {
    setError(null);
    setNeedsInstall(false);
  }, []);

  const value: WalletState = {
    connectedAddress,
    linkedWallet,
    linkedLoading: !!isSignedIn && walletQuery.isLoading,
    phase,
    error,
    needsInstall,
    isSignedIn: !!isSignedIn,
    connectAndLink,
    disconnect,
    unlink,
    dismissError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
