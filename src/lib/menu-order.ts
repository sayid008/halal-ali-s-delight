import {
  supabase,
  isSupabaseConfigured,
  type DatabaseCategory,
  type DatabaseMenuItem,
} from "./supabase";
import type { MenuSection } from "@/data/menu";

export const CATEGORY_ORDER_KEY = "halal_ali_category_order";
export const ITEM_ORDER_KEY = "halal_ali_item_order";
export const CATEGORIES_CACHE_KEY = "halal_ali_categories_cache";
export const ITEMS_CACHE_KEY = "halal_ali_items_cache";
export const MENU_ORDER_EVENT = "halal_ali_menu_order_updated";

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isUUID(str?: string | null): boolean {
  return Boolean(
    str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
  );
}

/**
 * Cache categories and items directly in local storage.
 */
export function cacheLocalMenu(categories: DatabaseCategory[], items: DatabaseMenuItem[]): void {
  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(categories));
      window.localStorage.setItem(ITEMS_CACHE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to write menu cache to localStorage:", e);
    }
  }
}

export function saveLocalMenuSnapshot(
  categories: DatabaseCategory[],
  items: DatabaseMenuItem[],
  source: string = "admin-panel",
  _options?: { skipServerFetch?: boolean },
): void {
  cacheLocalMenu(categories, items);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(MENU_ORDER_EVENT, {
        detail: { type: "snapshot", source, categories, items },
      }),
    );
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("halal_ali_menu_channel");
        bc.postMessage({ type: "snapshot_updated", source, categories, items });
        bc.close();
      } catch {
        // ignore channel errors
      }
    }
  }
}

/**
 * Helper to save changes made in admin panel locally & trigger UI updates
 */
export async function saveAdminMenuChangesToDatabase(
  categories: DatabaseCategory[],
  items: DatabaseMenuItem[],
): Promise<boolean> {
  saveLocalMenuSnapshot(categories, items);
  return true;
}

export function getLocalMenuSnapshot(): {
  categories: DatabaseCategory[];
  items: DatabaseMenuItem[];
} | null {
  if (!isStorageAvailable()) return null;
  try {
    const rawCats = window.localStorage.getItem(CATEGORIES_CACHE_KEY);
    const rawItems = window.localStorage.getItem(ITEMS_CACHE_KEY);
    if (!rawCats && !rawItems) return null;

    const categories = rawCats ? JSON.parse(rawCats) : [];
    const items = rawItems ? JSON.parse(rawItems) : [];
    if (
      Array.isArray(categories) &&
      Array.isArray(items) &&
      (categories.length > 0 || items.length > 0)
    ) {
      return { categories, items };
    }
    return null;
  } catch (err) {
    console.warn("Failed to read menu cache from localStorage:", err);
    return null;
  }
}

/**
 * Get saved category order list (array of slug or ID strings).
 */
export function getLocalCategoryOrder(): string[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(CATEGORY_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to read category order from localStorage:", err);
    return [];
  }
}

/**
 * Get saved item order map (map of item name or ID to sort order).
 */
export function getLocalItemOrderMap(): Record<string, number> {
  if (!isStorageAvailable()) return {};
  try {
    const raw = window.localStorage.getItem(ITEM_ORDER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn("Failed to read item order from localStorage:", err);
    return {};
  }
}

/**
 * Persist category order locally.
 */
export async function persistCategoryOrder(reorderedCategories: DatabaseCategory[]): Promise<void> {
  const updated = reorderedCategories.map((cat, idx) => ({
    ...cat,
    sort_order: idx + 1,
  }));

  if (isStorageAvailable()) {
    try {
      const orderIdentifiers = updated.map((c) => c.slug || c.id);
      window.localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(orderIdentifiers));
      const snapshot = getLocalMenuSnapshot();
      saveLocalMenuSnapshot(updated, snapshot?.items || []);
    } catch (e) {
      console.warn("Failed to write category order to localStorage:", e);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(MENU_ORDER_EVENT, {
        detail: { type: "categories", categories: updated },
      }),
    );
  }

  // Persist to Supabase if configured
  if (isSupabaseConfigured) {
    (async () => {
      try {
        for (const cat of updated) {
          const payload = {
            name: cat.name,
            slug: cat.slug || cat.id,
            sort_order: cat.sort_order,
            available: cat.available !== false,
          };

          if (cat.id && isUUID(cat.id)) {
            await supabase
              .from("categories")
              .update({ sort_order: cat.sort_order })
              .eq("id", cat.id);
          } else if (cat.slug) {
            await supabase
              .from("categories")
              .update({ sort_order: cat.sort_order })
              .eq("slug", cat.slug);
          }
        }
      } catch (err) {
        console.warn("Supabase category sort order sync error:", err);
      }
    })();
  }
}

/**
 * Persist menu item order locally.
 */
export async function persistItemOrder(reorderedItems: DatabaseMenuItem[]): Promise<void> {
  const updated = reorderedItems.map((item, idx) => ({
    ...item,
    sort_order: idx + 1,
  }));

  if (isStorageAvailable()) {
    try {
      const orderMap: Record<string, number> = {};
      updated.forEach((item, idx) => {
        orderMap[item.id] = idx + 1;
        if (item.name) {
          orderMap[item.name.toLowerCase().trim()] = idx + 1;
        }
      });
      window.localStorage.setItem(ITEM_ORDER_KEY, JSON.stringify(orderMap));
      const snapshot = getLocalMenuSnapshot();
      saveLocalMenuSnapshot(snapshot?.categories || [], updated);
    } catch (e) {
      console.warn("Failed to write item order to localStorage:", e);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(MENU_ORDER_EVENT, {
        detail: { type: "items", items: updated },
      }),
    );
  }

  // Persist to Supabase if configured
  if (isSupabaseConfigured) {
    (async () => {
      try {
        for (const item of updated) {
          if (item.id && isUUID(item.id)) {
            await supabase
              .from("menu_items")
              .update({ sort_order: item.sort_order })
              .eq("id", item.id);
          } else if (item.name) {
            await supabase
              .from("menu_items")
              .update({ sort_order: item.sort_order })
              .eq("name", item.name);
          }
        }
      } catch (err) {
        console.warn("Supabase item sort order sync error:", err);
      }
    })();
  }
}

/**
 * Apply local order to static fallback sections if needed.
 */
export function applyOrderToStaticSections(sections: MenuSection[]): MenuSection[] {
  const catOrder = getLocalCategoryOrder();
  const itemOrderMap = getLocalItemOrderMap();

  let sortedSections = [...sections];

  // Sort sections by saved category order
  if (catOrder.length > 0) {
    sortedSections.sort((a, b) => {
      const indexA = catOrder.indexOf(a.id);
      const indexB = catOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  }

  // Sort items inside each section
  if (Object.keys(itemOrderMap).length > 0) {
    sortedSections = sortedSections.map((sec) => {
      const sortedItems = [...sec.items].sort((a, b) => {
        const keyA = a.name.toLowerCase().trim();
        const keyB = b.name.toLowerCase().trim();
        const orderA = itemOrderMap[keyA] ?? 9999;
        const orderB = itemOrderMap[keyB] ?? 9999;
        return orderA - orderB;
      });
      return {
        ...sec,
        items: sortedItems,
      };
    });
  }

  return sortedSections;
}
