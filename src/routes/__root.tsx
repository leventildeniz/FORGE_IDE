import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIDEStore } from "@/stores/ide-store"; // Import useIDEStore
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The editor failed to load. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Forge — AI Coding IDE" },
      {
        name: "description",
        content:
          "Forge is a minimal, code-first AI coding IDE. Write, understand, and ship code with an AI pair programmer.",
      },
      { property: "og:title", content: "Forge — AI Coding IDE" },
      {
        property: "og:description",
        content: "Minimal, code-first AI coding IDE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate(); // useNavigate hook'unu import ettik
  const initializeBackendConnection = useIDEStore((state) => state.initializeBackendConnection);
  const projectRootPath = useIDEStore((state) => state.projectRootPath); // projectRootPath'i store'dan alıyoruz
  const isAppLocked = useIDEStore((state) => state.isAppLocked);
  const appPasswordHash = useIDEStore((state) => state.appPasswordHash);
  const setAppLocked = useIDEStore((state) => state.setAppLocked);
  const setAppPasswordHash = useIDEStore((state) => state.setAppPasswordHash);

  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appPasswordHash) {
      // Set new password
      if (passwordInput.trim().length < 4) {
        setErrorMsg("Password must be at least 4 characters.");
        return;
      }
      setAppPasswordHash(passwordInput.trim());
      setAppLocked(false);
      setErrorMsg("");
    } else {
      // Check password
      if (passwordInput.trim() === appPasswordHash) {
        setAppLocked(false);
        setErrorMsg("");
      } else {
        setErrorMsg("Incorrect password.");
      }
    }
  };

  useEffect(() => {
    console.log("RootComponent useEffect: Initializing backend connection.");
    initializeBackendConnection();

    // Backend bağlantısı kurulduktan ve suggested roots alındıktan sonra projectRootPath hala null ise,
    // kullanıcıyı başlangıç sayfasına yönlendir.
    if (projectRootPath === null && !isAppLocked) {
      console.log("RootComponent useEffect: projectRootPath is null, redirecting to /.");
      navigate({ to: "/" });
    }
  }, [initializeBackendConnection, projectRootPath, navigate, isAppLocked]); // Bağımlılıkları güncelledik
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {isAppLocked ? (
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="max-w-md w-full space-y-6 text-center border border-border bg-card p-8 rounded-lg shadow-xl">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="size-6" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {appPasswordHash ? "Enter Password" : "Set Master Password"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {appPasswordHash
                  ? "Forge IDE is locked. Please enter your password to continue."
                  : "Welcome to Forge IDE. Please set a master password to secure your local workspace."}
              </p>
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <Input
                    type="password"
                    autoFocus
                    placeholder="Password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full"
                  />
                  {errorMsg && <p className="text-red-400 text-xs mt-2 text-left">{errorMsg}</p>}
                </div>
                <Button type="submit" className="w-full">
                  {appPasswordHash ? "Unlock IDE" : "Save & Unlock"}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <Outlet />
            <Toaster />
          </>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
