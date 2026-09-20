import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Halal Ali Dine Inn" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading, session } = useAdminAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <AdminLogin onSuccess={() => router.invalidate()} />;
  }

  return (
    <AdminDashboard
      onLogout={async () => {
        await supabase.auth.signOut();
        router.invalidate();
      }}
    />
  );
}
