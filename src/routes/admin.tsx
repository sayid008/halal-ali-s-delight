import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
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
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-gold" />
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Connecting to Halal Ali's Admin...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      {session ? (
        <AdminPanel
          session={session}
          onSignOut={async () => {
            await supabase.auth.signOut();
            setSession(null);
          }}
        />
      ) : (
        <AdminAuth
          onAuthSuccess={async () => {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
          }}
        />
      )}
    </>
  );
}
