/**
 * Wallet service — Grudge Open / GRUDOX account wallet.
 *
 * Production SSOT (Railway Postgres `accounts` row):
 *   1. GET /api/wallet/status  — hasWallet, walletAddress, walletType, gbuxBalance
 *   2. GET /api/account        — walletAddress / walletType fallback
 *   3. POST /api/wallet/create — Crossmint custodial provision (email body)
 *
 * One wallet per account — shared by all characters. Cached in sessionStorage.
 */

import { apiUrl } from "./fleet";
import { getStoredToken } from "./grudgeAuth";

export interface GrudgeWallet {
  address: string;
  /** Solana | Ethereum | … (always "Solana" for Crossmint custodial) */
  chain: string;
  /** Railway DB id (optional — status route may omit) */
  id: string;
  /** grudgeId this wallet belongs to */
  grudgeId: string;
  /** crossmint | external */
  walletType?: string;
  /** Crossmint recovery email when custodial */
  crossmintEmail?: string;
  /** GBUX from wallet status / account */
  gbux?: number;
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

function normalizeWallet(data: Record<string, unknown>): GrudgeWallet | null {
  const w = (data.wallet as Record<string, unknown>) ?? data;
  const address = String(
    w.walletAddress || w.address || w.publicKey || w.solanaAddress || "",
  );
  if (!address) return null;
  return {
    address,
    chain: String(w.chain || w.network || "Solana"),
    id: String(w.id || w.crossmintWalletId || ""),
    grudgeId: String(w.grudgeId || w.grudge_id || ""),
    walletType: w.walletType ? String(w.walletType) : w.wallet_type ? String(w.wallet_type) : undefined,
    crossmintEmail: w.crossmintEmail
      ? String(w.crossmintEmail)
      : w.crossmint_email
        ? String(w.crossmint_email)
        : undefined,
    gbux:
      typeof w.gbuxBalance === "number"
        ? w.gbuxBalance
        : typeof w.gbux === "number"
          ? w.gbux
          : undefined,
    crossmintLocator: w.crossmintLocator ? String(w.crossmintLocator) : undefined,
    createdAt: w.createdAt ? String(w.createdAt) : undefined,
  };
}

/** Live path: GET /api/wallet/status (Railway accounts.wallet_*). */
async function fetchWalletStatus(): Promise<GrudgeWallet | null> {
  try {
    const r = await fetch(apiUrl("/api/wallet/status"), {
      headers: authHeader(),
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    if (data.hasWallet === false && !data.walletAddress) return null;
    return normalizeWallet(data);
  } catch {
    return null;
  }
}

/** Fallback: wallet fields on GET /api/account. */
async function fetchWalletFromAccount(): Promise<GrudgeWallet | null> {
  try {
    const r = await fetch(apiUrl("/api/account"), {
      headers: authHeader(),
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    return normalizeWallet(data);
  } catch {
    return null;
  }
}

async function fetchWallet(): Promise<GrudgeWallet | null> {
  return (await fetchWalletStatus()) || (await fetchWalletFromAccount());
}

async function createWallet(): Promise<GrudgeWallet | null> {
  try {
    // Production route is POST /api/wallet/create { email } — not bare POST /api/wallet.
    const r = await fetch(apiUrl("/api/wallet/create"), {
      method: "POST",
      headers: authHeader(),
      credentials: "include",
      body: JSON.stringify({ email: "player@grudgewarlords.com" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    return normalizeWallet(data) || fetchWallet();
  } catch (err) {
    console.warn("[wallet] create error", err);
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * Ensure the signed-in player has a wallet.
 *
 * Cached → /api/wallet/status → /api/account → optional /api/wallet/create.
 * Fail soft when offline or guest (wallet optional for gameplay).
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
}
