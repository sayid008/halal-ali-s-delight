import { useState, useEffect, useMemo, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  type DatabaseMenuItem,
  type DatabaseCategory,
  formatPrice,
  isShopCategory,
  supabase,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  getLocalMenuSnapshot,
  saveLocalMenuSnapshot,
  persistCategoryOrder,
  persistItemOrder,
} from "@/lib/menu-order";
import { useAdminBatchSync } from "@/hooks/use-admin-batch-sync";
import { MenuItemDialog } from "./menu-item-dialog";
import { CategoryDialog } from "./category-dialog";
import { SpecialOfferManager } from "./special-offer-manager";
import { OpeningHoursManager } from "./opening-hours-manager";
import { TrashManager } from "./trash-manager";
import { SUPABASE_TRASH_SQL } from "@/lib/trash";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  UtensilsCrossed,
  Layers,
  Sparkles,
  Clock,
  Trash2,
  Database,
  Plus,
  Search,
  LogOut,
  ExternalLink,
  Edit2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Loader2,
  HardDrive,
  RotateCcw,
  Download,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

interface AdminPanelProps {
  session: Session;
  onSignOut: () => Promise<void>;
}

export function AdminPanel({ session, onSignOut }: AdminPanelProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    "dishes" | "categories" | "offers" | "hours" | "trash" | "database"
  >("dishes");

  // Menu data states
  const [categories, setCategories] = useState<DatabaseCategory[]>([]);
  const [items, setItems] = useState<DatabaseMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">(
    "all",
  );

  // Dialog states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<DatabaseCategory | null>(
    null,
  );

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<DatabaseMenuItem | null>(null);

  // Database Backup modal
  const [copiedSql, setCopiedSql] = useState(false);
  const [resettingDefaults, setResettingDefaults] = useState(false);

  // Batch sync hook
  const batchSync = useAdminBatchSync({
    initialCategories: categories,
    initialItems: items,
    onRollback: (rolledCats, rolledItems) => {
      setCategories(rolledCats);
      setItems(rolledItems);
    },
    debounceMs: 300,
  });

  // Load menu data on mount
  const loadMenuData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Check local snapshot first
      const cached = getLocalMenuSnapshot();
      if (cached && cached.categories?.length > 0) {
        setCategories(cached.categories);
        setItems(cached.items || []);
      }

      // 2. Fetch server state
      const res = await fetch("/api/menu", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.categories && data.items) {
          setCategories(data.categories);
          setItems(data.items);
          saveLocalMenuSnapshot(data.categories, data.items, "admin-panel", {
            skipServerFetch: true,
          });
        }
      }
    } catch (err) {
      console.warn("Could not fetch server menu data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // Helper to commit changes
  const persistChanges = useCallback(
    (
      newCats: DatabaseCategory[],
      newItems: DatabaseMenuItem[],
      options?: { immediate?: boolean },
    ) => {
      setCategories(newCats);
      setItems(newItems);
      batchSync.queueBatchUpdate(newCats, newItems, { immediate: options?.immediate });
    },
    [batchSync],
  );

  // Active vs Trashed sets
  const activeCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.deleted_at)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [categories],
  );

  const trashedCategories = useMemo(
    () => categories.filter((c) => Boolean(c.deleted_at)),
    [categories],
  );

  const activeItems = useMemo(
    () =>
      items.filter((i) => !i.deleted_at).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items],
  );

  const trashedItems = useMemo(() => items.filter((i) => Boolean(i.deleted_at)), [items]);

  // Filtered dishes for view
  const filteredItems = useMemo(() => {
    return activeItems.filter((dish) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = dish.name.toLowerCase().includes(q);
        const matchesDesc = (dish.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== "all") {
        if (dish.category_id !== selectedCategoryFilter) return false;
      }

      // Availability filter
      if (availabilityFilter === "available" && !dish.available) return false;
      if (availabilityFilter === "unavailable" && dish.available) return false;

      return true;
    });
  }, [activeItems, searchQuery, selectedCategoryFilter, availabilityFilter]);

  // Metrics
  const totalDishes = activeItems.length;
  const inStockDishes = activeItems.filter((i) => i.available).length;
  const outOfStockDishes = totalDishes - inStockDishes;
  const totalCategories = activeCategories.length;
  const totalTrash = trashedCategories.length + trashedItems.length;

  // -------------------------------------------------------------
  // CATEGORY ACTIONS
  // -------------------------------------------------------------
  function handleSaveCategory(data: {
    id?: string;
    name: string;
    slug: string;
    sort_order: number;
    available: boolean;
  }) {
    let updatedCats = [...categories];
    if (data.id) {
      // Edit existing
      updatedCats = updatedCats.map((c) => (c.id === data.id ? { ...c, ...data } : c));
      toast.success(`Category "${data.name}" updated`);
    } else {
      // Add new
      const newCat: DatabaseCategory = {
        id: "cat-" + Date.now(),
        name: data.name,
        slug: data.slug,
        sort_order: data.sort_order,
        available: data.available,
        created_at: new Date().toISOString(),
      };
      updatedCats.push(newCat);
      toast.success(`Category "${data.name}" created`);
    }

    persistChanges(updatedCats, items, { immediate: true });
  }

  function handleTrashCategory(cat: DatabaseCategory) {
    const now = new Date().toISOString();
    const updatedCats = categories.map((c) => (c.id === cat.id ? { ...c, deleted_at: now } : c));

    // Also soft-delete associated dishes
    const updatedItems = items.map((i) =>
      i.category_id === cat.id ? { ...i, deleted_at: now } : i,
    );

    persistChanges(updatedCats, updatedItems, { immediate: true });
    toast.info(`Moved category "${cat.name}" and its dishes to Trash`);
  }

  function handleMoveCategory(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === activeCategories.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...activeCategories];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Re-assign sort orders
    const updatedOrderCats = reordered.map((cat, i) => ({ ...cat, sort_order: i }));

    // Merge with trashed
    const finalCats = categories.map((c) => {
      const match = updatedOrderCats.find((u) => u.id === c.id);
      return match || c;
    });

    persistChanges(finalCats, items);
  }

  // -------------------------------------------------------------
  // DISH ACTIONS
  // -------------------------------------------------------------
  function handleSaveDish(data: {
    id?: string;
    name: string;
    description: string;
    price: number;
    category_id: string | null;
    image_url: string | null;
    available: boolean;
    sort_order: number;
  }) {
    let updatedItems = [...items];
    if (data.id) {
      // Edit existing
      updatedItems = updatedItems.map((i) => (i.id === data.id ? { ...i, ...data } : i));
      toast.success(`Dish "${data.name}" updated`);
    } else {
      // Add new
      const newItem: DatabaseMenuItem = {
        id: "item-" + Date.now(),
        name: data.name,
        description: data.description,
        price: data.price,
        category_id: data.category_id,
        image_url: data.image_url,
        available: data.available,
        sort_order: data.sort_order,
        created_at: new Date().toISOString(),
      };
      updatedItems.push(newItem);
      toast.success(`Dish "${data.name}" added to menu`);
    }

    persistChanges(categories, updatedItems, { immediate: true });
  }

  function handleToggleDishAvailable(dish: DatabaseMenuItem) {
    const newStatus = !dish.available;
    const updatedItems = items.map((i) => (i.id === dish.id ? { ...i, available: newStatus } : i));

    persistChanges(categories, updatedItems);
    toast.success(`"${dish.name}" is now ${newStatus ? "In Stock (Available)" : "Out of Stock"}`, {
      duration: 2000,
    });
  }

  function handleTrashDish(dish: DatabaseMenuItem) {
    const now = new Date().toISOString();
    const updatedItems = items.map((i) => (i.id === dish.id ? { ...i, deleted_at: now } : i));

    persistChanges(categories, updatedItems, { immediate: true });
    toast.info(`Moved "${dish.name}" to Trash`);
  }

  function handleMoveDish(dish: DatabaseMenuItem, direction: "up" | "down") {
    const categoryDishes = activeItems.filter((i) => i.category_id === dish.category_id);
    const index = categoryDishes.findIndex((i) => i.id === dish.id);

    if (
      (direction === "up" && index <= 0) ||
      (direction === "down" && index >= categoryDishes.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...categoryDishes];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const updatedCatItems = reordered.map((item, i) => ({ ...item, sort_order: i }));

    const finalItems = items.map((item) => {
      const match = updatedCatItems.find((u) => u.id === item.id);
      return match || item;
    });

    persistChanges(categories, finalItems);
  }

  // -------------------------------------------------------------
  // TRASH RESTORE / PURGE ACTIONS
  // -------------------------------------------------------------
  function handleRestoreCategory(catId: string) {
    const updatedCats = categories.map((c) => (c.id === catId ? { ...c, deleted_at: null } : c));
    // Also restore associated dishes
    const updatedItems = items.map((i) =>
      i.category_id === catId ? { ...i, deleted_at: null } : i,
    );

    persistChanges(updatedCats, updatedItems, { immediate: true });
    toast.success("Category and its dishes restored to active menu");
  }

  function handleRestoreDish(dishId: string) {
    const updatedItems = items.map((i) => (i.id === dishId ? { ...i, deleted_at: null } : i));

    persistChanges(categories, updatedItems, { immediate: true });
    toast.success("Dish restored to active menu");
  }

  function handlePermanentDeleteCategory(catId: string) {
    const updatedCats = categories.filter((c) => c.id !== catId);
    const updatedItems = items.filter((i) => i.category_id !== catId);

    persistChanges(updatedCats, updatedItems, { immediate: true });
    toast.info("Category permanently purged");
  }

  function handlePermanentDeleteDish(dishId: string) {
    const updatedItems = items.filter((i) => i.id !== dishId);

    persistChanges(categories, updatedItems, { immediate: true });
    toast.info("Dish permanently purged");
  }

  function handleEmptyAllTrash() {
    const updatedCats = categories.filter((c) => !c.deleted_at);
    const updatedItems = items.filter((i) => !i.deleted_at);

    persistChanges(updatedCats, updatedItems, { immediate: true });
    toast.success("All trashed items permanently deleted");
  }

  // -------------------------------------------------------------
  // DATABASE ACTIONS & BACKUP
  // -------------------------------------------------------------
  async function handleStoreAllExplicit() {
    const res = await batchSync.flushPending();
    if (res.success) {
      toast.success("All Menu Details Stored in Database!", {
        description: `Committed ${activeItems.length} active dishes across ${activeCategories.length} categories.`,
      });
    } else {
      toast.error("Database storage failed", { description: res.message });
    }
  }

  async function handleResetToDefaultMenu() {
    if (!confirm("Reset database to authentic default menu dishes and categories?")) {
      return;
    }

    setResettingDefaults(true);
    try {
      const res = await fetch("/api/menu/reset-defaults", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.categories && data.items) {
          setCategories(data.categories);
          setItems(data.items);
          saveLocalMenuSnapshot(data.categories, data.items, "admin-panel", {
            skipServerFetch: true,
          });
          toast.success("Database restored with full authentic Halal Ali Dine Inn menu!");
        }
      }
    } catch (e) {
      toast.error("Failed to reset default menu");
    } finally {
      setResettingDefaults(false);
    }
  }

  function handleExportBackup() {
    const payload = {
      categories,
      items,
      export_date: new Date().toISOString(),
      restaurant: "Halal Ali Dine Inn & Take Away",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halal-ali-menu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Menu backup downloaded");
  }

  function handleCopySql() {
    navigator.clipboard.writeText(SUPABASE_TRASH_SQL);
    setCopiedSql(true);
    toast.success("Supabase SQL schema copied to clipboard");
    setTimeout(() => setCopiedSql(false), 2500);
  }

  return (
    <div className="min-h-screen bg-muted/10 pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 backdrop-blur-md shadow-xs">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <UtensilsCrossed className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-none font-serif">
                Halal Ali Dine Inn
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Admin Management Portal</p>
            </div>
          </div>

          {/* Sync Status & Action Bar */}
          <div className="flex items-center gap-2.5">
            {/* Sync Status Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border/80 bg-background/80">
              {batchSync.isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">Saving to DB...</span>
                </>
              ) : batchSync.lastError ? (
                <>
                  <AlertCircle className="size-3.5 text-destructive" />
                  <span className="text-destructive">Sync Notice</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span className="text-muted-foreground">
                    {batchSync.lastSavedAt ? `Saved (${batchSync.lastSavedAt})` : "Database Synced"}
                  </span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleStoreAllExplicit}
              disabled={batchSync.isSaving}
              className="h-8 text-xs gap-1.5 font-medium border-border/80"
              title="Commit all current menu items to database"
            >
              <HardDrive className="size-3.5 text-primary" />
              Store All to DB
            </Button>

            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden md:inline">View Website</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Dishes
                </p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">{totalDishes}</h3>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {inStockDishes} in stock
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <UtensilsCrossed className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Categories
                </p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">{totalCategories}</h3>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Active sections
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Layers className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Out of Stock
                </p>
                <h3
                  className={`text-xl font-bold mt-0.5 ${
                    outOfStockDishes > 0 ? "text-amber-500" : "text-foreground"
                  }`}
                >
                  {outOfStockDishes}
                </h3>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {outOfStockDishes > 0 ? "Unavailable in menu" : "All available"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Promotions
                </p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">Live</h3>
                <span className="text-[10px] text-muted-foreground font-medium">Hero banner</span>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Sparkles className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs col-span-2 sm:col-span-4 lg:col-span-1">
            <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Trash Bin
                </p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">{totalTrash}</h3>
                <span className="text-[10px] text-muted-foreground font-medium">
                  30-day retention
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Trash2 className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/60">
          <Button
            variant={activeTab === "dishes" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("dishes")}
            className="text-xs h-9 gap-1.5 font-medium shrink-0"
          >
            <UtensilsCrossed className="size-4" />
            Menu & Dishes ({totalDishes})
          </Button>

          <Button
            variant={activeTab === "categories" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("categories")}
            className="text-xs h-9 gap-1.5 font-medium shrink-0"
          >
            <Layers className="size-4" />
            Categories ({totalCategories})
          </Button>

          <Button
            variant={activeTab === "offers" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("offers")}
            className="text-xs h-9 gap-1.5 font-medium shrink-0"
          >
            <Sparkles className="size-4" />
            Special Offers & Banner
          </Button>

          <Button
            variant={activeTab === "hours" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("hours")}
            className="text-xs h-9 gap-1.5 font-medium shrink-0"
          >
            <Clock className="size-4" />
            Operating Hours & Status
          </Button>

          <Button
            variant={activeTab === "trash" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("trash")}
            className="text-xs h-9 gap-1.5 font-medium shrink-0"
          >
            <Trash2 className="size-4" />
            Trash Bin ({totalTrash})
          </Button>

          <Button
            variant={activeTab === "database" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("database")}
            className="text-xs h-9 gap-1.5 font-medium shrink-0"
          >
            <Database className="size-4" />
            Database & Backups
          </Button>
        </div>

        {/* TAB 1: MENU & DISHES */}
        {activeTab === "dishes" && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60 shadow-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search dishes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background"
                  />
                </div>

                {/* Category Filter */}
                <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Availability Filter */}
                <Select
                  value={availabilityFilter}
                  onValueChange={(val) =>
                    setAvailabilityFilter(val as "all" | "available" | "unavailable")
                  }
                >
                  <SelectTrigger className="h-8 text-xs w-[130px] bg-background">
                    <SelectValue placeholder="Availability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">In Stock</SelectItem>
                    <SelectItem value="unavailable">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Add Dish Button */}
              <Button
                size="sm"
                onClick={() => {
                  setSelectedItemForEdit(null);
                  setItemModalOpen(true);
                }}
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-medium shrink-0"
              >
                <Plus className="size-3.5" />
                Add New Dish
              </Button>
            </div>

            {/* Dishes List */}
            {filteredItems.length === 0 ? (
              <Card className="border-dashed p-10 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                  <UtensilsCrossed className="size-6" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No Dishes Found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedCategoryFilter !== "all"
                    ? "Try adjusting your search query or filters."
                    : "Get started by adding dishes to your menu."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedCategoryFilter("all");
                    setSearchQuery("");
                    setAvailabilityFilter("all");
                  }}
                  className="mt-3 h-8 text-xs"
                >
                  Reset Filters
                </Button>
              </Card>
            ) : (
              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
                {filteredItems.map((dish) => {
                  const cat = categories.find((c) => c.id === dish.category_id);
                  return (
                    <div
                      key={dish.id}
                      className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                    >
                      {/* Left: Image & Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {dish.image_url ? (
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="size-14 rounded-lg object-cover border border-border shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="size-14 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/60">
                            <UtensilsCrossed className="size-6 text-muted-foreground" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground">{dish.name}</span>
                            {cat && (
                              <Badge variant="secondary" className="text-[10px] font-medium">
                                {cat.name}
                              </Badge>
                            )}
                            <Badge
                              variant={dish.available ? "default" : "destructive"}
                              className="text-[10px]"
                            >
                              {dish.available ? "In Stock" : "Out of Stock"}
                            </Badge>
                          </div>

                          {dish.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {dish.description}
                            </p>
                          )}

                          <div className="text-xs font-bold text-primary mt-1">
                            £{Number(dish.price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/60">
                        {/* Quick In-Stock Switch */}
                        <div className="flex items-center gap-1.5 pr-2 border-r border-border/60">
                          <span className="text-[11px] text-muted-foreground hidden md:inline">
                            Available:
                          </span>
                          <Switch
                            checked={dish.available}
                            onCheckedChange={() => handleToggleDishAvailable(dish)}
                          />
                        </div>

                        {/* Reorder Buttons */}
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveDish(dish, "up")}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Move Up"
                          >
                            <ChevronUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveDish(dish, "down")}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Move Down"
                          >
                            <ChevronDown className="size-3.5" />
                          </Button>
                        </div>

                        {/* Edit Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedItemForEdit(dish);
                            setItemModalOpen(true);
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <Edit2 className="size-3" />
                          Edit
                        </Button>

                        {/* Trash Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTrashDish(dish)}
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Move to Trash"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CATEGORIES */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border/60 shadow-xs">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Menu Categories</h3>
                <p className="text-xs text-muted-foreground">
                  Organize dishes into sections shown on the restaurant menu.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedCategoryForEdit(null);
                  setCategoryModalOpen(true);
                }}
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-medium"
              >
                <Plus className="size-3.5" />
                Add Category
              </Button>
            </div>

            <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
              {activeCategories.map((cat, idx) => {
                const dishCount = activeItems.filter((i) => i.category_id === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-muted text-foreground font-mono text-xs font-bold w-9 text-center">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{cat.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {dishCount} dishes
                          </Badge>
                          {cat.available === false && (
                            <Badge variant="destructive" className="text-[10px]">
                              Hidden
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                          slug: {cat.slug}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Move Up/Down */}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, "up")}
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Move Up"
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={idx === activeCategories.length - 1}
                        onClick={() => handleMoveCategory(idx, "down")}
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Move Down"
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCategoryForEdit(cat);
                          setCategoryModalOpen(true);
                        }}
                        className="h-7 text-xs gap-1"
                      >
                        <Edit2 className="size-3" />
                        Edit
                      </Button>

                      {/* Trash */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTrashCategory(cat)}
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Move to Trash"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SPECIAL OFFERS */}
        {activeTab === "offers" && <SpecialOfferManager />}

        {/* TAB 4: OPERATING HOURS & ANNOUNCEMENTS */}
        {activeTab === "hours" && <OpeningHoursManager />}

        {/* TAB 5: TRASH BIN */}
        {activeTab === "trash" && (
          <TrashManager
            trashedCategories={trashedCategories}
            trashedItems={trashedItems}
            onRestoreCategory={handleRestoreCategory}
            onRestoreItem={handleRestoreDish}
            onPermanentDeleteCategory={handlePermanentDeleteCategory}
            onPermanentDeleteItem={handlePermanentDeleteDish}
            onEmptyAllTrash={handleEmptyAllTrash}
          />
        )}

        {/* TAB 6: DATABASE & BACKUPS */}
        {activeTab === "database" && (
          <div className="space-y-6">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  Database Synchronization & Backups
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Backup export */}
                  <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                    <span className="text-xs font-semibold block">Download JSON Backup</span>
                    <p className="text-[11px] text-muted-foreground">
                      Save a complete JSON snapshot of all dishes, categories, and settings.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportBackup}
                      className="w-full text-xs gap-1.5 h-8 mt-2"
                    >
                      <Download className="size-3.5" />
                      Download Backup
                    </Button>
                  </div>

                  {/* Seed / Reset default */}
                  <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                    <span className="text-xs font-semibold block">Restore Default Menu</span>
                    <p className="text-[11px] text-muted-foreground">
                      Reset database to the curated Halal Ali Dine Inn restaurant dishes.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resettingDefaults}
                      onClick={handleResetToDefaultMenu}
                      className="w-full text-xs gap-1.5 h-8 mt-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <RotateCcw className="size-3.5" />
                      {resettingDefaults ? "Restoring..." : "Restore Default Menu"}
                    </Button>
                  </div>

                  {/* Supabase SQL Helper */}
                  <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                    <span className="text-xs font-semibold block">Supabase SQL Schema</span>
                    <p className="text-[11px] text-muted-foreground">
                      Copy SQL schema for PostgreSQL tables, storage buckets, and RLS policies.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopySql}
                      className="w-full text-xs gap-1.5 h-8 mt-2"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="size-3.5 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy Supabase SQL
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* DIALOGS */}
      <CategoryDialog
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        category={selectedCategoryForEdit}
        onSave={handleSaveCategory}
        existingCount={activeCategories.length}
      />

      <MenuItemDialog
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        item={selectedItemForEdit}
        categories={activeCategories}
        onSave={handleSaveDish}
        existingCount={activeItems.length}
      />
    </div>
  );
}
