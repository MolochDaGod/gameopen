/**
 * Wallet service — Grudge Open auto-provision wallet.
 *
 * On every login, `ensureWallet()` is called once after account resolution.
 * It:
 *   1. Tries GET /api/wallet — returns the existing wallet if one is already
 *      provisioned for this grudgeId in Railway Postgres.
 *   2. If none exists (404 / empty), calls POST /api/wallet to create a new
 *      Crossmint custodial Solana wallet, scoped to this grudgeId. Railway
 *      handles the Crossmint API call server-side so no Crossmint credentials
 *      are exposed to the browser.
 *
 * Canonical truth: Railway Postgres `wallets` table, keyed by `grudge_id`.
 * One wallet per account — characters share the account-scoped wallet.
 *
 * The resolved wallet is cached in sessionStorage under "grudge.open.wallet"
 * so subsequent renders don't re-hit the API.
 */

import { apiUrl } from "./fleet";
import { getStoredToken } from "./grudgeAuth";

export interface GrudgeWallet {
  address: string;
  /** Solana | Ethereum | … (always "Solana" for Crossmint custodial) */
  chain: string;
  /** Railway DB id */
  id: string;
  /** grudgeId this wallet belongs to */
  grudgeId: string;
  /** Crossmint locator for server-side operations */
  crossmintLocator?: string;
  createdAt?: string;
}

const WALLET_CACHE_KEY = "grudge.open.wallet";

// ── Cache helpers ─────────────────────────────────────────────────────────

export function getCachedWallet(): GrudgeWallet | null {
  try {
    const raw = sessionStorage.getItem(WALLET_CACHE_KEY);
    return raw ? (JSON.parse(raw) as GrudgeWallet) : null;
  } catch {
    return null;
  }
}

function setCachedWallet(w: GrudgeWallet | null): void {
  try {
    if (!w) sessionStorage.removeItem(WALLET_CACHE_KEY);
    else sessionStorage.setItem(WALLET_CACHE_KEY, JSON.stringify(w));
  } catch {
    /* private mode */
  }
}

// ── API helpers ───────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const token = getStoredToken();
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Once we know Railway has no wallet route, skip further probes this session. */
let walletRouteMissing = false;

async function fetchWallet(): Promise<GrudgeWallet | null> {
  if (walletRouteMissing) return null;
  try {
    // Single canonical path — do not spam /account/wallet + /wallets (triple 404 noise).
    const r = await fetch(apiUrl("/api/wallet"), {
      headers: authHeader(),
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 404) {
      walletRouteMissing = true;
      return null;
    }
    if (!r.ok) return null;
    const data = await r.json() as Record<string, unknown>;
    // Normalise Railway response shape: may be top-level or nested under `wallet`
    const w = (data.wallet as Record<string, unknown>) ?? data;
    const address = String(w.address || w.publicKey || w.solanaAddress || "");
    if (!address) return null;
    return {
      address,
      chain: String(w.chain || w.network || "Solana"),
      id: String(w.id || ""),
      grudgeId: String(w.grudgeId || w.grudge_id || ""),
      crossmintLocator: w.crossmintLocator ? String(w.crossmintLocator) : undefined,
      createdAt: w.createdAt ? String(w.createdAt) : undefined,
    };
  } catch {
    return null;
  }
}

async function createWallet(): Promise<GrudgeWallet | null> {
  if (walletRouteMissing) return null;
  try {
    const r = await fetch(apiUrl("/api/wallet"), {
      method: "POST",
      headers: authHeader(),
      credentials: "include",
      body: JSON.stringify({ chain: "Solana", type: "custodial" }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.status === 404) {
      walletRouteMissing = true;
      // Wallet optional — Railway may not expose /api/wallet yet
      return null;
    }
    if (!r.ok) {
      return null;
    }
    const data = await r.json() as Record<string, unknown>;
    const w = (data.wallet as Record<string, unknown>) ?? data;
    const address = String(w.address || w.publicKey || w.solanaAddress || "");
    if (!address) return null;
    return {
      address,
      chain: String(w.chain || "Solana"),
      id: String(w.id || ""),
      grudgeId: String(w.grudgeId || w.grudge_id || ""),
      crossmintLocator: w.crossmintLocator ? String(w.crossmintLocator) : undefined,
      createdAt: w.createdAt ? String(w.createdAt) : undefined,
    };
  } catch (err) {
    console.warn("[wallet] create error", err);
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * Ensure the signed-in player has a wallet.
 *
 * Returns the cached wallet immediately if available.
 * Otherwise fetches from Railway; if none exists, provisions a new one via
 * POST /api/wallet (Railway calls Crossmint server-side — no client credentials).
 *
 * Always returns null gracefully when the user is not logged in or the API
 * is unreachable (wallet is optional for gameplay).
 */
export async function ensureWallet(): Promise<GrudgeWallet | null> {
  // Fast path: already cached this session.
  const cached = getCachedWallet();
  if (cached?.address) return cached;

  if (!getStoredToken()) return null; // guest — no wallet

  // Fetch existing wallet.
  let wallet = await fetchWallet();

  // Provision if none exists.
  if (!wallet) {
    wallet = await createWallet();
  }

  if (wallet) setCachedWallet(wallet);
  return wallet;
}

/**
 * Get the cached wallet address (truncated for display).
 * Returns e.g. "7Xm3…k9fR" or null.
 */
export function getWalletDisplay(): string | null {
  const w = getCachedWallet();
  if (!w?.address || w.address.length < 10) return null;
  return `${w.address.slice(0, 4)}…${w.address.slice(-4)}`;
}

/** Clear the cached wallet (called on logout). */
export function clearCachedWallet(): void {
  setCachedWallet(null);
  walletRouteMissing = false;
}
