import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, formatPrice } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  UtensilsCrossed,
  FolderTree,
  Sparkles,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Database,
  Tag,
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

// Database Entity Types
interface SupabaseMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  category_id: string | null;
  image_url: string | null;
  available?: boolean;
  sort_order?: number;
  created_at?: string;
  deleted_at?: string | null;
}

interface SupabaseCategory {
  id: string;
  name: string;
  slug: string;
  sort_order?: number;
  available?: boolean;
  created_at?: string;
  deleted_at?: string | null;
}

interface SupabaseOffer {
  id: string;
  badge?: string | null;
  title: string;
  description?: string | null;
  price?: number | string | null;
  original_price?: number | string | null;
  image_url?: string | null;
  available?: boolean;
  show_overlay?: boolean;
  autoplay?: boolean;
  slides?: Array<{
    id?: string;
    title?: string;
    badge?: string;
    price?: number;
    image_url?: string;
  }>;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

interface TrashedRecord {
  id: string;
  type: "item" | "category" | "offer";
  title: string;
  subtitle?: string;
  deleted_at?: string | null;
  raw: SupabaseMenuItem | SupabaseCategory | SupabaseOffer;
}

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

  // Database state fetched directly from Supabase
  const [items, setItems] = useState<SupabaseMenuItem[]>([]);
  const [categories, setCategories] = useState<SupabaseCategory[]>([]);
  const [offers, setOffers] = useState<SupabaseOffer[]>([]);
  const [trashList, setTrashList] = useState<TrashedRecord[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "item" | "category" | "offer" | "trash">(
    "all",
  );

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

  // Fetch all tables directly from Supabase
  const loadSupabaseData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setDbError("Supabase environment variables are not configured.");
      return;
    }

    setDbLoading(true);
    setDbError(null);

    try {
      // 1. Fetch Menu Items
      const { data: rawItems, error: itemsErr } = await supabase
        .from("menu_items")
        .select("*")
        .order("sort_order", { ascending: true });

      if (itemsErr) {
        console.warn("Supabase menu_items query error:", itemsErr);
      }

      // 2. Fetch Categories
      const { data: rawCategories, error: catErr } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (catErr) {
        console.warn("Supabase categories query error:", catErr);
      }

      // 3. Fetch Special Offers
      let rawOffers: SupabaseOffer[] = [];
      try {
        const { data: offerData, error: offerErr } = await supabase
          .from("special_offers")
          .select("*")
          .order("updated_at", { ascending: false });

        if (!offerErr && Array.isArray(offerData)) {
          rawOffers = offerData;
        } else {
          // Fallback to table named 'offers' if present
          const { data: altOffers } = await supabase.from("offers").select("*");
          if (Array.isArray(altOffers)) {
            rawOffers = altOffers;
          }
        }
      } catch (e) {
        console.warn("Could not fetch special_offers table:", e);
      }

      const allItems: SupabaseMenuItem[] = rawItems || [];
      const allCategories: SupabaseCategory[] = rawCategories || [];
      const allOffers: SupabaseOffer[] = rawOffers || [];

      // Separate Active vs Trashed records
      const activeItems = allItems.filter((i) => !i.deleted_at);
      const activeCats = allCategories.filter((c) => !c.deleted_at);
      const activeOffs = allOffers.filter((o) => !o.deleted_at);

      // Build Trash list from all soft-deleted records across tables
      const trashed: TrashedRecord[] = [];

      allItems
        .filter((i) => Boolean(i.deleted_at))
        .forEach((i) => {
          trashed.push({
            id: `item-${i.id}`,
            type: "item",
            title: i.name,
            subtitle: formatPrice(i.price),
            deleted_at: i.deleted_at,
            raw: i,
          });
        });

      allCategories
        .filter((c) => Boolean(c.deleted_at))
        .forEach((c) => {
          trashed.push({
            id: `cat-${c.id}`,
            type: "category",
            title: c.name,
            subtitle: `Slug: ${c.slug}`,
            deleted_at: c.deleted_at,
            raw: c,
          });
        });

      allOffers
        .filter((o) => Boolean(o.deleted_at))
        .forEach((o) => {
          trashed.push({
            id: `offer-${o.id}`,
            type: "offer",
            title: o.title,
            subtitle: o.badge || "Special Offer",
            deleted_at: o.deleted_at,
            raw: o,
          });
        });

      // Sort trash by deleted timestamp (newest deleted first)
      trashed.sort((a, b) => {
        const timeA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
        const timeB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
        return timeB - timeA;
      });

      setItems(activeItems);
      setCategories(activeCats);
      setOffers(activeOffs);
      setTrashList(trashed);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      console.error("Database fetch exception:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to load database records from Supabase";
      setDbError(msg);
    } finally {
      setDbLoading(false);
    }
  }, []);

  // Fetch Supabase data once authenticated
  useEffect(() => {
    if (session && user) {
      loadSupabaseData();
    }
  }, [session, user, loadSupabaseData]);

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
      setItems([]);
      setCategories([]);
      setOffers([]);
      setTrashList([]);
      setErrorMessage(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Category Map for fast lookup in item cards
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => {
      map.set(c.id, c.name);
      if (c.slug) map.set(c.slug, c.name);
    });
    return map;
  }, [categories]);

  // Filtered lists based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.category_id && categoryMap.get(i.category_id)?.toLowerCase().includes(q)),
    );
  }, [items, searchQuery, categoryMap]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [categories, searchQuery]);

  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) return offers;
    const q = searchQuery.toLowerCase().trim();
    return offers.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        (o.badge && o.badge.toLowerCase().includes(q)) ||
        (o.description && o.description.toLowerCase().includes(q)),
    );
  }, [offers, searchQuery]);

  const filteredTrash = useMemo(() => {
    if (!searchQuery.trim()) return trashList;
    const q = searchQuery.toLowerCase().trim();
    return trashList.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.subtitle && t.subtitle.toLowerCase().includes(q)) ||
        t.type.toLowerCase().includes(q),
    );
  }, [trashList, searchQuery]);

  // 1. Loading screen while verifying initial session
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Screen: Login Only (No Signup)
  if (!session || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-lg sm:p-9">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="size-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Portal</h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Sign in with your email and password to access the database management panel
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

  // 3. Authenticated Screen: 4 Columns (Item, Category, Offer, Trash)
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-card/90 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground">
                Admin Panel
              </h1>
              <Badge
                variant="outline"
                className="hidden border-primary/20 bg-primary/5 text-[11px] font-medium text-primary sm:inline-flex"
              >
                <Database className="mr-1 size-3" />
                Supabase Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Halal Ali Dine Inn • Database Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSupabaseData}
            disabled={dbLoading}
            className="h-8 gap-1.5 border-border/60 text-xs shadow-xs"
            title="Refresh database records"
          >
            <RefreshCw className={`size-3.5 ${dbLoading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-8 text-xs text-muted-foreground sm:inline-flex"
          >
            <Link to="/">
              <ExternalLink className="mr-1.5 size-3.5" />
              Public Site
            </Link>
          </Button>

          <div className="h-4 w-px bg-border/60" />

          <span className="hidden text-xs text-muted-foreground md:inline-block max-w-[140px] truncate">
            {user.email}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="h-8 gap-1.5 border-border/60 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main 4-Column Layout */}
      <main className="flex flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {/* Controls Bar: Search & Column Visibility Filter */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search box */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items, categories, offers, or trash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Column Toggle / Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Columns (4)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("item")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === "item"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UtensilsCrossed className="size-3" />
              Item ({filteredItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("category")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === "category"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderTree className="size-3" />
              Category ({filteredCategories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("offer")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === "offer"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3" />
              Offer ({filteredOffers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("trash")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === "trash"
                  ? "bg-background text-destructive shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trash2 className="size-3" />
              Trash ({filteredTrash.length})
            </button>
          </div>
        </div>

        {/* Database Error Banner if any */}
        {dbError && (
          <Alert variant="destructive" className="mb-6 text-xs">
            <AlertDescription className="flex items-center justify-between">
              <span>{dbError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSupabaseData}
                className="h-7 text-[11px]"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 4-Column Grid View */}
        <div className="grid flex-1 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* =========================================
              COLUMN 1: ITEM
             ========================================= */}
          {(activeTab === "all" || activeTab === "item") && (
            <div className="flex flex-col rounded-xl border border-border/70 bg-card shadow-xs">
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <UtensilsCrossed className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Item</h2>
                    <p className="text-[10px] text-muted-foreground">Active Menu Items</p>
                  </div>
                </div>
                <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
                  {filteredItems.length}
                </Badge>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[calc(100vh-250px)] min-h-[260px]">
                {dbLoading && items.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="text-xs">Loading items from Supabase...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  /* Blank state if Supabase doesn't contain items */
                  <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-6 text-center">
                    <UtensilsCrossed className="mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-xs font-medium text-muted-foreground">
                      {searchQuery ? "No matching items found" : "No items in database"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      Supabase table is currently empty
                    </p>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const catName = item.category_id ? categoryMap.get(item.category_id) : null;
                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-lg border border-border/50 bg-background/80 p-3 transition-all hover:border-primary/40 hover:shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                {item.description}
                              </p>
                            )}
                          </div>

                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="size-11 shrink-0 rounded-md object-cover border border-border/40"
                              loading="lazy"
                            />
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                          <span className="font-semibold text-primary font-mono">
                            {formatPrice(item.price)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {catName && (
                              <Badge
                                variant="outline"
                                className="border-border/60 text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                              >
                                {catName}
                              </Badge>
                            )}

                            {item.available !== false ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                                title="Available"
                              >
                                <CheckCircle2 className="size-3" />
                                Active
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground"
                                title="Unavailable"
                              >
                                <XCircle className="size-3" />
                                Hidden
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =========================================
              COLUMN 2: CATEGORY
             ========================================= */}
          {(activeTab === "all" || activeTab === "category") && (
            <div className="flex flex-col rounded-xl border border-border/70 bg-card shadow-xs">
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <FolderTree className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Category</h2>
                    <p className="text-[10px] text-muted-foreground">Menu Categories</p>
                  </div>
                </div>
                <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
                  {filteredCategories.length}
                </Badge>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[calc(100vh-250px)] min-h-[260px]">
                {dbLoading && categories.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="text-xs">Loading categories from Supabase...</span>
                  </div>
                ) : filteredCategories.length === 0 ? (
                  /* Blank state if Supabase doesn't contain categories */
                  <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-6 text-center">
                    <FolderTree className="mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-xs font-medium text-muted-foreground">
                      {searchQuery ? "No matching categories found" : "No categories in database"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      Supabase table is currently empty
                    </p>
                  </div>
                ) : (
                  filteredCategories.map((cat) => {
                    const itemCount = items.filter((i) => i.category_id === cat.id).length;
                    return (
                      <div
                        key={cat.id}
                        className="group relative rounded-lg border border-border/50 bg-background/80 p-3 transition-all hover:border-blue-500/40 hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {cat.name}
                          </h3>
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                            #{cat.sort_order ?? 0}
                          </Badge>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono text-[10px]">slug: {cat.slug}</span>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                          <span className="text-muted-foreground text-[10px]">
                            {itemCount} {itemCount === 1 ? "item" : "items"} linked
                          </span>

                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            {cat.available !== false ? "Visible" : "Hidden"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =========================================
              COLUMN 3: OFFER
             ========================================= */}
          {(activeTab === "all" || activeTab === "offer") && (
            <div className="flex flex-col rounded-xl border border-border/70 bg-card shadow-xs">
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Offer</h2>
                    <p className="text-[10px] text-muted-foreground">Special Deals & Combos</p>
                  </div>
                </div>
                <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
                  {filteredOffers.length}
                </Badge>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[calc(100vh-250px)] min-h-[260px]">
                {dbLoading && offers.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="text-xs">Loading offers from Supabase...</span>
                  </div>
                ) : filteredOffers.length === 0 ? (
                  /* Blank state if Supabase doesn't contain offers */
                  <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-6 text-center">
                    <Sparkles className="mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-xs font-medium text-muted-foreground">
                      {searchQuery ? "No matching offers found" : "No offers in database"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      Supabase table is currently empty
                    </p>
                  </div>
                ) : (
                  filteredOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="group relative rounded-lg border border-border/50 bg-background/80 p-3 transition-all hover:border-purple-500/40 hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {offer.badge && (
                            <Badge
                              variant="secondary"
                              className="mb-1 bg-purple-500/10 text-[10px] font-semibold text-purple-600 dark:text-purple-400 px-1.5 py-0"
                            >
                              <Tag className="mr-1 size-2.5" />
                              {offer.badge}
                            </Badge>
                          )}
                          <h3 className="text-xs font-semibold text-foreground truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {offer.title}
                          </h3>
                          {offer.description && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                              {offer.description}
                            </p>
                          )}
                        </div>

                        {offer.image_url && (
                          <img
                            src={offer.image_url}
                            alt={offer.title}
                            className="size-11 shrink-0 rounded-md object-cover border border-border/40"
                            loading="lazy"
                          />
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                        <div className="flex items-baseline gap-1.5">
                          {offer.price !== undefined && offer.price !== null && (
                            <span className="font-semibold text-primary font-mono">
                              {formatPrice(offer.price)}
                            </span>
                          )}
                          {offer.original_price && (
                            <span className="text-[10px] text-muted-foreground line-through font-mono">
                              {formatPrice(offer.original_price)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {offer.slides && offer.slides.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {offer.slides.length} {offer.slides.length === 1 ? "slide" : "slides"}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            {offer.available !== false ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =========================================
              COLUMN 4: TRASH
             ========================================= */}
          {(activeTab === "all" || activeTab === "trash") && (
            <div className="flex flex-col rounded-xl border border-destructive/30 bg-card shadow-xs">
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border/60 bg-destructive/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <Trash2 className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Trash</h2>
                    <p className="text-[10px] text-muted-foreground">Deleted Records</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-destructive/30 bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-semibold"
                >
                  {filteredTrash.length}
                </Badge>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[calc(100vh-250px)] min-h-[260px]">
                {dbLoading && trashList.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin text-destructive" />
                    <span className="text-xs">Checking trash records...</span>
                  </div>
                ) : filteredTrash.length === 0 ? (
                  /* Blank state if Supabase doesn't contain trash records */
                  <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-6 text-center">
                    <Trash2 className="mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-xs font-medium text-muted-foreground">
                      {searchQuery ? "No matching trashed records" : "Trash is empty"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      No deleted records in database
                    </p>
                  </div>
                ) : (
                  filteredTrash.map((trash) => (
                    <div
                      key={trash.id}
                      className="group relative rounded-lg border border-destructive/20 bg-background/80 p-3 transition-all hover:border-destructive/40 hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0 ${
                                trash.type === "item"
                                  ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                                  : trash.type === "category"
                                    ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
                                    : "border-purple-500/30 text-purple-600 dark:text-purple-400"
                              }`}
                            >
                              {trash.type}
                            </Badge>
                          </div>

                          <h3 className="mt-1 text-xs font-semibold text-foreground line-through opacity-80 truncate">
                            {trash.title}
                          </h3>

                          {trash.subtitle && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                              {trash.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="size-2.5" />
                          {trash.deleted_at
                            ? new Date(trash.deleted_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Deleted"}
                        </span>
                        <span className="text-destructive font-medium text-[10px]">Trashed</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info stats */}
        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>
              Total Records: {items.length + categories.length + offers.length + trashList.length}
            </span>
            <span>•</span>
            <span>{items.length} Items</span>
            <span>•</span>
            <span>{categories.length} Categories</span>
            <span>•</span>
            <span>{offers.length} Offers</span>
            <span>•</span>
            <span>{trashList.length} Trashed</span>
          </div>

          {lastRefreshed && (
            <div className="text-[11px]">
              Last synced with Supabase: {lastRefreshed.toLocaleTimeString()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
