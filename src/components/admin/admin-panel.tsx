import { useEffect, useState, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  formatPrice,
  type DatabaseMenuItem,
  type DatabaseCategory,
} from "@/lib/supabase";
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
  Sparkles,
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

  // Active Tab
  const [activeTab, setActiveTab] = useState<"items" | "categories" | "special_offer">("items");

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

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === "all" || item.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  // Lookup map for category name
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(cat.id, cat.name);
      map.set(cat.slug, cat.name);
    });
    return map;
  }, [categories]);

  return (
    <div className="min-h-screen bg-background text-primary">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-base font-bold text-foreground">
                  Halal Ali's Delight
                </h1>
                <Badge variant="outline" className="border-gold/40 text-[10px] text-gold">
                  Admin Panel
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Logged in as{" "}
                <span className="font-medium text-foreground">{session.user.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>Live Website</span>
              <ExternalLink className="size-3 text-muted-foreground" />
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Only see total menu items & total category in first */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Menu Items</p>
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UtensilsCrossed className="size-5" />
              </div>
            </div>
            <p className="mt-2 font-serif text-3xl font-bold text-foreground">{items.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Dishes live on the restaurant menu</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Categories</p>
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Layers className="size-5" />
              </div>
            </div>
            <p className="mt-2 font-serif text-3xl font-bold text-foreground">
              {categories.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Sections organizing the dishes</p>
          </div>
        </div>

        {/* Navigation Tabs & Actions Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 border-b border-border sm:border-0">
            <button
              onClick={() => setActiveTab("items")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === "items"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <UtensilsCrossed className="size-4" />
              <span>Menu Items ({items.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === "categories"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-4" />
              <span>Categories ({categories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("special_offer")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === "special_offer"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-4 text-gold" />
              <span>Special Offer / Combo Banner</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9 gap-1 text-xs"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {activeTab === "items" && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemDialogOpen(true);
                }}
                className="h-9 gap-1.5 bg-primary text-xs font-medium"
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
                className="h-9 gap-1.5 bg-primary text-xs font-medium"
              >
                <Plus className="size-4" />
                <span>Add Category</span>
              </Button>
            )}
          </div>
        </div>

        {/* TAB 1: MENU ITEMS */}
        {activeTab === "items" && (
          <div className="space-y-4">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes by name or description..."
                  className="h-9 pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 sm:w-16">Image</th>
                        <th className="px-4 py-3">Dish Name & Description</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Price (₹)</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-muted/20">
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

                          {/* Name & Description */}
                          <td className="px-4 py-3 max-w-sm">
                            <p className="font-semibold text-foreground text-sm">{item.name}</p>
                            {item.description && (
                              <p className="line-clamp-2 mt-0.5 text-xs text-muted-foreground">
                                {item.description}
                              </p>
                            )}
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CATEGORIES */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Category Name</th>
                      <th className="px-4 py-3">URL Slug</th>
                      <th className="px-4 py-3">Display Order</th>
                      <th className="px-4 py-3">Items Count</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No categories configured. Click "Add Category" to create one.
                        </td>
                      </tr>
                    ) : (
                      categories.map((cat) => {
                        const count = items.filter((i) => i.category_id === cat.id).length;
                        return (
                          <tr key={cat.id} className="transition-colors hover:bg-muted/20">
                            <td className="px-4 py-3 font-semibold text-foreground text-sm">
                              {cat.name}
                            </td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">
                              {cat.slug}
                            </td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
