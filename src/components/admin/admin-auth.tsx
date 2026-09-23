import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";
import { Lock, Mail, Loader2, ArrowLeft, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface AdminAuthProps {
  onAuthSuccess: (session: Session) => void;
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

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      const errMsg = "Please enter both email and password.";
      setError(errMsg);
      toast.error(errMsg);
      setLoading(false);
      return;
    }

    try {
      // 1. Supabase Authentication email/password login
      const { data: authData, error: sbErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (sbErr || !authData?.user || !authData?.session) {
        const errMsg =
          sbErr?.message || "Invalid email or password. Please check your credentials.";
        setError(errMsg);
        toast.error(errMsg);
        setLoading(false);
        return;
      }

      // 2. Verify that authenticated user's UUID exists in public.admin_users
      const { data: adminRecord, error: adminErr } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (adminErr || !adminRecord) {
        await supabase.auth.signOut();
        const errMsg = "Unauthorized admin account";
        setError(errMsg);
        toast.error(errMsg);
        setLoading(false);
        return;
      }

      // 3. Only then allow access to the admin panel
      toast.success("Welcome back!");
      onAuthSuccess(authData.session);
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred while signing in. Please try again.";
      setError(message);
      toast.error(message);
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
            Sign in securely to manage restaurant categories, menu items, and special offers
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email Address
                </Label>
              </div>
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
                  autoComplete="current-password"
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
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <p>{error}</p>
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
                  Signing In...
                </>
              ) : (
                "Sign In to Dashboard"
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Secure Authentication & Live Database Sync</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
