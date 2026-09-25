import { useEffect, useState, useCallback } from "react";
import {
  supabase,
  isSupabaseConfigured,
  type DatabaseMenuItem,
  type DatabaseCategory,
  type MenuSectionWithItems,
  isShopCategory,
} from "@/lib/supabase";
import { getLocalMenuSnapshot, cacheLocalMenu, MENU_ORDER_EVENT } from "@/lib/menu-order";
import { menuSections } from "@/data/menu";

// Deterministic default menu for both Server-Side Rendering (SSR) and initial Client Hydration
const INITIAL_DEFAULT_SECTIONS: MenuSectionWithItems[] = menuSections.map((sec) => ({
  id: sec.id,
  title: sec.title,
  items: sec.items.map((item, idx) => ({
    id: `default-${sec.id}-${idx}`,
    name: item.name,
    description: item.description,
    price:
      typeof item.price === "number"
        ? item.price
        : Number(String(item.price).replace(/[^\d.]/g, "")) || 0,
    image_url: item.image ?? null,
    available: true,
    sort_order: (idx + 1) * 10,
  })),
}));

export function buildSectionsFromData(
  rawCategories: DatabaseCategory[],
  rawItems: DatabaseMenuItem[],
): MenuSectionWithItems[] {
  // Only databased categories that are not deleted and marked available
  const categories = rawCategories.filter((c) => !c.deleted_at && c.available !== false);
  // Only databased items that are not deleted and marked available
  const items = rawItems.filter((i) => !i.deleted_at && i.available !== false);

  if (categories.length === 0) return [];

  const sortedCategories = [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  // Categories eligible for food item distribution (all categories EXCEPT Shop)
  const eligibleCategories = sortedCategories.filter((c) => !isShopCategory(c));
  const distributionTargets = eligibleCategories.length > 0 ? eligibleCategories : sortedCategories;

  const matchedItemIds = new Set<string>();

  // Map each category to its section
  const sectionMap = new Map<string, MenuSectionWithItems>();
  sortedCategories.forEach((cat) => {
    sectionMap.set(cat.id, {
      id: cat.slug || cat.id,
      title: cat.name,
      items: [],
    });
  });

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

  // Step 1: Match items with explicit category assignments or tags
  items.forEach((item) => {
    // 1a. Check for embedded category tag in description: <!--cat:slug-->
    const catTagMatch = (item.description || "").match(/<!--cat:([a-zA-Z0-9_-]+)-->/);
    const taggedSlug = catTagMatch ? catTagMatch[1].toLowerCase().trim() : null;
    const cleanDescription = (item.description || "")
      .replace(/\s*<!--cat:[a-zA-Z0-9_-]+-->\s*/g, "")
      .trim();

    let matchedCat: DatabaseCategory | undefined;

    if (taggedSlug) {
      matchedCat = sortedCategories.find(
        (c) =>
          (c.slug && c.slug.toLowerCase().trim() === taggedSlug) ||
          c.id === taggedSlug ||
          (c.name && c.name.toLowerCase().trim() === taggedSlug),
      );
    }

    if (!matchedCat) {
      matchedCat = sortedCategories.find(
        (c) =>
          Boolean(item.category_id) &&
          (item.category_id === c.id ||
            item.category_id === c.slug ||
            (c.slug && item.category_id === `cat-${c.slug}`) ||
            (c.slug && item.category_id?.includes(c.slug)) ||
            (c.name && item.category_id?.toLowerCase() === c.name.toLowerCase())),
      );
    }

    if (!matchedCat && defaultDishCategoryMap[item.name.toLowerCase().trim()]) {
      const targetSlug = defaultDishCategoryMap[item.name.toLowerCase().trim()];
      matchedCat = sortedCategories.find(
        (c) =>
          c.slug === targetSlug ||
          c.id === targetSlug ||
          c.id === `cat-${targetSlug}` ||
          c.name.toLowerCase().includes(targetSlug),
      );
    }

    if (matchedCat) {
      matchedItemIds.add(item.id);
      const sec = sectionMap.get(matchedCat.id);
      if (sec) {
        sec.items.push({
          id: item.id,
          name: item.name,
          description: cleanDescription,
          price: Number(item.price),
          image_url: item.image_url,
          available: item.available !== false,
          sort_order: item.sort_order ?? 0,
        });
      }
    }
  });

  // Step 2: Unmatched active items placed in default category so no dishes are lost
  const unmatchedItems = items.filter((item) => !matchedItemIds.has(item.id));

  if (unmatchedItems.length > 0 && distributionTargets.length > 0) {
    const defaultTarget = distributionTargets[0];
    const sec = sectionMap.get(defaultTarget.id);
    if (sec) {
      unmatchedItems.forEach((item) => {
        const cleanDescription = (item.description || "")
          .replace(/\s*<!--cat:[a-zA-Z0-9_-]+-->\s*/g, "")
          .trim();
        sec.items.push({
          id: item.id,
          name: item.name,
          description: cleanDescription,
          price: Number(item.price),
          image_url: item.image_url,
          available: item.available !== false,
          sort_order: item.sort_order ?? 0,
        });
      });
    }
  }

  // Sort items within each section by sort_order
  const grouped: MenuSectionWithItems[] = [];
  sortedCategories.forEach((cat) => {
    const sec = sectionMap.get(cat.id);
    if (sec) {
      sec.items.sort((a, b) => a.sort_order - b.sort_order);
      grouped.push(sec);
    }
  });

  return grouped;
}

/**
 * Fetches fresh menu data directly from the Supabase database.
 * Used by route loaders (on home and menu pages) and components.
 */
export async function fetchPublicMenuFromDatabase(): Promise<MenuSectionWithItems[]> {
  if (isSupabaseConfigured) {
    try {
      const [catRes, itemRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
      ]);

      const dbCategories = (catRes.data as DatabaseCategory[]) || [];
      const dbItems = (itemRes.data as DatabaseMenuItem[]) || [];

      if (dbCategories.length > 0 || dbItems.length > 0) {
        const grouped = buildSectionsFromData(dbCategories, dbItems);
        if (grouped.length > 0) {
          cacheLocalMenu(dbCategories, dbItems);
          return grouped;
        }
      }
    } catch (err) {
      console.warn("Direct Supabase public menu fetch error:", err);
    }
  }

  const localSnapshot = getLocalMenuSnapshot();
  if (
    localSnapshot &&
    Array.isArray(localSnapshot.categories) &&
    localSnapshot.categories.length > 0
  ) {
    const grouped = buildSectionsFromData(localSnapshot.categories, localSnapshot.items || []);
    if (grouped.length > 0) {
      return grouped;
    }
  }

  return INITIAL_DEFAULT_SECTIONS;
}

export function usePublicMenu(initialSections?: MenuSectionWithItems[]) {
  // Initialize with loader/initial sections if provided, then cached local, then defaults
  const [sections, setSections] = useState<MenuSectionWithItems[]>(() => {
    if (initialSections && initialSections.length > 0) {
      return initialSections;
    }
    const local = getLocalMenuSnapshot();
    if (local && Array.isArray(local.categories) && local.categories.length > 0) {
      const grouped = buildSectionsFromData(local.categories, local.items || []);
      if (grouped.length > 0) return grouped;
    }
    return INITIAL_DEFAULT_SECTIONS;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    // 1. If Supabase is configured, fetch live from Supabase first
    if (isSupabaseConfigured) {
      try {
        const [catRes, itemRes] = await Promise.all([
          supabase.from("categories").select("*").order("sort_order", { ascending: true }),
          supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
        ]);

        const dbCategories = (catRes.data as DatabaseCategory[]) || [];
        const dbItems = (itemRes.data as DatabaseMenuItem[]) || [];

        if (dbCategories.length > 0 || dbItems.length > 0) {
          const grouped = buildSectionsFromData(dbCategories, dbItems);
          if (grouped.length > 0) {
            setSections(grouped);
          }
          cacheLocalMenu(dbCategories, dbItems);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Supabase public menu fetch notice:", err);
      }
    }

    // 2. Fallback to cached local snapshot of database
    const localSnapshot = getLocalMenuSnapshot();
    if (
      localSnapshot &&
      Array.isArray(localSnapshot.categories) &&
      localSnapshot.categories.length > 0
    ) {
      const grouped = buildSectionsFromData(localSnapshot.categories, localSnapshot.items || []);
      if (grouped.length > 0) {
        setSections(grouped);
      }
      setLoading(false);
      return;
    }

    setLoading(false);
  }, []);

  // Update immediately if initialSections changes (e.g. page navigation)
  useEffect(() => {
    if (initialSections && initialSections.length > 0) {
      setSections(initialSections);
    }
  }, [initialSections]);

  useEffect(() => {
    // Hydrate from local cache immediately on client mount
    const local = getLocalMenuSnapshot();
    if (local && Array.isArray(local.categories) && local.categories.length > 0) {
      const grouped = buildSectionsFromData(local.categories, local.items || []);
      if (grouped.length > 0) {
        setSections(grouped);
      }
    }

    // Immediately fetch fresh data from database
    fetchMenu();

    const handleUpdate = (e?: Event) => {
      if (e && "detail" in e && e.detail) {
        const detail = (e as CustomEvent).detail as {
          categories?: DatabaseCategory[];
          items?: DatabaseMenuItem[];
        };
        if (detail.categories && detail.items && Array.isArray(detail.categories)) {
          const grouped = buildSectionsFromData(detail.categories, detail.items);
          setSections(grouped);
          cacheLocalMenu(detail.categories, detail.items);
          return;
        }
      }
      fetchMenu();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchMenu();
      }
    };

    window.addEventListener(MENU_ORDER_EVENT, handleUpdate as EventListener);
    window.addEventListener("storage", handleUpdate as EventListener);
    window.addEventListener("focus", fetchMenu);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("halal_ali_menu_channel");
        bc.onmessage = (msgEvent) => {
          if (
            msgEvent.data &&
            typeof msgEvent.data === "object" &&
            msgEvent.data.categories &&
            msgEvent.data.items
          ) {
            const grouped = buildSectionsFromData(msgEvent.data.categories, msgEvent.data.items);
            setSections(grouped);
            cacheLocalMenu(msgEvent.data.categories, msgEvent.data.items);
            return;
          }
          fetchMenu();
        };
      } catch {
        // ignore broadcast channel creation errors
      }
    }

    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    if (isSupabaseConfigured) {
      try {
        realtimeChannel = supabase
          .channel("public-menu-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () =>
            fetchMenu(),
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () =>
            fetchMenu(),
          )
          .subscribe();
      } catch (err) {
        console.warn("Could not subscribe to Supabase Realtime:", err);
      }
    }

    const pollInterval = setInterval(() => {
      fetchMenu();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener(MENU_ORDER_EVENT, handleUpdate as EventListener);
      window.removeEventListener("storage", handleUpdate as EventListener);
      window.removeEventListener("focus", fetchMenu);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (bc) {
        bc.close();
      }
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [fetchMenu]);

  return { sections, loading, error };
}
