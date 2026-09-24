import { useEffect, useState, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  formatPrice,
  isSupabaseConfigured,
  isShopCategory,
  type DatabaseMenuItem,
  type DatabaseCategory,
  type AdminUserSession,
} from "@/lib/supabase";
import {
  persistCategoryOrder,
  persistItemOrder,
  saveLocalMenuSnapshot,
  getLocalMenuSnapshot,
  MENU_ORDER_EVENT,
} from "@/lib/menu-order";
import { MenuItemDialog } from "./menu-item-dialog";
import { CategoryDialog } from "./category-dialog";
import { SpecialOfferManager } from "./special-offer-manager";
import { TrashManager } from "./trash-manager";
import { getDaysRemaining, SUPABASE_TRASH_SQL } from "@/lib/trash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  LogOut,
  ExternalLink,
  Edit2,
  Trash2,
  UtensilsCrossed,
  Layers,
  ImageIcon,
  Tag,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Database,
  Save,
  Download,
  HardDrive,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { menuSections as homeSections } from "@/data/menu";
import {
  storeAllMenuDetailsToDatabase,
  resetDatabaseToDefaults,
  exportDatabaseBackup,
  fetchDatabaseStats,
  type DatabaseStats,
} from "@/lib/database-menu";

interface AdminPanelProps {
  session: Session | AdminUserSession | { user: { email?: string } };
  onSignOut: () => void;
}

function isUUIDFormat(str?: string | null): boolean {
  return Boolean(
    str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
  );
}

// Convert home page static menu items into structured defaults
const defaultCategories: DatabaseCategory[] = homeSections.map((sec, idx) => ({
  id: `cat-${sec.id}`,
  name: sec.title,
  slug: sec.id,
  sort_order: idx + 1,
  created_at: new Date().toISOString(),
}));

const defaultItems: DatabaseMenuItem[] = homeSections.flatMap((sec, sIdx) => {
  const catId = `cat-${sec.id}`;
  return sec.items.map((dish, dIdx) => {
    let priceNum = 250;
    if (typeof dish.price === "number") {
      priceNum = dish.price < 50 ? Math.round(dish.price * 50) : dish.price;
    } else if (typeof dish.price === "string") {
      const parsed = parseFloat(dish.price.replace(/[^\d.]/g, ""));
      if (!isNaN(parsed)) {
        priceNum = parsed < 50 ? Math.round(parsed * 50) : Math.round(parsed);
      }
    }

    return {
      id: `dish-${sec.id}-${dIdx + 1}`,
      name: dish.name,
      description: dish.description,
      price: priceNum,
      category_id: catId,
      image_url: dish.image || null,
      available: true,
      sort_order: (sIdx + 1) * 10 + (dIdx + 1),
      created_at: new Date().toISOString(),
    };
  });
});

export function AdminPanel({ session, onSignOut }: AdminPanelProps) {
  const [items, setItems] = useState<DatabaseMenuItem[]>(() => {
    const cached = getLocalMenuSnapshot();
    if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
      return cached.items;
    }
    return defaultItems;
  });
  const [categories, setCategories] = useState<DatabaseCategory[]>(() => {
    const cached = getLocalMenuSnapshot();
    if (cached && Array.isArray(cached.categories) && cached.categories.length > 0) {
      return cached.categories;
    }
    return defaultCategories;
  });
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);

  // Active Tab with URL synchronization
  const [activeTab, setActiveTab] = useState<"items" | "categories" | "special_offer" | "trash">(
    () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (
          tabParam === "special_offer" ||
          tabParam === "special-offer" ||
          tabParam === "offers" ||
          tabParam === "offer" ||
          window.location.hash === "#special_offer" ||
          window.location.hash === "#special-offer"
        ) {
          return "special_offer";
        }
        if (tabParam === "categories") {
          return "categories";
        }
        if (tabParam === "trash" || tabParam === "recycle-bin") {
          return "trash";
        }
      }
      return "items";
    },
  );

  function handleSelectTab(tab: "items" | "categories" | "special_offer" | "trash") {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  }

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatabaseMenuItem | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DatabaseCategory | null>(null);

  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
  const [dbTableError, setDbTableError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Database Storage States
  const [savingToDb, setSavingToDb] = useState(false);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [showDbModal, setShowDbModal] = useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);

  async function handleStoreAllToDatabase() {
    setSavingToDb(true);
    try {
      const res = await storeAllMenuDetailsToDatabase(categories, items);
      if (res.success) {
        setLastSavedTimestamp(new Date().toLocaleTimeString());
        toast.success(res.message, {
          description: `All ${items.length} items across ${categories.length} categories are permanently stored in the server database (data/menu-db.json)${isSupabaseConfigured ? " and Supabase" : ""}.`,
          duration: 4000,
        });
        const stats = await fetchDatabaseStats();
        if (stats) setDbStats(stats);
      } else {
        toast.error("Failed to store all menu details to database");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to store to database";
      toast.error(msg);
    } finally {
      setSavingToDb(false);
    }
  }

  async function handleResetToDefaults() {
    if (
      !window.confirm(
        "Re-seed database with default full menu? This will restore all 20 authentic dishes and 6 categories to the database (data/menu-db.json).",
      )
    ) {
      return;
    }
    setSavingToDb(true);
    try {
      const res = await resetDatabaseToDefaults();
      if (res && res.categories && res.items) {
        setCategories(res.categories);
        setItems(res.items);
        setLastSavedTimestamp(new Date().toLocaleTimeString());
        toast.success("Database reset and stored with full default menu!", {
          description: `Restored ${res.items.length} dishes in ${res.categories.length} categories.`,
        });
        const stats = await fetchDatabaseStats();
        if (stats) setDbStats(stats);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset database";
      toast.error(msg);
    } finally {
      setSavingToDb(false);
    }
  }

  async function loadData() {
    if (items.length === 0 || categories.length === 0) {
      setLoading(true);
    }
    setDbTableError(null);

    // 1. Primary source: Load from server API database (/data/menu-db.json)
    try {
      const res = await fetch("/api/menu", {
        headers: { "cache-control": "no-cache" },
      });
      if (res.ok) {
        const apiData = (await res.json()) as {
          categories?: DatabaseCategory[];
          items?: DatabaseMenuItem[];
        };
        if (
          apiData.categories &&
          Array.isArray(apiData.categories) &&
          apiData.categories.length > 0
        ) {
          setCategories(apiData.categories);
          setItems(apiData.items || []);
          cacheLocalMenu(apiData.categories, apiData.items || []);
          setHasInitialLoaded(true);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore fetch error, proceed to alternatives
    }

    // 2. Secondary source: If Supabase is configured and server API had no data
    if (isSupabaseConfigured) {
      try {
        const timeoutPromise = new Promise<{
          data: null;
          error: { message: string; code: string };
        }>((resolve) =>
          setTimeout(
            () => resolve({ data: null, error: { message: "Request timeout", code: "TIMEOUT" } }),
            2500,
          ),
        );

        const [catRes, itemRes] = await Promise.all([
          Promise.race([
            supabase.from("categories").select("*").order("sort_order", { ascending: true }),
            timeoutPromise,
          ]),
          Promise.race([
            supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
            timeoutPromise,
          ]),
        ]);

        const loadedCategories = (catRes.data as DatabaseCategory[]) || [];
        const loadedItems = (itemRes.data as DatabaseMenuItem[]) || [];

        if (loadedCategories.length > 0) {
          setCategories(loadedCategories);
          setItems(loadedItems);
          saveLocalMenuSnapshot(loadedCategories, loadedItems);
          setHasInitialLoaded(true);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Could not load from Supabase:", err);
      }
    }

    // 3. Fallback: local snapshot cache or defaults
    const cached = getLocalMenuSnapshot();
    if (cached && Array.isArray(cached.categories) && cached.categories.length > 0) {
      setCategories(cached.categories);
      setItems(cached.items || []);
      saveLocalMenuSnapshot(cached.categories, cached.items || []);
    } else {
      setCategories(defaultCategories);
      setItems(defaultItems);
      saveLocalMenuSnapshot(defaultCategories, defaultItems);
    }
    setHasInitialLoaded(true);
    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const handleLocalUpdate = (e?: Event) => {
      if (e && "detail" in e && e.detail) {
        const detail = (e as CustomEvent).detail as {
          source?: string;
          categories?: DatabaseCategory[];
          items?: DatabaseMenuItem[];
        };
        // If event came from current admin panel, ignore to avoid overwriting active state
        if (detail.source === "admin-panel") {
          return;
        }
        if (detail.categories && Array.isArray(detail.categories)) {
          setCategories(detail.categories);
        }
        if (detail.items && Array.isArray(detail.items)) {
          setItems(detail.items);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadData();
      }
    };

    window.addEventListener(MENU_ORDER_EVENT, handleLocalUpdate as EventListener);
    window.addEventListener("storage", handleLocalUpdate as EventListener);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("halal_ali_menu_channel");
        bc.onmessage = (msgEvent) => {
          if (msgEvent.data && typeof msgEvent.data === "object") {
            if (msgEvent.data.source === "admin-panel") return;
            if (msgEvent.data.categories && Array.isArray(msgEvent.data.categories)) {
              setCategories(msgEvent.data.categories);
            }
            if (msgEvent.data.items && Array.isArray(msgEvent.data.items)) {
              setItems(msgEvent.data.items);
            }
          }
        };
      } catch {
        // ignore channel errors
      }
    }

    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    if (isSupabaseConfigured) {
      try {
        realtimeChannel = supabase
          .channel("admin-menu-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () =>
            loadData(),
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () =>
            loadData(),
          )
          .subscribe();
      } catch (err) {
        console.warn("Could not subscribe AdminPanel to Supabase Realtime:", err);
      }
    }

    return () => {
      window.removeEventListener(MENU_ORDER_EVENT, handleLocalUpdate as EventListener);
      window.removeEventListener("storage", handleLocalUpdate as EventListener);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (bc) {
        bc.close();
      }
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  // Separate Active vs Trashed items
  const activeItems = useMemo(() => items.filter((i) => !i.deleted_at), [items]);
  const activeCategories = useMemo(() => categories.filter((c) => !c.deleted_at), [categories]);
  const trashedItems = useMemo(() => items.filter((i) => !!i.deleted_at), [items]);
  const trashedCategories = useMemo(() => categories.filter((c) => !!c.deleted_at), [categories]);

  // Toggle Dish Visibility (Active vs Inactive)
  async function handleToggleItemVisibility(item: DatabaseMenuItem) {
    const nextVal = item.available === false ? true : false;
    const updatedItems = items.map((i) => (i.id === item.id ? { ...i, available: nextVal } : i));
    setItems(updatedItems);
    saveLocalMenuSnapshot(categories, updatedItems);

    toast.success(
      nextVal
        ? `"${item.name}" is now Active (Visible on customer menu)`
        : `"${item.name}" is now Inactive (Hidden from customer menu)`,
    );

    if (isSupabaseConfigured) {
      try {
        let { error } = await supabase
          .from("menu_items")
          .update({ available: nextVal })
          .eq("id", item.id);
        if (error || item.id.startsWith("dish-")) {
          const nameRes = await supabase
            .from("menu_items")
            .update({ available: nextVal })
            .eq("name", item.name);
          if (!nameRes.error) error = null;
        }
      } catch (err: unknown) {
        console.warn("Could not sync item visibility to Supabase:", err);
      }
    }
  }

  // Toggle Category Visibility (Active vs Inactive)
  async function handleToggleCategoryVisibility(cat: DatabaseCategory) {
    const nextVal = cat.available === false ? true : false;
    const updatedCats = categories.map((c) => (c.id === cat.id ? { ...c, available: nextVal } : c));
    setCategories(updatedCats);
    saveLocalMenuSnapshot(updatedCats, items);

    toast.success(
      nextVal
        ? `Category "${cat.name}" is now Active (Visible on customer menu)`
        : `Category "${cat.name}" is now Inactive (Hidden from customer menu)`,
    );

    if (isSupabaseConfigured) {
      try {
        let { error } = await supabase
          .from("categories")
          .update({ available: nextVal })
          .eq("id", cat.id);
        if (error || cat.id.startsWith("cat-")) {
          const slugRes = await supabase
            .from("categories")
            .update({ available: nextVal })
            .eq("slug", cat.slug);
          if (!slugRes.error) error = null;
        }
      } catch (err: unknown) {
        console.warn("Could not sync category visibility to Supabase:", err);
      }
    }
  }

  // Move Item to Trash (Soft Delete for 30 days)
  async function handleTrashItem(item: DatabaseMenuItem) {
    if (
      !window.confirm(
        `Move "${item.name}" to Trash? It will be hidden from website visitors and kept in Trash for 30 days.`,
      )
    ) {
      return;
    }

    const now = new Date().toISOString();
    const updatedItems = items.map((i) =>
      i.id === item.id ? { ...i, deleted_at: now, available: false } : i,
    );
    setItems(updatedItems);
    saveLocalMenuSnapshot(categories, updatedItems);
    toast.success(`"${item.name}" moved to Trash (auto-purges in 30 days)`);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("menu_items")
          .update({ deleted_at: now, available: false })
          .eq("id", item.id);
        if (error || item.id.startsWith("dish-")) {
          await supabase
            .from("menu_items")
            .update({ deleted_at: now, available: false })
            .eq("name", item.name);
        }
      } catch (err: unknown) {
        console.warn("Could not sync trashed item to Supabase:", err);
      }
    }
  }

  // Move Category to Trash (Soft Delete category and attached dishes)
  async function handleTrashCategory(cat: DatabaseCategory) {
    const isMatchingItem = (i: DatabaseMenuItem) =>
      i.category_id === cat.id ||
      i.category_id === cat.slug ||
      i.category_id === `cat-${cat.slug}` ||
      Boolean(cat.slug && i.category_id?.includes(cat.slug)) ||
      Boolean(cat.name && i.category_id?.toLowerCase() === cat.name.toLowerCase());

    const associatedItems = activeItems.filter(isMatchingItem);
    const confirmMessage =
      associatedItems.length > 0
        ? `Move category "${cat.name}" and its ${associatedItems.length} dishes to Trash? They will be hidden from visitors and kept in Trash for 30 days.`
        : `Move category "${cat.name}" to Trash? It will be hidden from visitors and kept in Trash for 30 days.`;

    if (!window.confirm(confirmMessage)) return;

    const now = new Date().toISOString();
    const updatedCats = categories.map((c) => (c.id === cat.id ? { ...c, deleted_at: now } : c));
    const updatedItems = items.map((i) =>
      isMatchingItem(i) ? { ...i, deleted_at: now, available: false } : i,
    );
    setCategories(updatedCats);
    setItems(updatedItems);
    saveLocalMenuSnapshot(updatedCats, updatedItems);
    toast.success(`Category "${cat.name}" moved to Trash`);

    if (isSupabaseConfigured) {
      try {
        const { error: catErr } = await supabase
          .from("categories")
          .update({ deleted_at: now })
          .eq("id", cat.id);
        if (catErr || cat.id.startsWith("cat-")) {
          await supabase.from("categories").update({ deleted_at: now }).eq("slug", cat.slug);
        }

        if (associatedItems.length > 0) {
          await supabase
            .from("menu_items")
            .update({ deleted_at: now, available: false })
            .eq("category_id", cat.id);
        }
      } catch (err: unknown) {
        console.warn("Could not sync trashed category to Supabase:", err);
      }
    }
  }

  // Restore Item from Trash
  async function handleRestoreItem(item: DatabaseMenuItem) {
    const updatedItems = items.map((i) =>
      i.id === item.id ? { ...i, deleted_at: null, available: true } : i,
    );
    setItems(updatedItems);
    saveLocalMenuSnapshot(categories, updatedItems);
    toast.success(`"${item.name}" restored to menu!`);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("menu_items")
          .update({ deleted_at: null, available: true })
          .eq("id", item.id);
        if (error || item.id.startsWith("dish-")) {
          await supabase
            .from("menu_items")
            .update({ deleted_at: null, available: true })
            .eq("name", item.name);
        }
      } catch (err: unknown) {
        console.warn("Could not sync restore item to Supabase:", err);
      }
    }
  }

  // Restore Category from Trash
  async function handleRestoreCategory(cat: DatabaseCategory) {
    const isMatchingItem = (i: DatabaseMenuItem) =>
      i.category_id === cat.id ||
      i.category_id === cat.slug ||
      i.category_id === `cat-${cat.slug}` ||
      Boolean(cat.slug && i.category_id?.includes(cat.slug)) ||
      Boolean(cat.name && i.category_id?.toLowerCase() === cat.name.toLowerCase());

    const updatedCats = categories.map((c) => (c.id === cat.id ? { ...c, deleted_at: null } : c));
    const updatedItems = items.map((i) =>
      isMatchingItem(i) ? { ...i, deleted_at: null, available: true } : i,
    );
    setCategories(updatedCats);
    setItems(updatedItems);
    saveLocalMenuSnapshot(updatedCats, updatedItems);
    toast.success(`Category "${cat.name}" and attached dishes restored!`);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("categories")
          .update({ deleted_at: null })
          .eq("id", cat.id);
        if (error || cat.id.startsWith("cat-")) {
          await supabase.from("categories").update({ deleted_at: null }).eq("slug", cat.slug);
        }

        await supabase
          .from("menu_items")
          .update({ deleted_at: null, available: true })
          .eq("category_id", cat.id);
      } catch (err: unknown) {
        console.warn("Could not sync restore category to Supabase:", err);
      }
    }
  }

  // Permanently Delete Item
  async function handlePermanentDeleteItem(item: DatabaseMenuItem) {
    const updatedItems = items.filter((i) => i.id !== item.id);
    setItems(updatedItems);
    saveLocalMenuSnapshot(categories, updatedItems);
    toast.success(`"${item.name}" permanently deleted`);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
        if (error || item.id.startsWith("dish-")) {
          await supabase.from("menu_items").delete().eq("name", item.name);
        }
      } catch (err: unknown) {
        console.warn("Could not sync permanent delete item to Supabase:", err);
      }
    }
  }

  // Permanently Delete Category
  async function handlePermanentDeleteCategory(cat: DatabaseCategory) {
    const isMatchingItem = (i: DatabaseMenuItem) =>
      i.category_id === cat.id ||
      i.category_id === cat.slug ||
      i.category_id === `cat-${cat.slug}` ||
      Boolean(cat.slug && i.category_id?.includes(cat.slug)) ||
      Boolean(cat.name && i.category_id?.toLowerCase() === cat.name.toLowerCase());

    const updatedCats = categories.filter((c) => c.id !== cat.id);
    const updatedItems = items.map((i) => (isMatchingItem(i) ? { ...i, category_id: null } : i));
    setCategories(updatedCats);
    setItems(updatedItems);
    saveLocalMenuSnapshot(updatedCats, updatedItems);
    toast.success(`Category "${cat.name}" permanently deleted`);

    if (isSupabaseConfigured) {
      try {
        await supabase.from("menu_items").update({ category_id: null }).eq("category_id", cat.id);
        const { error } = await supabase.from("categories").delete().eq("id", cat.id);
        if (error || cat.id.startsWith("cat-")) {
          await supabase.from("categories").delete().eq("slug", cat.slug);
        }
      } catch (err: unknown) {
        console.warn("Could not sync permanent delete category to Supabase:", err);
      }
    }
  }

  // Empty Entire Trash
  async function handleEmptyTrash() {
    const remainingItems = items.filter((i) => !i.deleted_at);
    const remainingCats = categories.filter((c) => !c.deleted_at);
    setItems(remainingItems);
    setCategories(remainingCats);
    saveLocalMenuSnapshot(remainingCats, remainingItems);
    toast.success("Trash emptied permanently");

    if (isSupabaseConfigured) {
      try {
        // Hard delete trashed menu items
        await supabase.from("menu_items").delete().not("deleted_at", "is", null);

        // Unlink attached dishes from trashed categories
        for (const cat of trashedCategories) {
          await supabase.from("menu_items").update({ category_id: null }).eq("category_id", cat.id);
        }

        // Hard delete trashed categories
        await supabase.from("categories").delete().not("deleted_at", "is", null);
      } catch (err: unknown) {
        console.warn("Could not sync empty trash to Supabase:", err);
      }
    }
  }

  // Save Item (Add or Edit) with optimistic update + instant local sync + background DB push
  async function handleSaveItem(data: {
    id?: string;
    name: string;
    description: string | null;
    price: number;
    category_id: string | null;
    image_url: string | null;
    available: boolean;
    sort_order: number;
  }) {
    const isEditing = Boolean(data.id);
    const itemId = data.id || `dish_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const existingItem = items.find((i) => i.id === data.id);

    const updatedItem: DatabaseMenuItem = {
      id: itemId,
      name: data.name,
      description: data.description,
      price: data.price,
      category_id: data.category_id,
      image_url: data.image_url,
      available: data.available,
      sort_order: data.sort_order || (items.length + 1) * 10,
      created_at: existingItem?.created_at || now,
      deleted_at: null,
    };

    let newItems: DatabaseMenuItem[];
    if (isEditing) {
      newItems = items.map((i) => (i.id === data.id ? { ...i, ...updatedItem } : i));
    } else {
      newItems = [updatedItem, ...items];
    }

    setItems(newItems);
    saveLocalMenuSnapshot(categories, newItems);

    toast.success(isEditing ? `"${data.name}" updated!` : `"${data.name}" added to menu!`);

    // Sync to Supabase in the background if configured (non-blocking)
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const isUUIDFormat = (str?: string | null): boolean =>
            Boolean(
              str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
            );

          let dbCategoryId = data.category_id;
          if (dbCategoryId && !isUUIDFormat(dbCategoryId)) {
            const matched = categories.find(
              (c) =>
                c.id === dbCategoryId ||
                c.slug === dbCategoryId ||
                c.name.toLowerCase() === dbCategoryId?.toLowerCase(),
            );
            if (matched && isUUIDFormat(matched.id)) {
              dbCategoryId = matched.id;
            }
          }

          const dbPayload = {
            name: data.name,
            description: data.description,
            price: data.price,
            category_id: dbCategoryId && isUUIDFormat(dbCategoryId) ? dbCategoryId : null,
            image_url: data.image_url,
            available: data.available,
            sort_order: data.sort_order,
          };

          if (isEditing) {
            let updatedInDb = false;

            if (data.id && isUUIDFormat(data.id)) {
              const { data: resData, error: err } = await supabase
                .from("menu_items")
                .update(dbPayload)
                .eq("id", data.id)
                .select();
              if (!err && resData && resData.length > 0) {
                updatedInDb = true;
              }
            }

            if (!updatedInDb && existingItem?.name) {
              const { data: resData, error: errByName } = await supabase
                .from("menu_items")
                .update(dbPayload)
                .eq("name", existingItem.name)
                .select();
              if (!errByName && resData && resData.length > 0) {
                updatedInDb = true;
              }
            }

            if (!updatedInDb) {
              await supabase.from("menu_items").insert(dbPayload);
            }
          } else {
            await supabase.from("menu_items").insert(dbPayload);
          }
        } catch (dbErr) {
          console.warn("Could not sync item to Supabase:", dbErr);
        }
      })();
    }
  }

  // Save Category (Add or Edit)
  async function handleSaveCategory(data: {
    id?: string;
    name: string;
    slug: string;
    sort_order: number;
    available: boolean;
  }) {
    const isEditing = Boolean(data.id);
    const catId = data.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const existingCat = categories.find((c) => c.id === data.id);

    const updatedCat: DatabaseCategory = {
      id: catId,
      name: data.name,
      slug: data.slug,
      sort_order: data.sort_order || (categories.length + 1) * 10,
      available: data.available,
      created_at: existingCat?.created_at || now,
      deleted_at: null,
    };

    let newCats: DatabaseCategory[];
    let newItems = items;
    if (isEditing) {
      newCats = categories.map((c) => (c.id === data.id ? { ...c, ...updatedCat } : c));
      if (existingCat && (existingCat.slug !== data.slug || existingCat.id !== catId)) {
        newItems = items.map((i) => {
          if (
            i.category_id === existingCat.id ||
            i.category_id === existingCat.slug ||
            i.category_id === `cat-${existingCat.slug}`
          ) {
            return { ...i, category_id: catId };
          }
          return i;
        });
        setItems(newItems);
      }
    } else {
      newCats = [...categories, updatedCat];
    }

    setCategories(newCats);
    saveLocalMenuSnapshot(newCats, newItems);

    toast.success(
      isEditing ? `Category "${data.name}" updated!` : `Category "${data.name}" added!`,
    );

    // Sync to Supabase in the background if configured (non-blocking)
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const isUUIDFormat = (str?: string | null): boolean =>
            Boolean(
              str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
            );

          const dbPayload = {
            name: data.name,
            slug: data.slug,
            sort_order: data.sort_order,
            available: data.available,
          };

          if (isEditing) {
            let updatedInDb = false;

            if (data.id && isUUIDFormat(data.id)) {
              const { data: resData, error: err } = await supabase
                .from("categories")
                .update(dbPayload)
                .eq("id", data.id)
                .select();
              if (!err && resData && resData.length > 0) {
                updatedInDb = true;
              }
            }

            if (!updatedInDb && existingCat?.slug) {
              const { data: resData, error: errBySlug } = await supabase
                .from("categories")
                .update(dbPayload)
                .eq("slug", existingCat.slug)
                .select();
              if (!errBySlug && resData && resData.length > 0) {
                updatedInDb = true;
              }
            }

            if (!updatedInDb) {
              await supabase.from("categories").insert(dbPayload);
            }
          } else {
            await supabase.from("categories").insert(dbPayload);
          }
        } catch (dbErr) {
          console.warn("Could not sync category to Supabase:", dbErr);
        }
      })();
    }
  }

  // Filtered menu items, ordered by sort_order
  const filteredItems = useMemo(() => {
    const list = activeItems.filter((item) => {
      return (
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });

    return list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [activeItems, searchQuery]);

  // Categories sorted by sort_order
  const sortedCategories = useMemo(() => {
    return [...activeCategories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [activeCategories]);

  // Lookup map for category name
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(cat.id, cat.name);
      map.set(cat.slug, cat.name);
    });
    return map;
  }, [categories]);

  // Reorder categories step-by-step with immediate database persistence
  async function handleReorderCategories(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || toIdx >= sortedCategories.length) return;
    const current = [...sortedCategories];
    const [movedCat] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, movedCat);

    const reordered = current.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }));

    setCategories(reordered);
    saveLocalMenuSnapshot(reordered, items);
    toast.success(`"${movedCat.name}" moved to position #${toIdx + 1}`);

    try {
      await persistCategoryOrder(reordered);
    } catch (err) {
      console.warn("Failed to persist category order:", err);
    }
  }

  // Reorder menu items step-by-step with immediate database persistence
  async function handleReorderItems(fromFilteredIdx: number, toFilteredIdx: number) {
    if (
      fromFilteredIdx === toFilteredIdx ||
      fromFilteredIdx < 0 ||
      toFilteredIdx < 0 ||
      toFilteredIdx >= filteredItems.length
    )
      return;

    const fromItem = filteredItems[fromFilteredIdx];
    const toItem = filteredItems[toFilteredIdx];
    if (!fromItem || !toItem) return;

    const masterItems = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const masterFromIdx = masterItems.findIndex((i) => i.id === fromItem.id);
    const masterToIdx = masterItems.findIndex((i) => i.id === toItem.id);

    if (masterFromIdx === -1 || masterToIdx === -1) return;

    const [movedItem] = masterItems.splice(masterFromIdx, 1);
    masterItems.splice(masterToIdx, 0, movedItem);

    const reordered = masterItems.map((item, idx) => ({
      ...item,
      sort_order: idx + 1,
    }));

    setItems(reordered);
    saveLocalMenuSnapshot(categories, reordered);
    toast.success(`"${movedItem.name}" moved to position #${toFilteredIdx + 1}`);

    try {
      await persistItemOrder(reordered);
    } catch (err) {
      console.warn("Failed to persist item order:", err);
    }
  }

  // Step helpers to move items/categories directly up or down
  function moveItemStep(idx: number, direction: -1 | 1) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= filteredItems.length) return;
    handleReorderItems(idx, targetIdx);
  }

  function moveCategoryStep(idx: number, direction: -1 | 1) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sortedCategories.length) return;
    handleReorderCategories(idx, targetIdx);
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-primary">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-lg bg-primary font-bold text-xs sm:text-sm text-primary-foreground shadow-xs">
              A
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="font-serif text-sm sm:text-base font-bold text-foreground truncate">
                  Halal Ali Dine Inn
                </h1>
                <Badge
                  variant="outline"
                  className="border-gold/40 text-[9px] sm:text-[10px] text-gold px-1.5 py-0"
                >
                  Admin
                </Badge>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                  {isSupabaseConfigured ? "Cloud Synced" : "Local Synced"}
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
                {session?.user?.email || "admin@halal-ali.com"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to="/"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2 sm:px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title="Open Live Website in New Tab"
            >
              <ExternalLink className="size-3 text-muted-foreground" />
              <span className="hidden xs:inline">Website</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="h-8 px-2 sm:px-3 gap-1 text-xs text-muted-foreground hover:text-destructive"
              title="Sign Out"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-3 py-3 sm:px-6 sm:py-6 overflow-x-hidden">
        {/* Menu Database Storage Management Card */}
        <div className="mb-4 sm:mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 sm:p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            <div className="flex items-start sm:items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Database className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-foreground">
                    Menu Database Storage
                  </h2>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1 px-2 py-0.5"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Database Active ({activeItems.length} Dishes, {activeCategories.length}{" "}
                    Categories)
                  </Badge>
                  {isSupabaseConfigured ? (
                    <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                      Supabase Cloud Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                      Server File DB (data/menu-db.json)
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All menu details (dishes, descriptions, prices, categories, images) are persisted
                  to the database.
                  {lastSavedTimestamp && (
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      • Last stored: {lastSavedTimestamp}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Button
                size="sm"
                onClick={handleStoreAllToDatabase}
                disabled={savingToDb}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs h-9 px-3.5"
                title="Store and persist all menu details to the database"
              >
                {savingToDb ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>{savingToDb ? "Storing to DB..." : "Store All to Database"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => exportDatabaseBackup(categories, items)}
                className="gap-1.5 text-xs h-9 px-3 border-border/80"
                title="Download JSON backup of all stored menu details"
              >
                <Download className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Export JSON</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDbModal(true)}
                className="gap-1.5 text-xs h-9 px-3 border-border/80"
                title="View Database Details and Stats"
              >
                <HardDrive className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">DB Details</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToDefaults}
                disabled={savingToDb}
                className="gap-1 text-xs h-9 px-2 text-muted-foreground hover:text-amber-500"
                title="Re-seed database with default authentic menu details"
              >
                <RotateCcw className="size-3.5" />
                <span className="hidden xl:inline">Reset Defaults</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Metric Overview Cards */}
        <div className="mb-4 sm:mb-6 grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-3 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Dishes</p>
              <div className="grid size-7 sm:size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <UtensilsCrossed className="size-3.5 sm:size-4" />
              </div>
            </div>
            <p className="mt-1 font-serif text-xl sm:text-2xl font-bold text-foreground">
              {activeItems.length}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground hidden xs:block">
              Live menu items
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-3 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Categories</p>
              <div className="grid size-7 sm:size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-3.5 sm:size-4" />
              </div>
            </div>
            <p className="mt-1 font-serif text-xl sm:text-2xl font-bold text-foreground">
              {activeCategories.length}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground hidden xs:block">
              Menu sections
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-3 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Trash (30d)</p>
              <div
                className={`grid size-7 sm:size-9 place-items-center rounded-lg ${
                  trashedItems.length + trashedCategories.length > 0
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Trash2 className="size-3.5 sm:size-4" />
              </div>
            </div>
            <p className="mt-1 font-serif text-xl sm:text-2xl font-bold text-foreground">
              {trashedItems.length + trashedCategories.length}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground hidden xs:block">
              Auto-purges in 30 days
            </p>
          </div>
        </div>

        {dbTableError && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4 text-amber-800 dark:text-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  Supabase Database Setup Required
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  The <code className="text-foreground">categories</code> and{" "}
                  <code className="text-foreground">menu_items</code> tables need to be created in
                  your Supabase project.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(SUPABASE_TRASH_SQL);
                setCopiedSql(true);
                toast.success("Complete Supabase SQL script copied!");
                setTimeout(() => setCopiedSql(false), 3000);
              }}
              className="shrink-0 gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold h-8"
            >
              {copiedSql ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiedSql ? "SQL Copied!" : "Copy Supabase SQL Setup"}
            </Button>
          </div>
        )}

        {/* Navigation Tabs & Actions Bar */}
        <div className="mb-4 sm:mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-4 w-full sm:w-auto sm:inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/60 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSelectTab("items")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                activeTab === "items"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UtensilsCrossed className="size-3.5 shrink-0" />
              <span className="truncate">Items ({activeItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("categories")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                activeTab === "categories"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5 shrink-0" />
              <span className="truncate">Categories ({activeCategories.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("special_offer")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                activeTab === "special_offer"
                  ? "bg-background text-gold shadow-xs ring-1 ring-gold/40 font-semibold"
                  : "text-gold hover:text-gold hover:bg-gold/10"
              }`}
            >
              <Tag className="size-3.5 shrink-0 text-gold" />
              <span className="truncate">Offers</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("trash")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                activeTab === "trash"
                  ? "bg-background text-amber-500 shadow-xs ring-1 ring-amber-500/40 font-semibold"
                  : "text-muted-foreground hover:text-amber-500"
              }`}
            >
              <Trash2 className="size-3.5 shrink-0" />
              <span className="truncate">
                Trash ({trashedItems.length + trashedCategories.length})
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {activeTab === "items" && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemDialogOpen(true);
                }}
                className="h-8 gap-1 bg-primary text-xs font-medium flex-1 sm:flex-none justify-center"
              >
                <Plus className="size-3.5" />
                <span>Add Menu Item</span>
              </Button>
            )}

            {activeTab === "categories" && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryDialogOpen(true);
                }}
                className="h-8 gap-1 bg-primary text-xs font-medium flex-1 sm:flex-none justify-center"
              >
                <Plus className="size-3.5" />
                <span>Add Category</span>
              </Button>
            )}
          </div>
        </div>

        {/* TAB 1: MENU ITEMS */}
        {activeTab === "items" && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search dishes by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs border-border/70"
                />
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto size-6 animate-spin text-gold mb-2" />
                Loading menu items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card p-8 text-center">
                <UtensilsCrossed className="mx-auto size-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs font-medium text-foreground">No dishes found</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query or category filter."
                    : "Get started by adding your first dish to the menu."}
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="h-7 text-xs"
                    >
                      Clear Search
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingItem(null);
                      setItemDialogOpen(true);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="size-3" />
                    Add Dish
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* MOBILE VIEW: Thin, refined vertical cards */}
                <div className="space-y-2 md:hidden">
                  {filteredItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-2.5 transition-colors ${
                        item.available === false
                          ? "border-border/40 bg-card/60 opacity-80"
                          : "border-border/60 bg-card hover:border-gold/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Sort Step Buttons */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveItemStep(idx, -1)}
                            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                            title="Move up"
                            aria-label={`Move ${item.name} up`}
                          >
                            <ChevronUp className="size-3.5" />
                          </button>

                          <span className="text-[10px] font-mono text-muted-foreground/70 font-medium">
                            #{idx + 1}
                          </span>

                          <button
                            type="button"
                            disabled={idx === filteredItems.length - 1}
                            onClick={() => moveItemStep(idx, 1)}
                            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                            title="Move down"
                            aria-label={`Move ${item.name} down`}
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                        </div>

                        {/* Thumbnail Image */}
                        <div className="size-11 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="size-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-muted-foreground">
                              <ImageIcon className="size-3.5 opacity-40" />
                            </div>
                          )}
                        </div>

                        {/* Thin Item Details */}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-xs text-foreground leading-snug truncate">
                            {item.name}
                          </h4>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gold text-xs shrink-0">
                              {formatPrice(item.price)}
                            </span>
                            <span className="text-muted-foreground text-[10px] shrink-0">•</span>
                            <span className="inline-flex rounded bg-muted/80 px-1.5 py-0.2 text-[10px] font-normal text-muted-foreground truncate max-w-[100px]">
                              {item.category_id
                                ? categoryMap.get(item.category_id) || "Category"
                                : "Category"}
                            </span>
                            {/* 1-tap Active/Inactive toggle button */}
                            <button
                              type="button"
                              onClick={() => handleToggleItemVisibility(item)}
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                item.available !== false
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                                  : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                              }`}
                              title={`Click to mark ${item.available !== false ? "Inactive" : "Active"}`}
                            >
                              {item.available !== false ? (
                                <>
                                  <span className="size-1.5 rounded-full bg-emerald-500" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                                  <span>Inactive</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingItem(item);
                              setItemDialogOpen(true);
                            }}
                            className="h-7 px-2 text-[11px] font-medium"
                            title="Edit Dish"
                          >
                            <Edit2 className="size-3" />
                            <span className="hidden xs:inline ml-1">Edit</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTrashItem(item)}
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                            title="Move Dish to Trash"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP VIEW: Sleek Table with thin rows and Order Step Buttons */}
                <div className="hidden md:block overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/60 bg-muted/30 font-medium text-muted-foreground">
                        <tr>
                          <th className="w-14 px-3 py-2.5 text-center font-normal">Order</th>
                          <th className="px-3 py-2.5 w-14">Image</th>
                          <th className="px-4 py-2.5">Dish Name</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Price (₹)</th>
                          <th className="px-4 py-2.5 text-center">Visibility</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredItems.map((item, idx) => (
                          <tr
                            key={item.id}
                            className={`transition-colors hover:bg-muted/20 ${
                              item.available === false ? "opacity-75 bg-muted/10" : ""
                            }`}
                          >
                            {/* Order Step Buttons */}
                            <td className="w-14 px-2 py-2 text-center align-middle">
                              <div className="inline-flex items-center gap-1">
                                <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">
                                  #{idx + 1}
                                </span>
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => moveItemStep(idx, -1)}
                                    className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold disabled:opacity-20 disabled:pointer-events-none"
                                    title="Move up"
                                    aria-label={`Move ${item.name} up`}
                                  >
                                    <ChevronUp className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === filteredItems.length - 1}
                                    onClick={() => moveItemStep(idx, 1)}
                                    className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold disabled:opacity-20 disabled:pointer-events-none"
                                    title="Move down"
                                    aria-label={`Move ${item.name} down`}
                                  >
                                    <ChevronDown className="size-3" />
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Dish Image */}
                            <td className="px-3 py-2">
                              <div className="size-10 overflow-hidden rounded-md border border-border/50 bg-muted">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="size-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="grid size-full place-items-center text-muted-foreground">
                                    <ImageIcon className="size-3.5 opacity-40" />
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Name */}
                            <td className="px-4 py-2 max-w-sm">
                              <p className="font-medium text-foreground text-xs">{item.name}</p>
                            </td>

                            {/* Category Badge */}
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className="inline-flex rounded bg-muted/80 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                                {item.category_id
                                  ? categoryMap.get(item.category_id) || "Category"
                                  : "Category"}
                              </span>
                            </td>

                            {/* Price */}
                            <td className="px-4 py-2 font-semibold text-gold text-xs whitespace-nowrap">
                              {formatPrice(item.price)}
                            </td>

                            {/* 1-tap Visibility toggle */}
                            <td className="px-4 py-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleToggleItemVisibility(item)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                                  item.available !== false
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-2xs"
                                    : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                                }`}
                                title={`Click to toggle: currently ${item.available !== false ? "Active" : "Inactive"}`}
                              >
                                {item.available !== false ? (
                                  <>
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    <span>Active</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                                    <span>Inactive</span>
                                  </>
                                )}
                              </button>
                            </td>

                            {/* Edit / Delete Buttons */}
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setItemDialogOpen(true);
                                  }}
                                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                                  title="Edit Dish"
                                >
                                  <Edit2 className="size-3" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTrashItem(item)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Move Dish to Trash"
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: CATEGORIES */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            {sortedCategories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-card p-8 text-center">
                <Layers className="mx-auto size-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs font-medium text-foreground">No categories found</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Categories organize dishes into distinct sections.
                </p>
                <div className="mt-3 flex justify-center">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryDialogOpen(true);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="size-3" />
                    Add Category
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* MOBILE VIEW: Thin category cards */}
                <div className="space-y-2 md:hidden">
                  {sortedCategories.map((cat, idx) => {
                    const count = activeItems.filter((i) => i.category_id === cat.id).length;
                    return (
                      <div
                        key={cat.id}
                        className={`rounded-lg border p-2.5 transition-colors ${
                          cat.available === false
                            ? "border-border/40 bg-card/60 opacity-80"
                            : "border-border/60 bg-card hover:border-gold/30"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {/* Order Step Buttons */}
                          <div className="flex flex-col items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveCategoryStep(idx, -1)}
                              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                              title="Move up"
                              aria-label={`Move category ${cat.name} up`}
                            >
                              <ChevronUp className="size-3.5" />
                            </button>

                            <span className="text-[10px] font-mono text-muted-foreground/70 font-medium">
                              #{idx + 1}
                            </span>

                            <button
                              type="button"
                              disabled={idx === sortedCategories.length - 1}
                              onClick={() => moveCategoryStep(idx, 1)}
                              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                              title="Move down"
                              aria-label={`Move category ${cat.name} down`}
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>

                          {/* Category Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-medium text-xs text-foreground truncate">
                                {cat.name}
                              </h4>
                              {isShopCategory(cat) && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0 font-medium text-amber-500 border-amber-500/40 bg-amber-500/10 shrink-0"
                                >
                                  Shop (Excluded)
                                </Badge>
                              )}
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1.5 py-0 font-normal shrink-0"
                              >
                                {count} {count === 1 ? "item" : "items"}
                              </Badge>

                              {/* 1-tap Active/Inactive toggle button */}
                              <button
                                type="button"
                                onClick={() => handleToggleCategoryVisibility(cat)}
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                  cat.available !== false
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                                    : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                                }`}
                                title={`Click to mark ${cat.available !== false ? "Inactive" : "Active"}`}
                              >
                                {cat.available !== false ? (
                                  <>
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    <span>Active</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                                    <span>Inactive</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">
                              /{cat.slug}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCategoryDialogOpen(true);
                              }}
                              className="h-7 px-2 text-[11px] font-medium"
                              title="Edit Category"
                            >
                              <Edit2 className="size-3" />
                              <span className="hidden xs:inline ml-1">Edit</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTrashCategory(cat)}
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                              title="Move Category to Trash"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW: Sleek Table */}
                <div className="hidden md:block rounded-xl border border-border/60 bg-card shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/60 bg-muted/30 font-medium text-muted-foreground">
                        <tr>
                          <th className="w-14 px-3 py-2.5 text-center font-normal">Order</th>
                          <th className="px-4 py-2.5">Category Name</th>
                          <th className="px-4 py-2.5">URL Slug</th>
                          <th className="px-4 py-2.5">Items Count</th>
                          <th className="px-4 py-2.5 text-center">Visibility</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {sortedCategories.map((cat, idx) => {
                          const count = activeItems.filter((i) => i.category_id === cat.id).length;
                          return (
                            <tr
                              key={cat.id}
                              className={`transition-colors hover:bg-muted/20 ${
                                cat.available === false ? "opacity-75 bg-muted/10" : ""
                              }`}
                            >
                              {/* Order Step Buttons */}
                              <td className="w-14 px-2 py-2 text-center align-middle">
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">
                                    #{idx + 1}
                                  </span>
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => moveCategoryStep(idx, -1)}
                                      className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold disabled:opacity-20 disabled:pointer-events-none"
                                      title="Move up"
                                      aria-label={`Move category ${cat.name} up`}
                                    >
                                      <ChevronUp className="size-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === sortedCategories.length - 1}
                                      onClick={() => moveCategoryStep(idx, 1)}
                                      className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-gold/15 hover:text-gold disabled:opacity-20 disabled:pointer-events-none"
                                      title="Move down"
                                      aria-label={`Move category ${cat.name} down`}
                                    >
                                      <ChevronDown className="size-3" />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-2 font-medium text-foreground text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{cat.name}</span>
                                  {isShopCategory(cat) && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1.5 py-0 font-medium text-amber-500 border-amber-500/40 bg-amber-500/10 shrink-0"
                                    >
                                      Shop (Excluded)
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2 font-mono text-muted-foreground text-[11px]">
                                /{cat.slug}
                              </td>
                              <td className="px-4 py-2">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-normal px-1.5 py-0"
                                >
                                  {count} {count === 1 ? "item" : "items"}
                                </Badge>
                              </td>

                              {/* 1-tap Visibility toggle */}
                              <td className="px-4 py-2 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCategoryVisibility(cat)}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                                    cat.available !== false
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-2xs"
                                      : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                                  }`}
                                  title={`Click to toggle: currently ${cat.available !== false ? "Active" : "Inactive"}`}
                                >
                                  {cat.available !== false ? (
                                    <>
                                      <span className="size-1.5 rounded-full bg-emerald-500" />
                                      <span>Active</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                                      <span>Inactive</span>
                                    </>
                                  )}
                                </button>
                              </td>

                              <td className="px-4 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCategory(cat);
                                      setCategoryDialogOpen(true);
                                    }}
                                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Edit Category"
                                  >
                                    <Edit2 className="size-3" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTrashCategory(cat)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    title="Move Category to Trash"
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: SPECIAL OFFER / COMBO BANNER */}
        {activeTab === "special_offer" && <SpecialOfferManager />}

        {/* TAB 4: TRASH & RECYCLE BIN (30-DAY AUTO PURGE) */}
        {activeTab === "trash" && (
          <TrashManager
            trashedItems={trashedItems}
            trashedCategories={trashedCategories}
            categoryMap={categoryMap}
            onRestoreItem={handleRestoreItem}
            onRestoreCategory={handleRestoreCategory}
            onPermanentDeleteItem={handlePermanentDeleteItem}
            onPermanentDeleteCategory={handlePermanentDeleteCategory}
            onEmptyTrash={handleEmptyTrash}
          />
        )}
      </main>

      {/* Item Dialog */}
      <MenuItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        categories={activeCategories}
        onSave={handleSaveItem}
      />

      {/* Category Dialog */}
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        onSave={handleSaveCategory}
      />

      {/* Database Details Dialog */}
      <Dialog open={showDbModal} onOpenChange={setShowDbModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Database className="size-5 text-emerald-500" />
              Menu Database Storage Details
            </DialogTitle>
            <DialogDescription>
              Real-time inspection of menu details stored in the persistent database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Stored Items</p>
                <p className="text-xl font-bold font-serif text-foreground mt-0.5">
                  {items.length}
                </p>
                <p className="text-[10px] text-muted-foreground">{activeItems.length} active</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Categories</p>
                <p className="text-xl font-bold font-serif text-foreground mt-0.5">
                  {categories.length}
                </p>
                <p className="text-[10px] text-muted-foreground">{activeCategories.length} live</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Server Database</p>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  Active
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">data/menu-db.json</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Supabase Sync</p>
                <p className="text-xs font-semibold mt-1">
                  {isSupabaseConfigured ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                  ) : (
                    <span className="text-muted-foreground">Local fallback</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">Postgres Tables</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Stored Categories & Dishes Breakdown
              </h4>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
                {activeCategories.map((cat) => {
                  const catItems = activeItems.filter(
                    (i) =>
                      i.category_id === cat.id ||
                      i.category_id === cat.slug ||
                      i.category_id === `cat-${cat.slug}` ||
                      (cat.slug && i.category_id?.includes(cat.slug)),
                  );
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30"
                    >
                      <div>
                        <span className="font-medium text-foreground">{cat.name}</span>
                        <span className="text-muted-foreground ml-2 text-[11px] font-mono">
                          ({cat.slug || cat.id})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {catItems.length} {catItems.length === 1 ? "dish" : "dishes"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        >
                          Stored
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">How Database Persistence Works:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  All details (item names, descriptions, prices, photos, categories) are saved
                  directly in <code className="text-foreground">data/menu-db.json</code> on the
                  server.
                </li>
                <li>
                  The public menu (<code className="text-foreground">/menu</code> and home page)
                  automatically reads from this database.
                </li>
                <li>
                  Any new dishes or updates you make in this Admin Panel are immediately saved to
                  the database file and synced across devices.
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/80">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportDatabaseBackup(categories, items);
              }}
              className="gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              <span>Export Database JSON</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  await handleStoreAllToDatabase();
                  setShowDbModal(false);
                }}
                disabled={savingToDb}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {savingToDb ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>Store All Now</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
