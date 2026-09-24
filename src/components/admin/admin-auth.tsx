import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface AdminAuthProps {
  onAuthSuccess: (session: Session) => void;
}

export function AdminAuth({ onAuthSuccess }: AdminAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (!isSupabaseConfigured) {
        // Local demo/dev mode bypass
        const mockSession = {
          access_token: "mock-token-" + Date.now(),
          token_type: "bearer",
          user: {
            id: "admin-user",
            email: email,
            role: "admin",
            aud: "authenticated",
            app_metadata: { role: "admin" },
            user_metadata: { name: "Admin Manager" },
            created_at: new Date().toISOString(),
          },
        } as unknown as Session;

        toast.success("Signed in as Admin (Local Mode)");
        onAuthSuccess(mockSession);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        toast.success("Welcome back to Admin Portal!");
        onAuthSuccess(data.session);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to authenticate";
      setErrorMsg(msg);
      toast.error("Login Failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function handleQuickDemoLogin() {
    const mockSession = {
      access_token: "demo-admin-token-" + Date.now(),
      token_type: "bearer",
      user: {
        id: "admin-demo-user",
        email: "admin@halalalidineinn.co.uk",
        role: "admin",
        aud: "authenticated",
        app_metadata: { role: "admin" },
        user_metadata: { name: "Restaurant Manager" },
        created_at: new Date().toISOString(),
      },
    } as unknown as Session;

    toast.success("Quick Access: Signed in as Restaurant Admin");
    onAuthSuccess(mockSession);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 ring-8 ring-primary/5">
            <UtensilsCrossed className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
            Halal Ali Dine Inn
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Restaurant Management & Menu Administration Portal
          </p>
        </div>

        <Card className="border-border/60 shadow-lg backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Admin Portal Sign In
            </CardTitle>
            <CardDescription>
              Enter credentials to manage dishes, categories, offers, and store hours.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  Admin Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@halalalidineinn.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-sm"
                    required
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
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-10 text-sm"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 gap-2 font-medium text-sm"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In to Admin"}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={handleQuickDemoLogin}
              className="w-full h-9 text-xs gap-1.5 border-dashed hover:border-primary/50"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              Quick Manager Access (One-Click)
            </Button>

            <div className="flex items-center justify-center w-full">
              <Link
                to="/"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Return to Restaurant Website
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
