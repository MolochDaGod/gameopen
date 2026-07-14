/**
 * Clerk is optional on gameopen — production prefers Grudge ID fleet SSO.
 * When VITE_CLERK_PUBLISHABLE_KEY is unset we run GuestShell without <ClerkProvider>,
 * but many surfaces still call useAuth/useUser. These wrappers never throw.
 *
 * isClerkEnabled is a build-time constant, so the conditional hook path is stable
 * for the lifetime of a given bundle (Rules of Hooks safe).
 */
import { useAuth, useUser } from "@clerk/clerk-react";
import { getStoredToken } from "../lib/grudgeAuth";

export const isClerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/** Guest / Grudge-ID getToken: never throws, returns fleet JWT when present. */
async function fleetOrNullToken(): Promise<string | null> {
  try {
    return getStoredToken();
  } catch {
    return null;
  }
}

/**
 * useAuth that works with or without <ClerkProvider>.
 * Without Clerk, isSignedIn is false and getToken returns the Grudge fleet token if any.
 */
export function useOptionalAuth() {
  if (!isClerkEnabled) {
    return {
      isLoaded: true as const,
      isSignedIn: false as const,
      userId: null as string | null,
      sessionId: null as string | null,
      actor: null,
      orgId: null as string | null,
      orgRole: null,
      orgSlug: null as string | null,
      has: (() => false) as (params?: unknown) => boolean,
      signOut: async () => {},
      getToken: fleetOrNullToken,
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- path fixed at build time
  return useAuth();
}

/**
 * useUser that works with or without <ClerkProvider>.
 * Without Clerk, always "signed out" (use FleetBar / grudgeAuth for identity).
 */
export function useOptionalUser() {
  if (!isClerkEnabled) {
    return {
      isLoaded: true as const,
      isSignedIn: false as const,
      user: null,
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- path fixed at build time
  return useUser();
}
