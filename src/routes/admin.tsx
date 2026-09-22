import { useEffect, useState } from "react";
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
          const { data } = await supabase.auth.getSession();
          if (mounted) {
            setSession(data.session);
            setLoading(false);
          }
        } catch (err) {
          console.error("Session check error:", err);
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) {
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
