import { useEffect, useState, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  formatPrice,
  type DatabaseMenuItem,
  type DatabaseCategory,
} from "@/lib/supabase";
import { persistCategoryOrder, persistItemOrder, saveLocalMenuSnapshot } from "@/lib/menu-order";
import { MenuItemDialog } from "./menu-item-dialog";
import { CategoryDialog } from "./category-dialog";
import { SpecialOfferManager } from "./special-offer-manager";
import { TrashManager } from "./trash-manager";
import { getDaysRemaining, SUPABASE_TRASH_SQL } from "@/lib/trash";
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
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "active" | "inactive">("all");

  // Dialog States
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatabaseMenuItem | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DatabaseCategory | null>(null);

  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
  const [dbTableError, setDbTableError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  async function loadData() {
    setLoading(true);
    setDbTableError(null);
    try {
      const [catRes, itemRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
      ]);

      if (
        (catRes.error && catRes.error.message.includes("relation")) ||
        (itemRes.error && itemRes.error.message.includes("relation"))
      ) {
        setDbTableError(
          "Supabase tables ('categories' or 'menu_items') are not set up yet in your database.",
        );
      }

      let loadedCategories = (catRes.data as DatabaseCategory[]) || [];
      let loadedItems = (itemRes.data as DatabaseMenuItem[]) || [];

      // Auto-purge any items or categories older than 30 days
      const expiredItemIds = loadedItems
        .filter((i) => i.deleted_at && getDaysRemaining(i.deleted_at) <= 0)
        .map((i) => i.id);

      if (expiredItemIds.length > 0) {
        for (const id of expiredItemIds) {
          supabase.from("menu_items").delete().eq("id", id);
        }
        loadedItems = loadedItems.filter((i) => !expiredItemIds.includes(i.id));
      }

      const expiredCatIds = loadedCategories
        .filter((c) => c.deleted_at && getDaysRemaining(c.deleted_at) <= 0)
        .map((c) => c.id);

      if (expiredCatIds.length > 0) {
        for (const id of expiredCatIds) {
          supabase.from("categories").delete().eq("id", id);
        }
        loadedCategories = loadedCategories.filter((c) => !expiredCatIds.includes(c.id));
      }

      // If Supabase tables are completely empty on the very first initial load, seed them into the live database
      if (
        !hasInitialLoaded &&
        loadedCategories.length === 0 &&
        loadedItems.length === 0 &&
        !catRes.error &&
        !itemRes.error
      ) {
        try {
          // Sync categories to live Supabase DB
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

          // Sync dishes to live Supabase DB
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
          if (loadedCategories.length === 0) loadedCategories = defaultCategories;
          if (loadedItems.length === 0) loadedItems = defaultItems;
        }
      } else if (catRes.error || itemRes.error) {
        // Fallback only if database connection failed
        if (loadedCategories.length === 0) loadedCategories = defaultCategories;
        if (loadedItems.length === 0) loadedItems = defaultItems;
      }

      setCategories(loadedCategories);
      setItems(loadedItems);
      saveLocalMenuSnapshot(loadedCategories, loadedItems);
      setHasInitialLoaded(true);
    } catch (err: unknown) {
      console.error("Error loading admin data:", err);
      setCategories(defaultCategories);
      setItems(defaultItems);
      saveLocalMenuSnapshot(defaultCategories, defaultItems);
      setHasInitialLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Separate Active vs Trashed items
  const activeItems = useMemo(() => items.filter((i) => !i.deleted_at), [items]);
  const activeCategories = useMemo(() => categories.filter((c) => !c.deleted_at), [categories]);
  const trashedItems = useMemo(() => items.filter((i) => !!i.deleted_at), [items]);
  const trashedCategories = useMemo(() => categories.filter((c) => !!c.deleted_at), [categories]);

  // Toggle Dish Visibility (Active 👁️ vs Inactive 👁️‍🗨️)
  async function handleToggleItemVisibility(item: DatabaseMenuItem) {
    const nextVal = item.available === false ? true : false;
    const updatedItems = items.map((i) => (i.id === item.id ? { ...i, available: nextVal } : i));
    setItems(updatedItems);
    saveLocalMenuSnapshot(categories, updatedItems);

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
      toast.success(
        nextVal
          ? `"${item.name}" is now Active 👁️ (Visible on customer menu)`
          : `"${item.name}" is now Inactive 👁️‍🗨️ (Hidden from customer menu)`,
      );
    } catch (err: unknown) {
      console.error("Error toggling item visibility:", err);
      toast.error("Failed to update dish visibility in database");
    }
  }

  // Toggle Category Visibility (Active 👁️ vs Inactive 👁️‍🗨️)
  async function handleToggleCategoryVisibility(cat: DatabaseCategory) {
    const nextVal = cat.available === false ? true : false;
    const updatedCats = categories.map((c) => (c.id === cat.id ? { ...c, available: nextVal } : c));
    setCategories(updatedCats);
    saveLocalMenuSnapshot(updatedCats, items);

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
      toast.success(
        nextVal
          ? `Category "${cat.name}" is now Active 👁️ (Visible on customer menu)`
          : `Category "${cat.name}" is now Inactive 👁️‍🗨️ (Hidden from customer menu)`,
      );
    } catch (err: unknown) {
      console.error("Error toggling category visibility:", err);
      toast.error("Failed to update category visibility in database");
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

    try {
      let { error } = await supabase
        .from("menu_items")
        .update({ deleted_at: now, available: false })
        .eq("id", item.id);
      if (error || item.id.startsWith("dish-")) {
        const nameRes = await supabase
          .from("menu_items")
          .update({ deleted_at: now, available: false })
          .eq("name", item.name);
        if (!nameRes.error) error = null;
      }
      toast.success(`"${item.name}" moved to Trash (auto-purges in 30 days)`);
    } catch (err: unknown) {
      console.error("Error trashing item:", err);
      const message = err instanceof Error ? err.message : "Failed to move item to trash";
      toast.error(message);
    }
  }

  // Move Category to Trash (Soft Delete category and attached dishes)
  async function handleTrashCategory(cat: DatabaseCategory) {
    const associatedItems = activeItems.filter((i) => i.category_id === cat.id);
    const confirmMessage =
      associatedItems.length > 0
        ? `Move category "${cat.name}" and its ${associatedItems.length} dishes to Trash? They will be hidden from visitors and kept in Trash for 30 days.`
        : `Move category "${cat.name}" to Trash? It will be hidden from visitors and kept in Trash for 30 days.`;

    if (!window.confirm(confirmMessage)) return;

    const now = new Date().toISOString();
    const updatedCats = categories.map((c) => (c.id === cat.id ? { ...c, deleted_at: now } : c));
    const updatedItems = items.map((i) =>
      i.category_id === cat.id ? { ...i, deleted_at: now, available: false } : i,
    );
    setCategories(updatedCats);
    setItems(updatedItems);
    saveLocalMenuSnapshot(updatedCats, updatedItems);

    try {
      // 1. Mark category as trashed in Supabase
      let { error: catErr } = await supabase
        .from("categories")
        .update({ deleted_at: now })
        .eq("id", cat.id);
      if (catErr || cat.id.startsWith("cat-")) {
        const slugRes = await supabase
          .from("categories")
          .update({ deleted_at: now })
          .eq("slug", cat.slug);
        if (!slugRes.error) catErr = null;
      }

      // 2. Mark attached items as trashed
      if (associatedItems.length > 0) {
        await supabase
          .from("menu_items")
          .update({ deleted_at: now, available: false })
          .eq("category_id", cat.id);
      }

      toast.success(`Category "${cat.name}" moved to Trash`);
    } catch (err: unknown) {
      console.error("Error trashing category:", err);
      const message = err instanceof Error ? err.message : "Failed to move category to trash";
      toast.error(message);
    }
  }

  // Restore Item from Trash
  async function handleRestoreItem(item: DatabaseMenuItem) {
    const updatedItems = items.map((i) =>
      i.id === item.id ? { ...i, deleted_at: null, available: true } : i,
    );
    setItems(updatedItems);
    saveLocalMenuSnapshot(categories, updatedItems);

    try {
      let { error } = await supabase
        .from("menu_items")
        .update({ deleted_at: null, available: true })
        .eq("id", item.id);
      if (error || item.id.startsWith("dish-")) {
        const nameRes = await supabase
          .from("menu_items")
          .update({ deleted_at: null, available: true })
          .eq("name", item.name);
        if (!nameRes.error) error = null;
      }
      toast.success(`"${item.name}" restored to menu!`);
    } catch (err: unknown) {
      console.error("Error restoring item:", err);
      toast.error("Failed to restore item");
    }
  }

  // Restore Category from Trash
  async function handleRestoreCategory(cat: DatabaseCategory) {
    const updatedCats = categories.map((c) => (c.id === cat.id ? { ...c, deleted_at: null } : c));
    const updatedItems = items.map((i) =>
      i.category_id === cat.id ? { ...i, deleted_at: null, available: true } : i,
    );
    setCategories(updatedCats);
    setItems(updatedItems);
    saveLocalMenuSnapshot(updatedCats, updatedItems);

    try {
      let { error } = await supabase
        .from("categories")
        .update({ deleted_at: null })
        .eq("id", cat.id);
      if (error || cat.id.startsWith("cat-")) {
        const slugRes = await supabase
          .from("categories")
          .update({ deleted_at: null })
          .eq("slug", cat.slug);
        if (!slugRes.error) error = null;
      }

      // Also restore attached dishes
      await supabase
        .from("menu_items")
        .update({ deleted_at: null, available: true })
        .eq("category_id", cat.id);

      toast.success(`Category "${cat.name}" and attached dishes restored!`);
    } catch (err: unknown) {
      console.error("Error restoring category:", err);
      toast.error("Failed to restore category");
    }
  }

  // Permanently Delete Item
  async function handlePermanentDeleteItem(item: DatabaseMenuItem) {
    const updatedItems = items.filter((i) => i.id !== item.id);
    setItems(updatedItems);
    saveLocalMenuSnapshot(categories, updatedItems);

    try {
      const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
      if (error || item.id.startsWith("dish-")) {
        await supabase.from("menu_items").delete().eq("name", item.name);
      }
      toast.success(`"${item.name}" permanently deleted`);
    } catch (err: unknown) {
      console.error("Error permanently deleting item:", err);
      toast.error("Failed to permanently delete item");
    }
  }

  // Permanently Delete Category
  async function handlePermanentDeleteCategory(cat: DatabaseCategory) {
    const updatedCats = categories.filter((c) => c.id !== cat.id);
    const updatedItems = items.map((i) =>
      i.category_id === cat.id ? { ...i, category_id: null } : i,
    );
    setCategories(updatedCats);
    setItems(updatedItems);
    saveLocalMenuSnapshot(updatedCats, updatedItems);

    try {
      await supabase.from("menu_items").update({ category_id: null }).eq("category_id", cat.id);
      const { error } = await supabase.from("categories").delete().eq("id", cat.id);
      if (error || cat.id.startsWith("cat-")) {
        await supabase.from("categories").delete().eq("slug", cat.slug);
      }
      toast.success(`Category "${cat.name}" permanently deleted`);
    } catch (err: unknown) {
      console.error("Error permanently deleting category:", err);
      toast.error("Failed to permanently delete category");
    }
  }

  // Empty Entire Trash
  async function handleEmptyTrash() {
    try {
      // Hard delete trashed menu items
      await supabase.from("menu_items").delete().not("deleted_at", "is", null);

      // Unlink attached dishes from trashed categories
      for (const cat of trashedCategories) {
        await supabase.from("menu_items").update({ category_id: null }).eq("category_id", cat.id);
      }

      // Hard delete trashed categories
      await supabase.from("categories").delete().not("deleted_at", "is", null);

      setItems((prev) => prev.filter((i) => !i.deleted_at));
      setCategories((prev) => prev.filter((c) => !c.deleted_at));
      toast.success("Trash emptied permanently");
    } catch (err: unknown) {
      console.error("Error emptying trash:", err);
      toast.error("Failed to empty trash");
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

    const updatedItem: DatabaseMenuItem = {
      id: itemId,
      name: data.name,
      description: data.description,
      price: data.price,
      category_id: data.category_id,
      image_url: data.image_url,
      available: data.available,
      sort_order: data.sort_order || (items.length + 1) * 10,
      created_at: now,
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

    // Sync to Supabase in the background
    try {
      const isUUIDFormat = (str?: string | null): boolean =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

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

      if (isEditing && data.id && isUUIDFormat(data.id)) {
        await supabase.from("menu_items").update(dbPayload).eq("id", data.id);
      } else {
        const { data: inserted } = await supabase
          .from("menu_items")
          .insert(dbPayload)
          .select()
          .single();
        if (inserted?.id) {
          const finalItems = newItems.map((i) => (i.id === itemId ? { ...i, id: inserted.id } : i));
          setItems(finalItems);
          saveLocalMenuSnapshot(categories, finalItems);
        }
      }
    } catch (dbErr) {
      console.warn("Could not sync item to Supabase:", dbErr);
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

    const updatedCat: DatabaseCategory = {
      id: catId,
      name: data.name,
      slug: data.slug,
      sort_order: data.sort_order || (categories.length + 1) * 10,
      available: data.available,
      created_at: now,
      deleted_at: null,
    };

    let newCats: DatabaseCategory[];
    if (isEditing) {
      newCats = categories.map((c) => (c.id === data.id ? { ...c, ...updatedCat } : c));
    } else {
      newCats = [...categories, updatedCat];
    }

    setCategories(newCats);
    saveLocalMenuSnapshot(newCats, items);

    toast.success(
      isEditing ? `Category "${data.name}" updated!` : `Category "${data.name}" added!`,
    );

    // Sync to Supabase in the background
    try {
      const isUUIDFormat = (str?: string | null): boolean =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      const dbPayload = {
        name: data.name,
        slug: data.slug,
        sort_order: data.sort_order,
        available: data.available,
      };

      if (isEditing && data.id && isUUIDFormat(data.id)) {
        await supabase.from("categories").update(dbPayload).eq("id", data.id);
      } else {
        const { data: inserted } = await supabase
          .from("categories")
          .insert(dbPayload)
          .select()
          .single();
        if (inserted?.id) {
          const finalCats = newCats.map((c) => (c.id === catId ? { ...c, id: inserted.id } : c));
          setCategories(finalCats);
          saveLocalMenuSnapshot(finalCats, items);
        }
      }
    } catch (dbErr) {
      console.warn("Could not sync category to Supabase:", dbErr);
    }
  }

  // Filtered menu items, ordered by sort_order
  const filteredItems = useMemo(() => {
    const list = activeItems.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesCategory = true;
      if (selectedCategory === "all") {
        matchesCategory = true;
      } else if (selectedCategory === "uncategorized") {
        matchesCategory = !item.category_id;
      } else {
        matchesCategory = item.category_id === selectedCategory;
      }

      let matchesVisibility = true;
      if (visibilityFilter === "active") {
        matchesVisibility = item.available !== false;
      } else if (visibilityFilter === "inactive") {
        matchesVisibility = item.available === false;
      }

      return matchesSearch && matchesCategory && matchesVisibility;
    });

    return list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [activeItems, searchQuery, selectedCategory, visibilityFilter]);

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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-8 px-2.5 sm:px-3 gap-1 text-xs shrink-0"
              title="Refresh Data from Database"
            >
              <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline">Refresh</span>
            </Button>

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

        {/* Order Guide Banner */}
        {(activeTab === "items" || activeTab === "categories") && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-foreground">
            <span className="flex size-4 shrink-0 items-center justify-center rounded bg-gold/20 font-mono text-[10px] font-bold text-gold">
              ↑↓
            </span>
            <p className="text-muted-foreground text-[11px] leading-normal">
              <strong className="font-semibold text-foreground">Sort Order:</strong> Tap{" "}
              <strong className="text-foreground">▲</strong> (Up) or{" "}
              <strong className="text-foreground">▼</strong> (Down) next to any{" "}
              {activeTab === "items" ? "dish" : "category"} to adjust its menu order. Order updates
              are saved automatically.
            </p>
          </div>
        )}

        {/* TAB 1: MENU ITEMS */}
        {activeTab === "items" && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
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

              <div className="flex items-center gap-2">
                {/* Visibility Filter */}
                <select
                  value={visibilityFilter}
                  onChange={(e) =>
                    setVisibilityFilter(e.target.value as "all" | "active" | "inactive")
                  }
                  className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All Visibility ({activeItems.length})</option>
                  <option value="active">
                    👁️ Active ({activeItems.filter((i) => i.available !== false).length})
                  </option>
                  <option value="inactive">
                    👁️‍🗨️ Inactive ({activeItems.filter((i) => i.available === false).length})
                  </option>
                </select>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-auto"
                >
                  <option value="all">All Categories ({activeItems.length})</option>
                  {sortedCategories.map((cat) => {
                    const count = activeItems.filter((i) => i.category_id === cat.id).length;
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({count})
                      </option>
                    );
                  })}
                  {activeItems.some((i) => !i.category_id) && (
                    <option value="uncategorized">
                      Uncategorized ({activeItems.filter((i) => !i.category_id).length})
                    </option>
                  )}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-xs text-muted-foreground">
                <RefreshCw className="mx-auto size-6 animate-spin text-gold mb-2" />
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
                              title={`Click to mark ${item.available !== false ? "Inactive 👁️‍🗨️" : "Active 👁️"}`}
                            >
                              {item.available !== false ? (
                                <>
                                  <Eye className="size-2.5 text-emerald-500" />
                                  <span>Active 👁️</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="size-2.5 text-muted-foreground" />
                                  <span>Inactive 👁️‍🗨️</span>
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
                                title={`Click to toggle: currently ${item.available !== false ? "Active 👁️" : "Inactive 👁️‍🗨️"}`}
                              >
                                {item.available !== false ? (
                                  <>
                                    <Eye className="size-3 text-emerald-500" />
                                    <span>Active 👁️</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="size-3 text-muted-foreground" />
                                    <span>Inactive 👁️‍🗨️</span>
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
                                title={`Click to mark ${cat.available !== false ? "Inactive 👁️‍🗨️" : "Active 👁️"}`}
                              >
                                {cat.available !== false ? (
                                  <>
                                    <Eye className="size-2.5 text-emerald-500" />
                                    <span>Active 👁️</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="size-2.5 text-muted-foreground" />
                                    <span>Inactive 👁️‍🗨️</span>
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
                                {cat.name}
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
                                  title={`Click to toggle: currently ${cat.available !== false ? "Active 👁️" : "Inactive 👁️‍🗨️"}`}
                                >
                                  {cat.available !== false ? (
                                    <>
                                      <Eye className="size-3 text-emerald-500" />
                                      <span>Active 👁️</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="size-3 text-muted-foreground" />
                                      <span>Inactive 👁️‍🗨️</span>
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
        defaultCategoryId={selectedCategory !== "all" ? selectedCategory : undefined}
        onSave={handleSaveItem}
      />

      {/* Category Dialog */}
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        onSave={handleSaveCategory}
      />
    </div>
  );
}
