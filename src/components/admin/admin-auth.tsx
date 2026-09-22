import { useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";
import { Lock, Mail, Loader2, ArrowLeft, ShieldAlert, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface AdminAuthProps {
  onAuthSuccess: () => void;
}

export function AdminAuth({ onAuthSuccess }: AdminAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      toast.success("Welcome back!");
      onAuthSuccess();
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to authenticate. Please check your credentials.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
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
            Sign in with your administrator credentials to access the dashboard
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xs">
          {!isSupabaseConfigured && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Supabase Configuration Notice</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-amber-800/90 dark:text-amber-200/90">
                Please ensure <code className="font-mono font-semibold">VITE_SUPABASE_URL</code> and{" "}
                <code className="font-mono font-semibold">VITE_SUPABASE_ANON_KEY</code> are set in
                your environment variables to authenticate with your live Supabase project.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@halal-ali.com"
                  required
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9 pr-9"
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
              <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary py-2.5 font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In to Dashboard"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
