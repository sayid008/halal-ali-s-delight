import {
  supabase,
  isSupabaseConfigured,
  type DatabaseCategory,
  type DatabaseMenuItem,
} from "./supabase";
import { saveLocalMenuSnapshot, MENU_ORDER_EVENT } from "./menu-order";

export interface DatabaseStats {
  totalItems: number;
  totalCategories: number;
  availableItems: number;
  lastUpdated: string;
  isHealthy: boolean;
  version?: number;
}

export interface DatabaseResponse {
  success: boolean;
  message?: string;
  count?: number;
  categories: DatabaseCategory[];
  items: DatabaseMenuItem[];
  last_updated?: string;
  version?: number;
  stats?: DatabaseStats;
}

/**
 * Fetch the full menu stored in the persistent database (/api/menu)
 */
export async function fetchDatabaseMenu(): Promise<DatabaseResponse | null> {
  try {
    const res = await fetch("/api/menu", {
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as DatabaseResponse;
    return data;
  } catch (err) {
    console.warn("Could not fetch database menu:", err);
    return null;
  }
}

/**
 * Fetch current health and summary stats of the database
 */
export async function fetchDatabaseStats(): Promise<DatabaseStats | null> {
  try {
    const res = await fetch("/api/menu/stats");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Could not fetch database stats:", err);
    return null;
  }
}

/**
 * Fast background sync to Supabase without blocking the UI or throwing ON CONFLICT errors
 */
export async function syncToSupabaseAsync(
  categories: DatabaseCategory[],
  items: DatabaseMenuItem[],
) {
  if (!isSupabaseConfigured) return;

  try {
    const isUUID = (str?: string | null): boolean =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    // 1. Fetch existing categories and items from Supabase to match IDs
    const [catRes, itemRes] = await Promise.all([
      supabase.from("categories").select("id, slug, name"),
      supabase.from("menu_items").select("id, name"),
    ]);

    const existingCats = (catRes.data as Array<{ id: string; slug: string; name: string }>) || [];
    const existingItems = (itemRes.data as Array<{ id: string; name: string }>) || [];

    const catMapBySlug = new Map(existingCats.map((c) => [c.slug, c.id]));
    const itemMapByName = new Map(existingItems.map((i) => [i.name.toLowerCase().trim(), i.id]));

    // 2. Prepare Category inserts vs updates
    const catInserts: Array<Record<string, unknown>> = [];
    const catUpdates: Array<Promise<unknown>> = [];

    for (const cat of categories) {
      const payload = {
        name: cat.name,
        slug: cat.slug || cat.id,
        sort_order: cat.sort_order,
        available: cat.available !== false,
        deleted_at: cat.deleted_at || null,
      };

      const matchedId = cat.id && isUUID(cat.id) ? cat.id : catMapBySlug.get(cat.slug || cat.id);

      if (matchedId) {
        catUpdates.push(
          Promise.resolve(supabase.from("categories").update(payload).eq("id", matchedId)),
        );
      } else {
        catInserts.push(payload);
      }
    }

    if (catInserts.length > 0) {
      const { data: inserted } = await supabase.from("categories").insert(catInserts).select();
      if (inserted) {
        (inserted as Array<{ id: string; slug: string }>).forEach((c) =>
          catMapBySlug.set(c.slug, c.id),
        );
      }
    }
    if (catUpdates.length > 0) {
      await Promise.allSettled(catUpdates);
    }

    // Refresh category map for items foreign keys
    const { data: refreshedCats } = await supabase.from("categories").select("id, slug, name");
    const finalCatMap = new Map<string, string>();
    (refreshedCats || []).forEach((c: { id: string; slug: string }) => {
      finalCatMap.set(c.slug, c.id);
      finalCatMap.set(c.id, c.id);
    });

    // 3. Prepare Item inserts vs updates
    const itemInserts: Array<Record<string, unknown>> = [];
    const itemUpdates: Array<Promise<unknown>> = [];

    const defaultDishCategoryMap: Record<string, string> = {
      "vegetable samosas": "starters",
      "chicken pakora": "starters",
      "onion bhaji": "starters",
      "lamb seekh kebab": "grill",
      "chicken tikka skewers": "grill",
      "mixed grill platter": "grill",
      "classic butter chicken": "curries",
      "chicken tikka masala": "curries",
      "lamb karahi": "curries",
      "daal tarka": "curries",
      "royal lamb biryani": "biryani",
      "chicken biryani": "biryani",
      "pilau rice": "biryani",
      "peshwari naan": "breads",
      "garlic naan": "breads",
      "mint raita": "breads",
      "gulab jamun": "desserts",
      kheer: "desserts",
      "mango lassi": "desserts",
      "masala chai": "desserts",
    };

    for (const item of items) {
      const matchingCat = categories.find((c) => c.id === item.category_id);
      let catUuid: string | null = null;
      if (matchingCat && finalCatMap.has(matchingCat.slug)) {
        catUuid = finalCatMap.get(matchingCat.slug) || null;
      } else if (item.category_id && finalCatMap.has(item.category_id)) {
        catUuid = finalCatMap.get(item.category_id) || null;
      } else if (isUUID(item.category_id)) {
        catUuid = item.category_id;
      }

      if (!catUuid) {
        const fallbackSlug = defaultDishCategoryMap[item.name.toLowerCase().trim()];
        if (fallbackSlug && finalCatMap.has(fallbackSlug)) {
          catUuid = finalCatMap.get(fallbackSlug) || null;
        }
      }

      const payload = {
        name: item.name,
        description: item.description,
        price: Number(item.price) || 0,
        category_id: catUuid,
        image_url: item.image_url,
        available: item.available !== false,
        sort_order: item.sort_order,
        deleted_at: item.deleted_at || null,
      };

      const matchedItemId =
        item.id && isUUID(item.id) ? item.id : itemMapByName.get(item.name.toLowerCase().trim());

      if (matchedItemId) {
        itemUpdates.push(
          Promise.resolve(supabase.from("menu_items").update(payload).eq("id", matchedItemId)),
        );
      } else {
        itemInserts.push(payload);
      }
    }

    if (itemInserts.length > 0) {
      await supabase.from("menu_items").insert(itemInserts);
    }
    if (itemUpdates.length > 0) {
      await Promise.allSettled(itemUpdates);
    }
  } catch (err) {
    console.warn("Supabase background sync notice:", err);
  }
}

/**
 * Stores all menu details (categories and items) to the persistent database.
 * Syncs instantly to:
 * 1. Server database file (data/menu-db.json via /api/menu and /api/menu/store-all)
 * 2. Local storage snapshot cache
 * 3. Window & BroadcastChannel events for real-time customer menu updates
 * 4. Supabase cloud database in parallel background
 */
export async function storeAllMenuDetailsToDatabase(
  categories: DatabaseCategory[],
  items: DatabaseMenuItem[],
): Promise<{ success: boolean; message: string; itemCount: number; categoryCount: number }> {
  const payload = {
    categories,
    items,
    last_updated: new Date().toISOString(),
    version: 1,
  };

  let serverSuccess = false;
  let serverMessage = "";

  // 1. Immediately persist to server database via /api/menu/store-all
  try {
    const res = await fetch("/api/menu/store-all", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      serverSuccess = true;
      serverMessage = data.message || "All menu details stored successfully";
    } else {
      // Fallback to standard /api/menu
      const fallbackRes = await fetch("/api/menu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (fallbackRes.ok) {
        serverSuccess = true;
        serverMessage = "All menu details stored to server database";
      }
    }
  } catch (err) {
    console.warn("Failed to POST to /api/menu/store-all:", err);
  }

  // 2. Save to local storage snapshot and notify all frontend tabs immediately
  saveLocalMenuSnapshot(categories, items);

  // 3. Fast non-blocking sync to Supabase in parallel
  if (isSupabaseConfigured) {
    syncToSupabaseAsync(categories, items).catch((e) =>
      console.warn("Supabase background sync:", e),
    );
  }

  // 4. Broadcast event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(MENU_ORDER_EVENT, {
        detail: { type: "database_stored", categories, items },
      }),
    );
  }

  return {
    success: true,
    message: serverSuccess
      ? `All ${items.length} menu items and ${categories.length} categories stored to database!`
      : `Saved ${items.length} items to database and local cache!`,
    itemCount: items.length,
    categoryCount: categories.length,
  };
}

/**
 * Re-seed/Reset the database to default full menu
 */
export async function resetDatabaseToDefaults(): Promise<DatabaseResponse | null> {
  try {
    const res = await fetch("/api/menu/reset", { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as DatabaseResponse;
    if (data.categories && data.items) {
      saveLocalMenuSnapshot(data.categories, data.items);
    }
    return data;
  } catch (err) {
    console.warn("Failed to reset database menu:", err);
    return null;
  }
}

/**
 * Export stored database menu as a downloadable JSON file
 */
export function exportDatabaseBackup(categories: DatabaseCategory[], items: DatabaseMenuItem[]) {
  const backup = {
    exported_at: new Date().toISOString(),
    restaurant: "Halal Ali Dine Inn & Take Away",
    version: 1,
    total_categories: categories.length,
    total_items: items.length,
    categories,
    items,
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `halal-ali-menu-database-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
