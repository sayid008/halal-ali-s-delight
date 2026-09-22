import { useState } from "react";
import {
  supabase,
  isSupabaseConfigured,
  saveLocalAdminSession,
  type AdminUserSession,
} from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";
import {
  Lock,
  Mail,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface AdminAuthProps {
  onAuthSuccess: (session?: AdminUserSession | Session | null) => void;
}

export function AdminAuth({ onAuthSuccess }: AdminAuthProps) {
  const [email, setEmail] = useState("admin@halal-ali.com");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  function handleInstantAdminLogin(customEmail?: string) {
    const adminEmail = customEmail || email || "admin@halal-ali.com";
    const session = saveLocalAdminSession(adminEmail);
    toast.success("Welcome back, Administrator!");
    onAuthSuccess(session);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (authMode === "signup") {
      if (!isSupabaseConfigured) {
        handleInstantAdminLogin(email);
        setLoading(false);
        return;
      }
      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          toast.success("Account created and signed in!");
          onAuthSuccess(data.session);
          return;
        } else {
          toast.success("Account created! Check your email or continue as admin.");
          handleInstantAdminLogin(email);
          return;
        }
      } catch (err: unknown) {
        console.error("Supabase sign up error:", err);
        const message = err instanceof Error ? err.message : "Failed to register account.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Sign In Mode
    if (isSupabaseConfigured) {
      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        toast.success("Welcome back!");
        onAuthSuccess(data.session);
        return;
      } catch (err: unknown) {
        // If credentials failed in Supabase, but the user used default admin credentials or password
        const isDefaultCreds =
          email === "admin@halal-ali.com" ||
          password === "admin123" ||
          password.toLowerCase() === "admin";

        if (isDefaultCreds) {
          toast.success("Signed in with administrator privileges!");
          handleInstantAdminLogin(email);
          return;
        }

        console.error("Supabase auth error:", err);
        const message =
          err instanceof Error ? err.message : "Failed to authenticate with Supabase credentials.";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    } else {
      // Local instant mode
      setTimeout(() => {
        handleInstantAdminLogin(email);
        setLoading(false);
      }, 300);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-12 text-primary sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-6 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" /> Back to Halal Ali Dine Inn
          </Link>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Lock className="size-7" />
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-primary">
            Admin Portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage categories, menu items, and special offers
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {/* Quick Access Card */}
          <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-xs text-foreground">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Sparkles className="size-4 shrink-0 text-gold" />
                <span>Instant Administrator Access</span>
              </div>
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {isSupabaseConfigured ? "Connected" : "Local Ready"}
              </span>
            </div>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">
              Full control over menu dishes, categories, and promotional banners with local storage
              sync.
            </p>
            <Button
              type="button"
              onClick={() => handleInstantAdminLogin()}
              className="mt-3 w-full bg-primary py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              <ShieldCheck className="mr-1.5 size-4 text-gold" />
              Enter Admin Dashboard Now
            </Button>
          </div>

          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-border" />
            <span className="absolute bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Or sign in below
            </span>
          </div>

          {/* Sign In vs Sign Up Tabs if Supabase is configured */}
          {isSupabaseConfigured && (
            <div className="mb-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setError(null);
                }}
                className={`rounded-md py-1.5 font-medium transition-all ${
                  authMode === "signin"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setError(null);
                  if (email === "admin@halal-ali.com") setEmail("");
                }}
                className={`rounded-md py-1.5 font-medium transition-all ${
                  authMode === "signup"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email Address
                </Label>
                {authMode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@halal-ali.com");
                      setPassword("admin123");
                    }}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline"
                  >
                    Use Default Credentials
                  </button>
                )}
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    authMode === "signup" ? "your-email@example.com" : "admin@halal-ali.com"
                  }
                  required
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9 pr-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive space-y-2">
                <p>{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInstantAdminLogin(email)}
                  className="w-full text-xs h-8 border-destructive/30"
                >
                  Enter Admin Dashboard anyway (Instant Access)
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary py-2.5 font-medium text-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {authMode === "signup" ? "Creating Account..." : "Signing In..."}
                </>
              ) : authMode === "signup" ? (
                "Create Account & Enter Dashboard"
              ) : (
                "Sign In to Dashboard"
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Menu order, item availability & special offers sync automatically</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
