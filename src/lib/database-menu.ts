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

export interface DatabaseSyncDiff {
  categoriesAdded: number;
  categoriesUpdated: number;
  categoriesDeleted: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsDeleted: number;
}

export interface DatabaseSyncResult {
  success: boolean;
  hasChanges: boolean;
  message: string;
  itemCount: number;
  categoryCount: number;
  diffSummary: DatabaseSyncDiff;
  freshCategories?: DatabaseCategory[];
  freshItems?: DatabaseMenuItem[];
}

export function isUUID(str?: string | null): boolean {
  return Boolean(
    str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim()),
  );
}

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

/**
 * Fetch the full menu directly from Supabase database (no API route).
 */
export async function fetchDatabaseMenu(): Promise<DatabaseResponse | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const [catRes, itemRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
    ]);

    if (catRes.error) throw catRes.error;
    if (itemRes.error) throw itemRes.error;

    const categories = (catRes.data as DatabaseCategory[]) || [];
    const items = (itemRes.data as DatabaseMenuItem[]) || [];

    return {
      success: true,
      categories,
      items,
      count: items.length,
      last_updated: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("Could not fetch database menu from Supabase:", err);
    return null;
  }
}

/**
 * Fetch current stats directly from Supabase database (no API route).
 */
export async function fetchDatabaseStats(): Promise<DatabaseStats | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const [catRes, itemRes] = await Promise.all([
      supabase.from("categories").select("id, available, deleted_at"),
      supabase.from("menu_items").select("id, available, deleted_at"),
    ]);

    const cats = catRes.data || [];
    const items = itemRes.data || [];
    const activeCats = cats.filter((c) => !c.deleted_at);
    const activeItems = items.filter((i) => !i.deleted_at);
    const availableItems = activeItems.filter((i) => i.available !== false);

    return {
      totalCategories: activeCats.length,
      totalItems: activeItems.length,
      availableItems: availableItems.length,
      lastUpdated: new Date().toISOString(),
      isHealthy: true,
    };
  } catch (err) {
    console.warn("Could not fetch database stats from Supabase:", err);
    return null;
  }
}

/**
 * Checks for changes between admin panel state and Supabase database,
 * and updates Supabase directly according to the admin panel changes.
 * No API endpoints are used.
 */
export async function checkChangesAndSyncToSupabase(
  adminCategories: DatabaseCategory[],
  adminItems: DatabaseMenuItem[],
): Promise<DatabaseSyncResult> {
  const diffSummary: DatabaseSyncDiff = {
    categoriesAdded: 0,
    categoriesUpdated: 0,
    categoriesDeleted: 0,
    itemsAdded: 0,
    itemsUpdated: 0,
    itemsDeleted: 0,
  };

  if (!isSupabaseConfigured) {
    saveLocalMenuSnapshot(adminCategories, adminItems);
    return {
      success: true,
      hasChanges: true,
      message: "Saved to local cache (Supabase credentials not configured)",
      itemCount: adminItems.length,
      categoryCount: adminCategories.length,
      diffSummary,
      freshCategories: adminCategories,
      freshItems: adminItems,
    };
  }

  try {
    // 1. Fetch current database state from Supabase to check for changes
    const [dbCatRes, dbItemRes] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("menu_items").select("*"),
    ]);

    if (dbCatRes.error) throw dbCatRes.error;
    if (dbItemRes.error) throw dbItemRes.error;

    const dbCategories = (dbCatRes.data as DatabaseCategory[]) || [];
    const dbItems = (dbItemRes.data as DatabaseMenuItem[]) || [];

    // Index DB categories
    const dbCatById = new Map<string, DatabaseCategory>();
    const dbCatBySlug = new Map<string, DatabaseCategory>();
    const dbCatByName = new Map<string, DatabaseCategory>();

    dbCategories.forEach((cat) => {
      if (cat.id) dbCatById.set(cat.id, cat);
      if (cat.slug) dbCatBySlug.set(cat.slug.toLowerCase().trim(), cat);
      if (cat.name) dbCatByName.set(cat.name.toLowerCase().trim(), cat);
    });

    // 2. Diff Categories
    const categoriesToInsert: DatabaseCategory[] = [];
    const categoriesToUpdate: Array<{ id: string; payload: Record<string, unknown> }> = [];

    const matchedDbCatIds = new Set<string>();

    for (const cat of adminCategories) {
      let matchedDbCat: DatabaseCategory | undefined;

      if (cat.id && isUUID(cat.id)) {
        matchedDbCat = dbCatById.get(cat.id);
      }
      if (!matchedDbCat && cat.slug) {
        matchedDbCat = dbCatBySlug.get(cat.slug.toLowerCase().trim());
      }
      if (!matchedDbCat && cat.name) {
        matchedDbCat = dbCatByName.get(cat.name.toLowerCase().trim());
      }

      if (matchedDbCat) {
        matchedDbCatIds.add(matchedDbCat.id);

        const nameChanged = matchedDbCat.name.trim() !== cat.name.trim();
        const slugChanged = (matchedDbCat.slug || "").trim() !== (cat.slug || "").trim();
        const sortChanged = Number(matchedDbCat.sort_order ?? 0) !== Number(cat.sort_order ?? 0);
        const availChanged =
          Boolean(matchedDbCat.available ?? true) !== Boolean(cat.available ?? true);
        const deletedChanged = Boolean(matchedDbCat.deleted_at) !== Boolean(cat.deleted_at);

        if (nameChanged || slugChanged || sortChanged || availChanged || deletedChanged) {
          categoriesToUpdate.push({
            id: matchedDbCat.id,
            payload: {
              name: cat.name.trim(),
              slug: cat.slug.trim(),
              sort_order: Number(cat.sort_order) || 0,
              available: cat.available !== false,
              deleted_at: cat.deleted_at || null,
            },
          });
        }
      } else {
        categoriesToInsert.push(cat);
      }
    }

    // Check for categories deleted/purged in admin
    const categoriesToDelete: string[] = [];
    for (const dbCat of dbCategories) {
      if (!matchedDbCatIds.has(dbCat.id) && !dbCat.deleted_at) {
        // Was removed or deleted in admin panel
        categoriesToDelete.push(dbCat.id);
      }
    }

    // 3. Apply Category changes to Supabase
    if (categoriesToInsert.length > 0) {
      const insertPayloads = categoriesToInsert.map((c) => ({
        name: c.name.trim(),
        slug: c.slug.trim() || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        sort_order: Number(c.sort_order) || 0,
        available: c.available !== false,
        deleted_at: c.deleted_at || null,
      }));

      const { data: insertedCats, error: insErr } = await supabase
        .from("categories")
        .insert(insertPayloads)
        .select();

      if (insErr) {
        console.warn("Category insert notice:", insErr);
      } else if (insertedCats) {
        diffSummary.categoriesAdded = insertedCats.length;
      }
    }

    if (categoriesToUpdate.length > 0) {
      const updatePromises = categoriesToUpdate.map((u) =>
        supabase.from("categories").update(u.payload).eq("id", u.id),
      );
      await Promise.allSettled(updatePromises);
      diffSummary.categoriesUpdated = categoriesToUpdate.length;
    }

    if (categoriesToDelete.length > 0) {
      const deletePromises = categoriesToDelete.map((id) =>
        supabase
          .from("categories")
          .update({ deleted_at: new Date().toISOString(), available: false })
          .eq("id", id),
      );
      await Promise.allSettled(deletePromises);
      diffSummary.categoriesDeleted = categoriesToDelete.length;
    }

    // 4. Fetch refreshed categories to ensure accurate UUID map for menu items foreign keys
    const { data: refreshedCats } = await supabase.from("categories").select("id, slug, name");
    const catUuidMap = new Map<string, string>();

    (refreshedCats || []).forEach((c: { id: string; slug: string; name: string }) => {
      if (c.id) {
        catUuidMap.set(c.id, c.id);
        if (c.slug) catUuidMap.set(c.slug.toLowerCase().trim(), c.id);
        if (c.name) catUuidMap.set(c.name.toLowerCase().trim(), c.id);
      }
    });

    // 5. Diff Menu Items
    const dbItemById = new Map<string, DatabaseMenuItem>();
    const dbItemByName = new Map<string, DatabaseMenuItem>();

    dbItems.forEach((item) => {
      if (item.id) dbItemById.set(item.id, item);
      if (item.name) dbItemByName.set(item.name.toLowerCase().trim(), item);
    });

    const itemsToInsert: Array<Record<string, unknown>> = [];
    const itemsToUpdate: Array<{ id: string; payload: Record<string, unknown> }> = [];
    const matchedDbItemIds = new Set<string>();

    for (const item of adminItems) {
      // Resolve target category UUID
      let targetCatUuid: string | null = null;
      if (item.category_id && catUuidMap.has(item.category_id)) {
        targetCatUuid = catUuidMap.get(item.category_id) || null;
      } else if (item.category_id && isUUID(item.category_id)) {
        targetCatUuid = item.category_id;
      } else {
        const fallbackSlug = defaultDishCategoryMap[item.name.toLowerCase().trim()];
        if (fallbackSlug && catUuidMap.has(fallbackSlug)) {
          targetCatUuid = catUuidMap.get(fallbackSlug) || null;
        }
      }

      let matchedDbItem: DatabaseMenuItem | undefined;
      if (item.id && isUUID(item.id)) {
        matchedDbItem = dbItemById.get(item.id);
      }
      if (!matchedDbItem && item.name) {
        matchedDbItem = dbItemByName.get(item.name.toLowerCase().trim());
      }

      const itemPayload = {
        name: item.name.trim(),
        description: item.description?.trim() || null,
        price: Number(item.price) || 0,
        category_id: targetCatUuid,
        image_url: item.image_url || null,
        available: item.available !== false,
        sort_order: Number(item.sort_order) || 0,
        deleted_at: item.deleted_at || null,
        updated_at: new Date().toISOString(),
      };

      if (matchedDbItem) {
        matchedDbItemIds.add(matchedDbItem.id);

        const nameChanged = matchedDbItem.name.trim() !== item.name.trim();
        const descChanged =
          (matchedDbItem.description?.trim() || "") !== (item.description?.trim() || "");
        const priceChanged = Math.abs(Number(matchedDbItem.price) - Number(item.price)) > 0.001;
        const catChanged = (matchedDbItem.category_id || null) !== (targetCatUuid || null);
        const imgChanged = (matchedDbItem.image_url || null) !== (item.image_url || null);
        const availChanged =
          Boolean(matchedDbItem.available ?? true) !== Boolean(item.available ?? true);
        const sortChanged = Number(matchedDbItem.sort_order ?? 0) !== Number(item.sort_order ?? 0);
        const deletedChanged = Boolean(matchedDbItem.deleted_at) !== Boolean(item.deleted_at);

        if (
          nameChanged ||
          descChanged ||
          priceChanged ||
          catChanged ||
          imgChanged ||
          availChanged ||
          sortChanged ||
          deletedChanged
        ) {
          itemsToUpdate.push({
            id: matchedDbItem.id,
            payload: itemPayload,
          });
        }
      } else {
        itemsToInsert.push(itemPayload);
      }
    }

    // Check for items purged/deleted in admin
    const itemsToDelete: string[] = [];
    for (const dbItem of dbItems) {
      if (!matchedDbItemIds.has(dbItem.id)) {
        itemsToDelete.push(dbItem.id);
      }
    }

    // 6. Apply Item changes to Supabase
    if (itemsToInsert.length > 0) {
      const { data: insertedItems, error: itemInsErr } = await supabase
        .from("menu_items")
        .insert(itemsToInsert)
        .select();

      if (itemInsErr) {
        console.warn("Item insert notice:", itemInsErr);
      } else if (insertedItems) {
        diffSummary.itemsAdded = insertedItems.length;
      }
    }

    if (itemsToUpdate.length > 0) {
      const updatePromises = itemsToUpdate.map((u) =>
        supabase.from("menu_items").update(u.payload).eq("id", u.id),
      );
      await Promise.allSettled(updatePromises);
      diffSummary.itemsUpdated = itemsToUpdate.length;
    }

    if (itemsToDelete.length > 0) {
      const deletePromises = itemsToDelete.map((id) =>
        supabase.from("menu_items").delete().eq("id", id),
      );
      await Promise.allSettled(deletePromises);
      diffSummary.itemsDeleted = itemsToDelete.length;
    }

    // 7. Fetch final up-to-date state from Supabase
    const [finalCatRes, finalItemRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
    ]);

    const freshCategories = (finalCatRes.data as DatabaseCategory[]) || adminCategories;
    const freshItems = (finalItemRes.data as DatabaseMenuItem[]) || adminItems;

    // Cache locally & broadcast instant updates
    saveLocalMenuSnapshot(freshCategories, freshItems, "supabase-sync");

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(MENU_ORDER_EVENT, {
          detail: { type: "database_stored", categories: freshCategories, items: freshItems },
        }),
      );
    }

    const totalChanges =
      diffSummary.categoriesAdded +
      diffSummary.categoriesUpdated +
      diffSummary.categoriesDeleted +
      diffSummary.itemsAdded +
      diffSummary.itemsUpdated +
      diffSummary.itemsDeleted;

    const summaryParts: string[] = [];
    if (diffSummary.itemsUpdated > 0)
      summaryParts.push(`${diffSummary.itemsUpdated} dishes updated`);
    if (diffSummary.itemsAdded > 0) summaryParts.push(`${diffSummary.itemsAdded} dishes added`);
    if (diffSummary.itemsDeleted > 0)
      summaryParts.push(`${diffSummary.itemsDeleted} dishes removed`);
    if (diffSummary.categoriesUpdated > 0)
      summaryParts.push(`${diffSummary.categoriesUpdated} categories updated`);
    if (diffSummary.categoriesAdded > 0)
      summaryParts.push(`${diffSummary.categoriesAdded} categories added`);
    if (diffSummary.categoriesDeleted > 0)
      summaryParts.push(`${diffSummary.categoriesDeleted} categories removed`);

    const message =
      totalChanges > 0
        ? `Database updated: ${summaryParts.join(", ")}`
        : "Database is already up to date — no changes detected.";

    return {
      success: true,
      hasChanges: totalChanges > 0,
      message,
      itemCount: freshItems.length,
      categoryCount: freshCategories.length,
      diffSummary,
      freshCategories,
      freshItems,
    };
  } catch (err: unknown) {
    console.error("Database sync error:", err);
    saveLocalMenuSnapshot(adminCategories, adminItems);
    const msg = err instanceof Error ? err.message : "Failed to sync changes to Supabase";
    return {
      success: false,
      hasChanges: false,
      message: msg,
      itemCount: adminItems.length,
      categoryCount: adminCategories.length,
      diffSummary,
      freshCategories: adminCategories,
      freshItems: adminItems,
    };
  }
}

/**
 * Stores all menu details to the Supabase database after checking for changes.
 * Used by batchSync and admin saving actions.
 */
export async function storeAllMenuDetailsToDatabase(
  categories: DatabaseCategory[],
  items: DatabaseMenuItem[],
): Promise<{
  success: boolean;
  message: string;
  itemCount: number;
  categoryCount: number;
  hasChanges?: boolean;
  freshCategories?: DatabaseCategory[];
  freshItems?: DatabaseMenuItem[];
}> {
  const result = await checkChangesAndSyncToSupabase(categories, items);
  return {
    success: result.success,
    hasChanges: result.hasChanges,
    message: result.message,
    itemCount: result.itemCount,
    categoryCount: result.categoryCount,
    freshCategories: result.freshCategories,
    freshItems: result.freshItems,
  };
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
