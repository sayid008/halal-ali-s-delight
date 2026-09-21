import {
  supabase,
  isSupabaseConfigured,
  type DatabaseCategory,
  type DatabaseMenuItem,
} from "./supabase";
import type { MenuSection } from "@/data/menu";

export const CATEGORY_ORDER_KEY = "halal_ali_category_order";
export const ITEM_ORDER_KEY = "halal_ali_item_order";
export const MENU_ORDER_EVENT = "halal_ali_menu_order_updated";

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

  // 1. Save locally
  if (isStorageAvailable()) {
    try {
      const orderIdentifiers = updated.map((c) => c.slug || c.id);
      window.localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(orderIdentifiers));
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
      const updates = updated.map((cat) =>
        supabase.from("categories").update({ sort_order: cat.sort_order }).eq("id", cat.id),
      );
      await Promise.all(updates);
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

  // 1. Save locally
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
      const updates = updated.map((item) =>
        supabase.from("menu_items").update({ sort_order: item.sort_order }).eq("id", item.id),
      );
      await Promise.all(updates);
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
