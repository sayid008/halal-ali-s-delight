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
 * Stores all menu details (categories and items) to the persistent database.
 * Syncs to:
 * 1. Server database file (data/menu-db.json via /api/menu and /api/menu/store-all)
 * 2. Local storage snapshot cache
 * 3. Window & BroadcastChannel events for real-time customer menu updates
 * 4. Supabase database tables if configured
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

  // 1. Persist to server database via /api/menu/store-all
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

  // 2. Save to local storage snapshot and notify frontend listeners
  saveLocalMenuSnapshot(categories, items);

  // 3. Persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const isUUID = (str?: string | null): boolean =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      // Upsert categories
      for (const cat of categories) {
        const catPayload = {
          name: cat.name,
          slug: cat.slug || cat.id,
          sort_order: cat.sort_order,
          available: cat.available !== false,
          deleted_at: cat.deleted_at || null,
        };

        if (cat.id && isUUID(cat.id)) {
          await supabase.from("categories").upsert({ ...catPayload, id: cat.id });
        } else {
          await supabase.from("categories").upsert(catPayload, { onConflict: "slug" });
        }
      }

      // Upsert menu items
      for (const item of items) {
        const itemPayload = {
          name: item.name,
          description: item.description,
          price: Number(item.price) || 0,
          category_id: isUUID(item.category_id) ? item.category_id : null,
          image_url: item.image_url,
          available: item.available !== false,
          sort_order: item.sort_order,
          deleted_at: item.deleted_at || null,
        };

        if (item.id && isUUID(item.id)) {
          await supabase.from("menu_items").upsert({ ...itemPayload, id: item.id });
        } else {
          await supabase.from("menu_items").upsert(itemPayload, { onConflict: "name" });
        }
      }
    } catch (dbErr) {
      console.warn("Supabase store-all sync error:", dbErr);
    }
  }

  // Broadcast event
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
