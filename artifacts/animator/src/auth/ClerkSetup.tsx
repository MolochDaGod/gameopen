import { useEffect, useRef, type ReactNode } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
} from "@clerk/clerk-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { dark } from "@clerk/themes";
import {
  Switch,
  Route,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";

// Only use VITE_CLERK_PUBLISHABLE_KEY from env. Do NOT derive a key from
// window.location.hostname when the env key is absent — publishableKeyFromHost
// generates a syntactically-valid but non-existent key like
// `pk_live_Z2FtZW9wZW4udmVyY2VsLmFwcCQ` which causes Clerk to try loading
// from a non-existent `clerk.gameopen.vercel.app` subdomain (ERR_CONNECTION_CLOSED).
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || null;

// Empty in dev (Clerk hits dev FAPI directly), auto-set in prod. Do not gate on
// import.meta.env.PROD / NODE_ENV — the empty dev value is intentional.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's setLocation
// prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

/**
 * Grudge fleet: Clerk is optional. When VITE_CLERK_PUBLISHABLE_KEY is unset,
 * AppShell runs in guest mode so the Danger Room works without Replit/Clerk.
 * Prefer Grudge ID for production identity (see lib/fleet.ts).
 */
const clerkEnabled = Boolean(clerkPubKey);


const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#6ea8ff",
    colorBackground: "#0b1220",
    colorInputBackground: "#111a2c",
    colorInputText: "#eaf4ff",
    colorText: "#eaf4ff",
    colorTextSecondary: "#9bb3d4",
    colorDanger: "#ff6b6b",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "0.6rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0b1220] border border-[#1d2b45] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!bg-transparent",
    headerTitle: "text-[#eaf4ff]",
    headerSubtitle: "text-[#9bb3d4]",
    socialButtonsBlockButton: "border border-[#26375a] text-[#eaf4ff]",
    formFieldLabel: "text-[#cfe0fa]",
    formButtonPrimary: "bg-[#4f7bff] hover:bg-[#3f6bef] text-white",
    footerActionText: "text-[#9bb3d4]",
    footerActionLink: "text-[#8ec3ff] hover:text-[#aed4ff]",
    dividerText: "text-[#9bb3d4]",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#070b14] px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        afterSignInUrl={basePath || "/"}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#070b14] px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        afterSignUpUrl={basePath || "/"}
      />
    </div>
  );
}

// Invalidate cached gallery/lobby data when the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// Attach the live Clerk session token to every api-client request so
// authenticated routes (post create / my posts) work once signed in.
function ApiAuthBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    });
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function ClerkProviderWithRoutes({ home }: { home: ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ApiAuthBridge />
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route>{home}</Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function GuestShell({ home }: { home: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/sign-in/*?">
          <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#070b14] px-4 text-center text-[#cfe0fa]">
            <p className="text-lg font-semibold text-[#eaf4ff]">Grudge Open</p>
            <p className="max-w-md text-sm text-[#9bb3d4]">
              Guest mode — set <code className="text-[#8ec3ff]">VITE_CLERK_PUBLISHABLE_KEY</code> for
              Clerk, or use{" "}
              <a className="text-[#8ec3ff] underline" href="https://id.grudge-studio.com/login">
                Grudge ID
              </a>{" "}
              for fleet SSO.
            </p>
            <a
              className="rounded-lg bg-[#4f7bff] px-4 py-2 text-sm font-medium text-white hover:bg-[#3f6bef]"
              href={basePath || "/"}
            >
              Continue as guest
            </a>
          </div>
        </Route>
        <Route path="/sign-up/*?">
          <div className="flex min-h-[100dvh] items-center justify-center bg-[#070b14] px-4">
            <a className="text-[#8ec3ff] underline" href={`${basePath || ""}/`}>
              Back to guest play
            </a>
          </div>
        </Route>
        <Route>{home}</Route>
      </Switch>
    </QueryClientProvider>
  );
}

/** Top-level shell: Wouter + React Query; Clerk only when publishable key is set. */
export function AppShell({ home }: { home: ReactNode }) {
  return (
    <WouterRouter base={basePath}>
      {clerkEnabled ? (
        <ClerkProviderWithRoutes home={home} />
      ) : (
        <GuestShell home={home} />
      )}
    </WouterRouter>
  );
}

