import { useEffect, useState, useMemo, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  formatPrice,
  type DatabaseMenuItem,
  type DatabaseCategory,
} from "@/lib/supabase";
import { persistCategoryOrder, persistItemOrder } from "@/lib/menu-order";
import { MenuItemDialog } from "./menu-item-dialog";
import { CategoryDialog } from "./category-dialog";
import { SpecialOfferManager } from "./special-offer-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  ImageIcon,
  Tag,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { menuSections as homeSections } from "@/data/menu";

interface AdminPanelProps {
  session: Session;
  onSignOut: () => void;
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
  const [items, setItems] = useState<DatabaseMenuItem[]>([]);
  const [categories, setCategories] = useState<DatabaseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab with URL synchronization
  const [activeTab, setActiveTab] = useState<"items" | "categories" | "special_offer">(() => {
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
    }
    return "items";
  });

  function handleSelectTab(tab: "items" | "categories" | "special_offer") {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  }

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Dialog States
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatabaseMenuItem | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DatabaseCategory | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
      ]);

      let loadedCategories = (catRes.data as DatabaseCategory[]) || [];
      let loadedItems = (itemRes.data as DatabaseMenuItem[]) || [];

      // If Supabase tables are currently empty, auto-populate from the home page menu details
      if (loadedCategories.length === 0 || loadedItems.length === 0) {
        try {
          // Sync categories
          const catInserts = homeSections.map((sec, idx) => ({
            name: sec.title,
            slug: sec.id,
            sort_order: idx + 1,
          }));

          const { data: upsertedCats } = await supabase
            .from("categories")
            .upsert(catInserts, { onConflict: "slug" })
            .select();

          const catMap = new Map<string, string>();
          if (upsertedCats && upsertedCats.length > 0) {
            (upsertedCats as DatabaseCategory[]).forEach((c) => catMap.set(c.slug, c.id));
            loadedCategories = upsertedCats as DatabaseCategory[];
          } else {
            loadedCategories = defaultCategories;
          }

          // Sync dishes
          const dishInserts: Array<{
            name: string;
            description: string;
            price: number;
            category_id: string | null;
            image_url: string | null;
            available: boolean;
            sort_order: number;
          }> = [];

          homeSections.forEach((sec, sIdx) => {
            const catId = catMap.get(sec.id) || null;
            sec.items.forEach((dish, dIdx) => {
              let priceNum = 250;
              if (typeof dish.price === "number") {
                priceNum = dish.price < 50 ? Math.round(dish.price * 50) : dish.price;
              } else if (typeof dish.price === "string") {
                const parsed = parseFloat(dish.price.replace(/[^\d.]/g, ""));
                if (!isNaN(parsed)) {
                  priceNum = parsed < 50 ? Math.round(parsed * 50) : Math.round(parsed);
                }
              }

              dishInserts.push({
                name: dish.name,
                description: dish.description,
                price: priceNum,
                category_id: catId,
                image_url: dish.image || null,
                available: true,
                sort_order: (sIdx + 1) * 10 + (dIdx + 1),
              });
            });
          });

          const { data: insertedItems } = await supabase
            .from("menu_items")
            .insert(dishInserts)
            .select();

          if (insertedItems && insertedItems.length > 0) {
            loadedItems = insertedItems as DatabaseMenuItem[];
          } else if (loadedItems.length === 0) {
            loadedItems = defaultItems;
          }
        } catch {
          // If remote insert fails (e.g. offline or permissions), display default home items
          if (loadedCategories.length === 0) loadedCategories = defaultCategories;
          if (loadedItems.length === 0) loadedItems = defaultItems;
        }
      }

      setCategories(loadedCategories);
      setItems(loadedItems);
    } catch (err: unknown) {
      console.error("Error loading admin data:", err);
      // Fallback to home page menu details so user always sees the complete menu
      setCategories(defaultCategories);
      setItems(defaultItems);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Delete Item
  async function handleDeleteItem(item: DatabaseMenuItem) {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
      if (error) {
        // If not found in remote database, still remove from local state
        console.warn("Delete error from remote:", error);
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(`"${item.name}" removed from menu`);
    } catch (err: unknown) {
      console.error("Error deleting item:", err);
      const message = err instanceof Error ? err.message : "Failed to delete item";
      toast.error(message);
    }
  }

  // Delete Category
  async function handleDeleteCategory(cat: DatabaseCategory) {
    const associatedItems = items.filter((i) => i.category_id === cat.id);
    const confirmMessage =
      associatedItems.length > 0
        ? `"${cat.name}" has ${associatedItems.length} dishes attached. Are you sure you want to delete this category?`
        : `Are you sure you want to delete category "${cat.name}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const { error } = await supabase.from("categories").delete().eq("id", cat.id);
      if (error) {
        console.warn("Category delete error:", error);
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success(`Category "${cat.name}" deleted`);
      loadData();
    } catch (err: unknown) {
      console.error("Error deleting category:", err);
      const message = err instanceof Error ? err.message : "Failed to delete category";
      toast.error(message);
    }
  }

  // Filtered menu items, ordered by sort_order
  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === "all" || item.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    return list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [items, searchQuery, selectedCategory]);

  // Categories sorted by sort_order
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [categories]);

  // Lookup map for category name
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(cat.id, cat.name);
      map.set(cat.slug, cat.name);
    });
    return map;
  }, [categories]);

  // Reorder dragging state
  const [draggingCatIdx, setDraggingCatIdx] = useState<number | null>(null);
  const [dragOverCatIdx, setDragOverCatIdx] = useState<number | null>(null);

  const [draggingItemIdx, setDraggingItemIdx] = useState<number | null>(null);
  const [dragOverItemIdx, setDragOverItemIdx] = useState<number | null>(null);

  // Direct state for active drag tooltip / visual feedback
  const [activeDragFeedback, setActiveDragFeedback] = useState<{
    name: string;
    targetPos: number;
  } | null>(null);

  const touchDragRef = useRef<{
    type: "item" | "category";
    fromIndex: number;
    lastOverIndex: number | null;
    pointerId?: number;
    touchId?: number;
    startY: number;
  } | null>(null);

  // Helper to scroll page smoothly during drag near edges
  function handleAutoScroll(clientY: number) {
    const edgeThreshold = 80;
    const windowHeight = window.innerHeight;
    if (clientY < edgeThreshold) {
      window.scrollBy({ top: -12, behavior: "instant" as ScrollBehavior });
    } else if (clientY > windowHeight - edgeThreshold) {
      window.scrollBy({ top: 12, behavior: "instant" as ScrollBehavior });
    }
  }

  // Handle reordering categories
  async function handleReorderCategories(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const current = [...sortedCategories];
    const [movedCat] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, movedCat);

    const reordered = current.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }));

    setCategories(reordered);
    toast.success(`Category "${movedCat.name}" reordered to position #${toIdx + 1}`);

    try {
      await persistCategoryOrder(reordered);
    } catch (err) {
      console.warn("Failed to persist category order:", err);
    }
  }

  // Handle reordering menu items
  async function handleReorderItems(fromFilteredIdx: number, toFilteredIdx: number) {
    if (fromFilteredIdx === toFilteredIdx || fromFilteredIdx < 0 || toFilteredIdx < 0) return;

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
    toast.success(`"${movedItem.name}" reordered to position #${toFilteredIdx + 1}`);

    try {
      await persistItemOrder(reordered);
    } catch (err) {
      console.warn("Failed to persist item order:", err);
    }
  }

  // Quick step helpers to move items/categories directly up or down by 1 position
  function moveItemStep(idx: number, direction: -1 | 1) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= filteredItems.length) return;
    handleReorderItems(idx, targetIdx);
  }

  function moveCategoryStep(idx: number, direction: -1 | 1) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    handleReorderCategories(idx, targetIdx);
  }

  // Determine target index from cursor/touch Y position across existing rendered rows
  function findTargetIndexByPosition(type: "item" | "category", clientY: number): number | null {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-drag-type="${type}"]`));
    if (rows.length === 0) return null;

    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const rawIdx = row.getAttribute("data-index");
        if (rawIdx !== null) {
          const idx = parseInt(rawIdx, 10);
          if (!isNaN(idx)) return idx;
        }
      }
    }

    // If clientY is above the first element
    const firstRect = rows[0].getBoundingClientRect();
    if (clientY < firstRect.top) {
      const rawIdx = rows[0].getAttribute("data-index");
      return rawIdx !== null ? parseInt(rawIdx, 10) : 0;
    }

    // If clientY is below the last element
    const lastRow = rows[rows.length - 1];
    const lastRect = lastRow.getBoundingClientRect();
    if (clientY > lastRect.bottom) {
      const rawIdx = lastRow.getAttribute("data-index");
      return rawIdx !== null ? parseInt(rawIdx, 10) : rows.length - 1;
    }

    return null;
  }

  // Unified Drag Handlers supporting Touch & Pointer events
  function handleReorderStart(
    e: React.PointerEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
    type: "item" | "category",
    index: number,
  ) {
    const clientY = "touches" in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;

    // Capture pointer if available for uninterrupted tracking even if finger leaves button
    if ("setPointerCapture" in e.currentTarget && "pointerId" in e) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
    }

    const pointerId = "pointerId" in e ? e.pointerId : undefined;
    const touchId = "touches" in e && e.touches[0] ? e.touches[0].identifier : undefined;

    touchDragRef.current = {
      type,
      fromIndex: index,
      lastOverIndex: index,
      startY: clientY,
      pointerId,
      touchId,
    };

    const itemName =
      type === "category"
        ? (sortedCategories[index]?.name ?? "Category")
        : (filteredItems[index]?.name ?? "Dish");

    setActiveDragFeedback({
      name: itemName,
      targetPos: index + 1,
    });

    if (type === "category") {
      setDraggingCatIdx(index);
      setDragOverCatIdx(index);
    } else {
      setDraggingItemIdx(index);
      setDragOverItemIdx(index);
    }
  }

  function handleReorderMove(
    e: React.PointerEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
    type: "item" | "category",
  ) {
    if (!touchDragRef.current || touchDragRef.current.type !== type) return;

    let clientY: number;
    let clientX: number;

    if ("touches" in e) {
      const matchTouch =
        Array.from(e.touches).find((t) => t.identifier === touchDragRef.current?.touchId) ??
        e.touches[0];
      if (!matchTouch) return;
      clientY = matchTouch.clientY;
      clientX = matchTouch.clientX;
    } else {
      clientY = e.clientY;
      clientX = e.clientX;
    }

    // Smooth auto scroll if dragged near edge
    handleAutoScroll(clientY);

    // 1. Precise bounding box lookup against visible rows
    const targetIdx = findTargetIndexByPosition(type, clientY);

    if (targetIdx !== null && targetIdx !== touchDragRef.current.lastOverIndex) {
      touchDragRef.current.lastOverIndex = targetIdx;
      setActiveDragFeedback((prev) => (prev ? { ...prev, targetPos: targetIdx + 1 } : null));
      if (type === "category") {
        setDragOverCatIdx(targetIdx);
      } else {
        setDragOverItemIdx(targetIdx);
      }
      return;
    }

    // 2. Fallback: displacement calculation
    if (targetIdx === null) {
      const deltaY = clientY - touchDragRef.current.startY;
      const approxRowHeight = 65;
      const steps = Math.trunc(deltaY / approxRowHeight);
      const maxIdx = type === "category" ? sortedCategories.length - 1 : filteredItems.length - 1;
      const fallbackIdx = Math.max(0, Math.min(maxIdx, touchDragRef.current.fromIndex + steps));

      if (fallbackIdx !== touchDragRef.current.lastOverIndex) {
        touchDragRef.current.lastOverIndex = fallbackIdx;
        setActiveDragFeedback((prev) => (prev ? { ...prev, targetPos: fallbackIdx + 1 } : null));
        if (type === "category") {
          setDragOverCatIdx(fallbackIdx);
        } else {
          setDragOverItemIdx(fallbackIdx);
        }
      }
    }
  }

  function handleReorderEnd(
    e: React.PointerEvent<HTMLElement> | React.TouchEvent<HTMLElement> | null,
    type: "item" | "category",
  ) {
    if (!touchDragRef.current) return;
    const { fromIndex, lastOverIndex, pointerId } = touchDragRef.current;
    touchDragRef.current = null;

    if (e && "releasePointerCapture" in e.currentTarget && pointerId !== undefined) {
      try {
        e.currentTarget.releasePointerCapture(pointerId);
      } catch {
        // Safe ignore
      }
    }

    setActiveDragFeedback(null);

    if (type === "category") {
      setDraggingCatIdx(null);
      setDragOverCatIdx(null);
      if (lastOverIndex !== null && fromIndex !== lastOverIndex) {
        handleReorderCategories(fromIndex, lastOverIndex);
      }
    } else {
      setDraggingItemIdx(null);
      setDragOverItemIdx(null);
      if (lastOverIndex !== null && fromIndex !== lastOverIndex) {
        handleReorderItems(fromIndex, lastOverIndex);
      }
    }
  }

  return (
    <div className="min-h-screen bg-background text-primary">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-xl bg-primary font-bold text-xs sm:text-sm text-primary-foreground shadow-xs">
              A
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="font-serif text-sm sm:text-base font-bold text-foreground truncate">
                  Halal Ali's
                </h1>
                <Badge
                  variant="outline"
                  className="border-gold/40 text-[9px] sm:text-[10px] text-gold px-1.5 py-0"
                >
                  Admin
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
                {session.user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to="/"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 sm:px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
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

      <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-8">
        {/* Only see total menu items & total category in first */}
        <div className="mb-4 sm:mb-6 grid grid-cols-2 gap-2.5 sm:gap-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Dishes</p>
              <div className="grid size-7 sm:size-10 place-items-center rounded-lg sm:rounded-xl bg-primary/10 text-primary">
                <UtensilsCrossed className="size-3.5 sm:size-5" />
              </div>
            </div>
            <p className="mt-1 sm:mt-2 font-serif text-xl sm:text-3xl font-bold text-foreground">
              {items.length}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground hidden xs:block">
              Dishes live on the restaurant menu
            </p>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-3 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Categories</p>
              <div className="grid size-7 sm:size-10 place-items-center rounded-lg sm:rounded-xl bg-primary/10 text-primary">
                <Layers className="size-3.5 sm:size-5" />
              </div>
            </div>
            <p className="mt-1 sm:mt-2 font-serif text-xl sm:text-3xl font-bold text-foreground">
              {categories.length}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground hidden xs:block">
              Sections organizing the dishes
            </p>
          </div>
        </div>

        {/* Navigation Tabs & Actions Bar: 100% visible on all devices */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex items-center gap-1 rounded-xl bg-muted/70 p-1 border border-border shadow-2xs">
            <button
              type="button"
              onClick={() => handleSelectTab("items")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "items"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UtensilsCrossed className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Items ({items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("categories")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "categories"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Categories ({categories.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab("special_offer")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "special_offer"
                  ? "bg-background text-gold shadow-xs ring-1 ring-gold/40 font-bold"
                  : "text-gold hover:text-gold hover:bg-gold/10"
              }`}
            >
              <Tag className="size-3.5 sm:size-4 shrink-0 text-gold" />
              <span className="truncate">Special Offer</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9 px-2.5 sm:px-3 gap-1 text-xs shrink-0"
              title="Refresh Data from Database"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline">Refresh</span>
            </Button>

            {activeTab === "items" && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemDialogOpen(true);
                }}
                className="h-9 gap-1.5 bg-primary text-xs font-medium flex-1 sm:flex-none justify-center"
              >
                <Plus className="size-4" />
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
                className="h-9 gap-1.5 bg-primary text-xs font-medium flex-1 sm:flex-none justify-center"
              >
                <Plus className="size-4" />
                <span>Add Category</span>
              </Button>
            )}
          </div>
        </div>

        {/* Reordering Guide Banner */}
        {(activeTab === "items" || activeTab === "categories") && (
          <div className="flex items-start sm:items-center gap-2.5 rounded-lg border border-gold/30 bg-gold/5 px-3.5 py-2.5 text-xs text-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded border border-gold/40 bg-background font-mono text-xs font-bold text-gold mt-0.5 sm:mt-0">
              =
            </span>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="font-semibold text-foreground">Reorder Items:</strong> Touch & drag
              the <strong className="font-mono text-foreground">=</strong> handle up or down on
              phone/tablet, or drag it on desktop. You can also tap the{" "}
              <strong className="text-foreground">▲ / ▼</strong> arrow buttons next to each{" "}
              {activeTab === "items" ? "dish" : "category"} to step one position up or down.
            </p>
          </div>
        )}

        {/* Active Floating Drag HUD for mobile & desktop feedback */}
        {activeDragFeedback && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-full border border-gold/60 bg-foreground/95 px-4 py-2.5 text-xs text-background shadow-xl backdrop-blur-md animate-in fade-in zoom-in duration-150">
            <span className="flex size-5 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-black font-mono">
              =
            </span>
            <span className="truncate max-w-[200px] font-medium text-white">
              {activeDragFeedback.name}
            </span>
            <span className="rounded bg-gold/20 px-2 py-0.5 font-mono text-[11px] font-bold text-gold">
              Position #{activeDragFeedback.targetPos}
            </span>
          </div>
        )}

        {/* TAB 1: MENU ITEMS */}
        {activeTab === "items" && (
          <div className="space-y-4">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes by name or category..."
                  className="h-9 pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-9 w-full sm:w-auto rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All Categories ({items.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Menu Items List / Table */}
            {loading && items.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
                <RefreshCw className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                <UtensilsCrossed className="mx-auto size-10 text-muted-foreground/50" />
                <h3 className="mt-3 font-serif text-lg font-semibold">
                  No items match your search
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting your search or category filter.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* MOBILE VIEW: Cards with 100% visible details and NO horizontal swiping */}
                <div className="space-y-3 md:hidden">
                  {filteredItems.map((item, idx) => {
                    const isDragging = draggingItemIdx === idx;
                    const isOver = dragOverItemIdx === idx;
                    const isDropTargetTop =
                      isOver && draggingItemIdx !== null && draggingItemIdx > idx;
                    const isDropTargetBottom =
                      isOver && draggingItemIdx !== null && draggingItemIdx < idx;

                    return (
                      <div
                        key={item.id}
                        data-index={idx}
                        data-drag-type="item"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverItemIdx !== idx) setDragOverItemIdx(idx);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggingItemIdx !== null && draggingItemIdx !== idx) {
                            handleReorderItems(draggingItemIdx, idx);
                          }
                          setDraggingItemIdx(null);
                          setDragOverItemIdx(null);
                        }}
                        className={`relative rounded-xl border border-border bg-card p-3.5 transition-all ${
                          isDragging ? "opacity-35 ring-2 ring-primary" : "hover:border-gold/40"
                        } ${isDropTargetTop ? "border-t-2 border-t-gold bg-gold/5" : ""} ${
                          isDropTargetBottom ? "border-b-2 border-b-gold bg-gold/5" : ""
                        }`}
                      >
                        {/* Single Row: Reorder Handle + Image + Details + Edit/Delete Actions */}
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          {/* Reorder Handle: Swipe '=' or tap arrows */}
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveItemStep(idx, -1);
                              }}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                              title="Move up 1 position"
                              aria-label={`Move ${item.name} up`}
                            >
                              <ChevronUp className="size-4" />
                            </button>

                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", String(idx));
                                setDraggingItemIdx(idx);
                              }}
                              onDragEnd={() => {
                                setDraggingItemIdx(null);
                                setDragOverItemIdx(null);
                              }}
                              onPointerDown={(e) => handleReorderStart(e, "item", idx)}
                              onPointerMove={(e) => handleReorderMove(e, "item")}
                              onPointerUp={(e) => handleReorderEnd(e, "item")}
                              onPointerCancel={(e) => handleReorderEnd(e, "item")}
                              onTouchStart={(e) => handleReorderStart(e, "item", idx)}
                              onTouchMove={(e) => handleReorderMove(e, "item")}
                              onTouchEnd={(e) => handleReorderEnd(e, "item")}
                              onTouchCancel={(e) => handleReorderEnd(e, "item")}
                              className="flex size-8 touch-none items-center justify-center rounded-md border border-border/80 bg-background font-mono text-base font-bold text-muted-foreground shadow-2xs hover:border-gold hover:text-gold active:border-gold active:bg-gold/20 cursor-grab active:cursor-grabbing select-none"
                              title="Drag '=' up/down to reorder, or tap arrows above/below"
                              aria-label={`Reorder ${item.name}`}
                            >
                              =
                            </div>

                            <button
                              type="button"
                              disabled={idx === filteredItems.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveItemStep(idx, 1);
                              }}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                              title="Move down 1 position"
                              aria-label={`Move ${item.name} down`}
                            >
                              <ChevronDown className="size-4" />
                            </button>

                            <span className="text-[10px] font-mono font-medium text-muted-foreground">
                              #{idx + 1}
                            </span>
                          </div>

                          {/* Thumbnail Image */}
                          <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="size-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="grid size-full place-items-center text-muted-foreground">
                                <ImageIcon className="size-4 opacity-40" />
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-foreground text-sm leading-snug truncate">
                              {item.name}
                            </h4>
                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gold text-xs shrink-0">
                                {formatPrice(item.price)}
                              </span>
                              <span className="text-muted-foreground text-[10px] shrink-0">•</span>
                              <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground truncate max-w-[110px]">
                                {item.category_id
                                  ? categoryMap.get(item.category_id) || "Category"
                                  : "Category"}
                              </span>
                            </div>
                          </div>

                          {/* Actions: Edit & Delete combined in top row */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item);
                                setItemDialogOpen(true);
                              }}
                              className="h-8 gap-1 px-2.5 text-xs font-medium"
                              title="Edit Dish"
                            >
                              <Edit2 className="size-3.5" />
                              <span className="hidden xs:inline">Edit</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                              title="Delete Dish"
                            >
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW: Full Wide Table */}
                <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                        <tr>
                          <th
                            className="w-12 px-3 py-3 text-center font-mono font-bold text-muted-foreground"
                            title="Reorder Handle"
                          >
                            =
                          </th>
                          <th className="px-4 py-3 sm:w-16">Image</th>
                          <th className="px-4 py-3">Dish Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Price (₹)</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredItems.map((item, idx) => {
                          const isDragging = draggingItemIdx === idx;
                          const isOver = dragOverItemIdx === idx;
                          const isDropTargetTop =
                            isOver && draggingItemIdx !== null && draggingItemIdx > idx;
                          const isDropTargetBottom =
                            isOver && draggingItemIdx !== null && draggingItemIdx < idx;

                          return (
                            <tr
                              key={item.id}
                              data-index={idx}
                              data-drag-type="item"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverItemIdx !== idx) setDragOverItemIdx(idx);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggingItemIdx !== null && draggingItemIdx !== idx) {
                                  handleReorderItems(draggingItemIdx, idx);
                                }
                                setDraggingItemIdx(null);
                                setDragOverItemIdx(null);
                              }}
                              className={`transition-colors ${
                                isDragging ? "opacity-35 bg-primary/10" : "hover:bg-muted/20"
                              } ${isDropTargetTop ? "border-t-2 border-gold bg-gold/5" : ""} ${
                                isDropTargetBottom ? "border-b-2 border-gold bg-gold/5" : ""
                              }`}
                            >
                              {/* Reorder Handle: '=' symbol & quick step buttons */}
                              <td className="w-16 px-2 py-3 text-center align-middle">
                                <div className="inline-flex items-center gap-1">
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

                                  <div
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData("text/plain", String(idx));
                                      setDraggingItemIdx(idx);
                                    }}
                                    onDragEnd={() => {
                                      setDraggingItemIdx(null);
                                      setDragOverItemIdx(null);
                                    }}
                                    onPointerDown={(e) => handleReorderStart(e, "item", idx)}
                                    onPointerMove={(e) => handleReorderMove(e, "item")}
                                    onPointerUp={(e) => handleReorderEnd(e, "item")}
                                    onPointerCancel={(e) => handleReorderEnd(e, "item")}
                                    onTouchStart={(e) => handleReorderStart(e, "item", idx)}
                                    onTouchMove={(e) => handleReorderMove(e, "item")}
                                    onTouchEnd={(e) => handleReorderEnd(e, "item")}
                                    onTouchCancel={(e) => handleReorderEnd(e, "item")}
                                    className="group/grab inline-flex size-7 touch-none items-center justify-center rounded-md border border-border/80 bg-background font-mono text-base font-bold text-muted-foreground shadow-2xs transition-all hover:border-gold/60 hover:bg-gold/10 hover:text-gold hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing select-none"
                                    title="Drag '=' up or down, or use ▲ / ▼ to reorder"
                                    aria-label={`Hold or swipe to reorder ${item.name}`}
                                  >
                                    =
                                  </div>
                                </div>
                              </td>

                              {/* Dish Image */}
                              <td className="px-4 py-3">
                                <div className="size-12 overflow-hidden rounded-lg border border-border bg-muted">
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="size-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="grid size-full place-items-center text-muted-foreground">
                                      <ImageIcon className="size-5 opacity-40" />
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Name */}
                              <td className="px-4 py-3 max-w-sm">
                                <p className="font-semibold text-foreground text-sm">{item.name}</p>
                              </td>

                              {/* Category Badge */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                  {item.category_id
                                    ? categoryMap.get(item.category_id) || "Category"
                                    : "Category"}
                                </span>
                              </td>

                              {/* Price */}
                              <td className="px-4 py-3 font-semibold text-gold text-sm whitespace-nowrap">
                                {formatPrice(item.price)}
                              </td>

                              {/* Edit / Delete Buttons */}
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setItemDialogOpen(true);
                                    }}
                                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Edit Dish"
                                  >
                                    <Edit2 className="size-3.5" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    title="Delete Dish"
                                  >
                                    <Trash2 className="size-3.5" />
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

        {/* TAB 2: CATEGORIES */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            {sortedCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                <Layers className="mx-auto size-10 text-muted-foreground/50" />
                <h3 className="mt-3 font-serif text-lg font-semibold">No categories yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click "Add Category" above to create your first section.
                </p>
              </div>
            ) : (
              <>
                {/* MOBILE VIEW: Clean Cards with all details visible without swiping */}
                <div className="space-y-3 md:hidden">
                  {sortedCategories.map((cat, idx) => {
                    const count = items.filter((i) => i.category_id === cat.id).length;
                    const isDragging = draggingCatIdx === idx;
                    const isOver = dragOverCatIdx === idx;
                    const isDropTargetTop =
                      isOver && draggingCatIdx !== null && draggingCatIdx > idx;
                    const isDropTargetBottom =
                      isOver && draggingCatIdx !== null && draggingCatIdx < idx;

                    return (
                      <div
                        key={cat.id}
                        data-index={idx}
                        data-drag-type="category"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverCatIdx !== idx) setDragOverCatIdx(idx);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggingCatIdx !== null && draggingCatIdx !== idx) {
                            handleReorderCategories(draggingCatIdx, idx);
                          }
                          setDraggingCatIdx(null);
                          setDragOverCatIdx(null);
                        }}
                        className={`rounded-xl border border-border bg-card p-3.5 transition-all ${
                          isDragging ? "opacity-35 ring-2 ring-primary" : "hover:border-gold/40"
                        } ${isDropTargetTop ? "border-t-2 border-t-gold bg-gold/5" : ""} ${
                          isDropTargetBottom ? "border-b-2 border-b-gold bg-gold/5" : ""
                        }`}
                      >
                        {/* Single Row: Reorder Handle + Category Details + Edit/Delete Actions */}
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          {/* Reorder Handle: Swipe '=' or tap arrows */}
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCategoryStep(idx, -1);
                              }}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                              title="Move up 1 position"
                              aria-label={`Move category ${cat.name} up`}
                            >
                              <ChevronUp className="size-4" />
                            </button>

                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", String(idx));
                                setDraggingCatIdx(idx);
                              }}
                              onDragEnd={() => {
                                setDraggingCatIdx(null);
                                setDragOverCatIdx(null);
                              }}
                              onPointerDown={(e) => handleReorderStart(e, "category", idx)}
                              onPointerMove={(e) => handleReorderMove(e, "category")}
                              onPointerUp={(e) => handleReorderEnd(e, "category")}
                              onPointerCancel={(e) => handleReorderEnd(e, "category")}
                              onTouchStart={(e) => handleReorderStart(e, "category", idx)}
                              onTouchMove={(e) => handleReorderMove(e, "category")}
                              onTouchEnd={(e) => handleReorderEnd(e, "category")}
                              onTouchCancel={(e) => handleReorderEnd(e, "category")}
                              className="flex size-8 touch-none items-center justify-center rounded-md border border-border/80 bg-background font-mono text-base font-bold text-muted-foreground shadow-2xs hover:border-gold hover:text-gold active:border-gold active:bg-gold/20 cursor-grab active:cursor-grabbing select-none"
                              title="Drag '=' up/down to reorder, or tap arrows above/below"
                              aria-label={`Reorder category ${cat.name}`}
                            >
                              =
                            </div>

                            <button
                              type="button"
                              disabled={idx === sortedCategories.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCategoryStep(idx, 1);
                              }}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-gold/15 hover:text-gold active:bg-gold/25 disabled:opacity-20 disabled:pointer-events-none touch-manipulation"
                              title="Move down 1 position"
                              aria-label={`Move category ${cat.name} down`}
                            >
                              <ChevronDown className="size-4" />
                            </button>

                            <span className="text-[10px] font-mono font-medium text-muted-foreground">
                              #{cat.sort_order}
                            </span>
                          </div>

                          {/* Category Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground text-sm truncate">
                                {cat.name}
                              </h4>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 shrink-0"
                              >
                                {count} {count === 1 ? "item" : "items"}
                              </Badge>
                            </div>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">
                              /{cat.slug}
                            </p>
                          </div>

                          {/* Actions: Edit & Delete combined in top row */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCategoryDialogOpen(true);
                              }}
                              className="h-8 gap-1 px-2.5 text-xs font-medium"
                              title="Edit Category"
                            >
                              <Edit2 className="size-3.5" />
                              <span className="hidden xs:inline">Edit</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCategory(cat)}
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                              title="Delete Category"
                            >
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW: Table */}
                <div className="hidden md:block rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                        <tr>
                          <th
                            className="w-12 px-3 py-3 text-center font-mono font-bold text-muted-foreground"
                            title="Reorder Handle"
                          >
                            =
                          </th>
                          <th className="px-4 py-3">Category Name</th>
                          <th className="px-4 py-3">URL Slug</th>
                          <th className="px-4 py-3">Display Order</th>
                          <th className="px-4 py-3">Items Count</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sortedCategories.map((cat, idx) => {
                          const count = items.filter((i) => i.category_id === cat.id).length;
                          const isDragging = draggingCatIdx === idx;
                          const isOver = dragOverCatIdx === idx;
                          const isDropTargetTop =
                            isOver && draggingCatIdx !== null && draggingCatIdx > idx;
                          const isDropTargetBottom =
                            isOver && draggingCatIdx !== null && draggingCatIdx < idx;

                          return (
                            <tr
                              key={cat.id}
                              data-index={idx}
                              data-drag-type="category"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverCatIdx !== idx) setDragOverCatIdx(idx);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggingCatIdx !== null && draggingCatIdx !== idx) {
                                  handleReorderCategories(draggingCatIdx, idx);
                                }
                                setDraggingCatIdx(null);
                                setDragOverCatIdx(null);
                              }}
                              className={`transition-colors ${
                                isDragging ? "opacity-35 bg-primary/10" : "hover:bg-muted/20"
                              } ${isDropTargetTop ? "border-t-2 border-gold bg-gold/5" : ""} ${
                                isDropTargetBottom ? "border-b-2 border-gold bg-gold/5" : ""
                              }`}
                            >
                              {/* Reorder Handle: '=' symbol & quick step buttons */}
                              <td className="w-16 px-2 py-3 text-center align-middle">
                                <div className="inline-flex items-center gap-1">
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

                                  <div
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData("text/plain", String(idx));
                                      setDraggingCatIdx(idx);
                                    }}
                                    onDragEnd={() => {
                                      setDraggingCatIdx(null);
                                      setDragOverCatIdx(null);
                                    }}
                                    onPointerDown={(e) => handleReorderStart(e, "category", idx)}
                                    onPointerMove={(e) => handleReorderMove(e, "category")}
                                    onPointerUp={(e) => handleReorderEnd(e, "category")}
                                    onPointerCancel={(e) => handleReorderEnd(e, "category")}
                                    onTouchStart={(e) => handleReorderStart(e, "category", idx)}
                                    onTouchMove={(e) => handleReorderMove(e, "category")}
                                    onTouchEnd={(e) => handleReorderEnd(e, "category")}
                                    onTouchCancel={(e) => handleReorderEnd(e, "category")}
                                    className="group/grab inline-flex size-7 touch-none items-center justify-center rounded-md border border-border/80 bg-background font-mono text-base font-bold text-muted-foreground shadow-2xs transition-all hover:border-gold/60 hover:bg-gold/10 hover:text-gold hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing select-none"
                                    title="Drag '=' up or down, or use ▲ / ▼ to reorder"
                                    aria-label={`Hold or swipe to reorder category ${cat.name}`}
                                  >
                                    =
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-foreground text-sm">
                                {cat.name}
                              </td>
                              <td className="px-4 py-3 font-mono text-muted-foreground">
                                {cat.slug}
                              </td>
                              <td className="px-4 py-3 font-mono text-muted-foreground font-semibold">
                                {cat.sort_order}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="secondary" className="text-[11px]">
                                  {count} {count === 1 ? "item" : "items"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCategory(cat);
                                      setCategoryDialogOpen(true);
                                    }}
                                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Edit Category"
                                  >
                                    <Edit2 className="size-3.5" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCategory(cat)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    title="Delete Category"
                                  >
                                    <Trash2 className="size-3.5" />
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
      </main>

      {/* Item Dialog */}
      <MenuItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        categories={categories}
        defaultCategoryId={selectedCategory !== "all" ? selectedCategory : undefined}
        onSaved={loadData}
      />

      {/* Category Dialog */}
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        onSaved={loadData}
      />
    </div>
  );
}
