import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Initial session check
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
        setLoading(false);
      }
    }

    initAuth();

    // 2. Listen to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  // Initial loading spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Checking authorization...</p>
        </div>
      </div>
    );
  }

  // Authenticated State: Print "admin page opened"
  if (session && user) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-card/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground">
                Admin Panel
              </h1>
              <p className="text-xs text-muted-foreground">Halal Ali Dine Inn</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline-block">
              {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 border-border/60 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-card p-8 shadow-md transition-all sm:p-10">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="size-9" />
            </div>

            <div className="space-y-2 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Authenticated Session
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                admin page opened
              </h2>
              <p className="text-sm text-muted-foreground">
                You are successfully authenticated via Supabase database authentication.
              </p>
            </div>

            <div className="mt-8 space-y-1.5 rounded-xl border border-border/40 bg-muted/40 p-4 font-mono text-xs text-muted-foreground">
              <div className="flex justify-between border-b border-border/30 py-1">
                <span className="font-semibold text-foreground/70">Status:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Active (Logged In)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 py-1">
                <span className="font-semibold text-foreground/70">User Email:</span>
                <span className="text-foreground">{user.email}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-foreground/70">User ID:</span>
                <span className="max-w-[200px] truncate text-foreground sm:max-w-[280px]">
                  {user.id}
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="outline" size="sm" className="w-full text-xs sm:w-auto">
                <Link to="/">
                  <ArrowLeft className="mr-1.5 size-3.5" />
                  View Public Website
                </Link>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                className="w-full gap-1.5 text-xs sm:w-auto"
              >
                <LogOut className="size-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Unauthenticated State: Clean Login Form
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-lg sm:p-9">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="size-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Portal</h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Sign in with your email and password to manage the restaurant
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <Alert variant="destructive" className="mt-5 text-xs">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Login Form */}
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
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-xs font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 text-sm"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full font-medium"
              size="default"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

        {/* Return to website */}
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
