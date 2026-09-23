import React, { useEffect, useState, Component, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  isSupabaseConfigured,
  getLocalAdminSession,
  clearLocalAdminSession,
  type AdminUserSession,
} from "@/lib/supabase";
import { AdminAuth } from "@/components/admin/admin-auth";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
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
    console.error("AdminPanel error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 max-w-md">
            <h2 className="text-lg font-bold text-foreground mb-2">Admin Portal Error</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {this.state.error?.message ||
                "An unexpected error occurred while loading the Admin Panel."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Portal — Halal Ali Dine Inn & Take Away" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [session, setSession] = useState<Session | AdminUserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      // 1. Check local admin session first
      const localSession = getLocalAdminSession();
      if (localSession) {
        if (mounted) {
          setSession(localSession);
          setLoading(false);
        }
        return;
      }

      // 2. If Supabase is configured with real credentials, check Supabase session
      if (isSupabaseConfigured) {
        try {
          const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 2500),
          );
          const res = await Promise.race([supabase.auth.getSession(), timeoutPromise]);
          if (mounted) {
            if (res.data.session) {
              setSession(res.data.session);
            } else {
              const currentLocal = getLocalAdminSession();
              if (currentLocal) {
                setSession(currentLocal);
              } else {
                setSession(null);
              }
            }
            setLoading(false);
          }
        } catch (err) {
          console.error("Session check error:", err);
          if (mounted) {
            const currentLocal = getLocalAdminSession();
            setSession(currentLocal);
            setLoading(false);
          }
        }
      } else {
        if (mounted) {
          const currentLocal = getLocalAdminSession();
          setSession(currentLocal);
          setLoading(false);
        }
      }
    }

    checkAuth();

    let authUnsubscribe = () => {};
    if (isSupabaseConfigured) {
      try {
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (mounted) {
            if (newSession) {
              setSession(newSession);
            } else {
              const currentLocal = getLocalAdminSession();
              if (currentLocal) {
                setSession(currentLocal);
              }
            }
            setLoading(false);
          }
        });
        authUnsubscribe = () => authListener.subscription.unsubscribe();
      } catch (e) {
        console.warn("Failed to attach Supabase auth state change listener:", e);
      }
    }

    return () => {
      mounted = false;
      authUnsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-gold" />
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Connecting to Halal Ali Dine Inn Admin...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <Toaster richColors position="top-right" />
      {session ? (
        <AdminErrorBoundary onReset={() => window.location.reload()}>
          <AdminPanel
            session={session}
            onSignOut={async () => {
              clearLocalAdminSession();
              if (isSupabaseConfigured) {
                try {
                  await supabase.auth.signOut();
                } catch (e) {
                  console.warn("Error signing out from Supabase:", e);
                }
              }
              setSession(null);
            }}
          />
        </AdminErrorBoundary>
      ) : (
        <AdminAuth
          onAuthSuccess={(newSession) => {
            if (newSession) {
              setSession(newSession);
            } else {
              const local = getLocalAdminSession();
              setSession(local);
            }
          }}
        />
      )}
    </div>
  );
}
