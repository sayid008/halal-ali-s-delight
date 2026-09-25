import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, Component } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Halal Ali Dine Inn" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRoute,
});

const DEFAULT_ADMIN_USER: User = {
  id: "admin-user",
  app_metadata: { role: "admin" },
  user_metadata: { name: "Restaurant Manager" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
  email: "admin@halal-ali.com",
};

const DEFAULT_ADMIN_SESSION: Session = {
  access_token: "direct-admin-session-token",
  token_type: "bearer",
  expires_in: 31536000,
  refresh_token: "direct-admin-refresh-token",
  user: DEFAULT_ADMIN_USER,
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AdminPanel error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="rounded-2xl border border-destructive/30 bg-card p-7 shadow-lg">
              <ShieldAlert className="mx-auto size-12 text-destructive mb-3" />
              <h2 className="text-xl font-bold text-foreground">Admin Recovery Mode</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                The panel encountered an unexpected state. You can safely reopen the dashboard with
                clean defaults.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    window.location.reload();
                  }}
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  <RefreshCw className="mr-2 size-4" />
                  Reload Admin Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("halal_ali_menu_order");
                    }
                    this.setState({ hasError: false, error: null });
                    window.location.reload();
                  }}
                >
                  Reset Local Cache & Reopen
                </Button>
              </div>
            </div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Return to Website
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminRoute() {
  // By default, open the admin panel directly unless user explicitly signed out in current session
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined") {
      const explicitSignOut = sessionStorage.getItem("admin_explicit_sign_out");
      if (explicitSignOut === "true") {
        return null;
      }
    }
    return DEFAULT_ADMIN_SESSION;
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const explicitSignOut = sessionStorage.getItem("admin_explicit_sign_out");
      if (explicitSignOut === "true") {
        return null;
      }
    }
    return DEFAULT_ADMIN_USER;
  });

  // Sign-in Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync Supabase Auth session if active
  useEffect(() => {
    async function initAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user ?? null);
        }
      } catch (err) {
        console.error("Error checking session:", err);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user ?? null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleDirectAccess = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("admin_explicit_sign_out");
    }
    setSession(DEFAULT_ADMIN_SESSION);
    setUser(DEFAULT_ADMIN_USER);
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(
          error.message || "Failed to sign in. Click 'Open Admin Panel Directly' to bypass.",
        );
        return;
      }

      if (data.session) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("admin_explicit_sign_out");
        }
        setSession(data.session);
        setUser(data.user);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred during login.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("admin_explicit_sign_out", "true");
      }
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setPassword("");
      setErrorMessage(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Unauthenticated Screen (only shown if user explicitly clicked Sign Out in the admin panel)
  if (!session || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-lg sm:p-9">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="size-6 text-gold" />
              </div>
              <h1 className="text-2xl font-serif font-bold tracking-tight text-foreground">
                Admin Portal
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Manage dishes, categories, prices, and special offers
              </p>
            </div>

            {errorMessage && (
              <Alert variant="destructive" className="mt-5 text-xs">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="mt-6 space-y-4">
              <Button
                type="button"
                onClick={handleDirectAccess}
                className="w-full bg-primary text-primary-foreground font-semibold h-11 text-sm shadow-md cursor-pointer hover:brightness-110 transition-all"
              >
                Open Admin Dashboard
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    or sign in with password
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email" className="text-xs font-medium text-foreground">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="admin-email"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="admin@halal-ali.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-sm"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="admin-password" className="text-xs font-medium text-foreground">
                      Password
                    </Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 text-sm"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  className="w-full font-semibold h-10 cursor-pointer"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In with Password"
                  )}
                </Button>
              </form>
            </div>
          </div>

          <div className="text-center">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Link to="/">
                <ArrowLeft className="mr-1.5 size-3.5" />
                Return to Website
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: Render AdminPanel inside ErrorBoundary
  return (
    <AdminErrorBoundary>
      <AdminPanel session={session} onSignOut={handleLogout} />
    </AdminErrorBoundary>
  );
}
