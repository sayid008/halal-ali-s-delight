import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Halal Ali Dine Inn" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Sign-in Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth check on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (err) {
        console.error("Error checking session:", err);
      } finally {
        setAuthLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
        setErrorMessage(error.message || "Failed to sign in. Please check your credentials.");
        return;
      }

      if (data.session) {
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
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setPassword("");
      setErrorMessage(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // 1. Loading screen while verifying initial session
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-gold" />
          <p className="text-xs font-medium">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Screen: Login Only (Preserving Auth UI/UX)
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
                Sign in with your email and password to access the restaurant management panel
              </p>
            </div>

            {errorMessage && (
              <Alert variant="destructive" className="mt-5 text-xs">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
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
                className="w-full bg-primary text-primary-foreground font-semibold h-10 mt-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In to Admin Portal"
                )}
              </Button>
            </form>
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

  // 3. Authenticated: Render AdminPanel with all UI/UX preserved
  return <AdminPanel session={session} onSignOut={handleLogout} />;
}
