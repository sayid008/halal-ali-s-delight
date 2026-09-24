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

/**
 * Cache categories and items directly in local storage without triggering POST requests or loops.
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
  options?: { skipServerFetch?: boolean },
): void {
  cacheLocalMenu(categories, items);

  if (!options?.skipServerFetch && typeof fetch !== "undefined") {
    fetch("/api/menu", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categories, items }),
    }).catch(() => {
      // ignore network errors
    });
  }

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
 * Explicit helper to save any changes made in admin panel to persistent database & trigger UI updates
 */
export async function saveAdminMenuChangesToDatabase(
  categories: DatabaseCategory[],
  items: DatabaseMenuItem[],
): Promise<boolean> {
  saveLocalMenuSnapshot(categories, items);
  if (typeof fetch !== "undefined") {
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categories, items }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
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
 * Persist category order locally and remotely to Supabase.
 */
export async function persistCategoryOrder(reorderedCategories: DatabaseCategory[]): Promise<void> {
  const updated = reorderedCategories.map((cat, idx) => ({
    ...cat,
    sort_order: idx + 1,
  }));

  // 1. Save locally in category order key and snapshot cache
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

  // 2. Dispatch custom event for real-time customer website updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(MENU_ORDER_EVENT, {
        detail: { type: "categories", categories: updated },
      }),
    );
  }

  // 3. Persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const isUUID = (str?: string | null) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      for (const cat of updated) {
        const payload = {
          name: cat.name,
          slug: cat.slug || cat.id,
          sort_order: cat.sort_order,
          available: cat.available !== false,
        };

        if (cat.id && isUUID(cat.id)) {
          const { data: res } = await supabase
            .from("categories")
            .update({ sort_order: cat.sort_order })
            .eq("id", cat.id)
            .select();

          if (!res || res.length === 0) {
            await supabase.from("categories").upsert({ ...payload, id: cat.id });
          }
        } else if (cat.slug) {
          const { data: res } = await supabase
            .from("categories")
            .update({ sort_order: cat.sort_order })
            .eq("slug", cat.slug)
            .select();

          if (!res || res.length === 0) {
            await supabase.from("categories").upsert(payload, { onConflict: "slug" });
          }
        }
      }
    } catch (err) {
      console.warn("Supabase category sort order update error:", err);
    }
  }
}

/**
 * Persist menu item order locally and remotely to Supabase.
 */
export async function persistItemOrder(reorderedItems: DatabaseMenuItem[]): Promise<void> {
  const updated = reorderedItems.map((item, idx) => ({
    ...item,
    sort_order: idx + 1,
  }));

  // 1. Save locally in item order map and snapshot cache
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

  // 2. Dispatch custom event for real-time customer website updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(MENU_ORDER_EVENT, {
        detail: { type: "items", items: updated },
      }),
    );
  }

  // 3. Persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const isUUID = (str?: string | null) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      const snapshot = getLocalMenuSnapshot();

      for (const item of updated) {
        let dbCatId = item.category_id;
        if (dbCatId && !isUUID(dbCatId) && snapshot?.categories) {
          const matched = snapshot.categories.find(
            (c) => c.id === dbCatId || c.slug === dbCatId || c.name === dbCatId,
          );
          if (matched && isUUID(matched.id)) {
            dbCatId = matched.id;
          }
        }

        const payload = {
          name: item.name,
          description: item.description,
          price: Number(item.price) || 0,
          category_id: dbCatId && isUUID(dbCatId) ? dbCatId : null,
          image_url: item.image_url,
          available: item.available !== false,
          sort_order: item.sort_order,
        };

        if (item.id && isUUID(item.id)) {
          const { data: res } = await supabase
            .from("menu_items")
            .update({ sort_order: item.sort_order })
            .eq("id", item.id)
            .select();

          if (!res || res.length === 0) {
            await supabase.from("menu_items").upsert({ ...payload, id: item.id });
          }
        } else {
          const { data: res } = await supabase
            .from("menu_items")
            .update({ sort_order: item.sort_order })
            .eq("name", item.name)
            .select();

          if (!res || res.length === 0) {
            await supabase.from("menu_items").upsert(payload, { onConflict: "name" });
          }
        }
      }
    } catch (err) {
      console.warn("Supabase menu item sort order update error:", err);
    }
  }
}

/**
 * Apply local order to static fallback sections if Supabase is offline.
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
