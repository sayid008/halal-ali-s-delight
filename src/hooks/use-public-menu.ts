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

function buildSectionsFromData(
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

  // Step 1: Match items with explicit category assignments
  items.forEach((item) => {
    let matchedCat = sortedCategories.find(
      (c) =>
        Boolean(item.category_id) &&
        (item.category_id === c.id ||
          item.category_id === c.slug ||
          (c.slug && item.category_id === `cat-${c.slug}`) ||
          (c.slug && item.category_id?.includes(c.slug)) ||
          (c.name && item.category_id?.toLowerCase() === c.name.toLowerCase())),
    );

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
          description: item.description ?? "",
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
        sec.items.push({
          id: item.id,
          name: item.name,
          description: item.description ?? "",
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

  // Return all active categories so admin changes reflect immediately
  return grouped;
}

export function usePublicMenu() {
  // Always initialize with [] on both SSR and client for 100% consistent initial hydration
  const [sections, setSections] = useState<MenuSectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    // 1. Primary: Fetch from live Supabase database if configured
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
          setSections(grouped);
          cacheLocalMenu(dbCategories, dbItems);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Error fetching menu from Supabase:", err);
      }
    }

    // 2. Fetch from server API database
    try {
      const res = await fetch("/api/menu", {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          categories?: DatabaseCategory[];
          items?: DatabaseMenuItem[];
        };
        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          const grouped = buildSectionsFromData(data.categories, data.items || []);
          setSections(grouped);
          cacheLocalMenu(data.categories, data.items || []);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore network error, fall through to alternatives
    }

    // 3. Fallback to cached local snapshot of database
    const localSnapshot = getLocalMenuSnapshot();
    if (
      localSnapshot &&
      Array.isArray(localSnapshot.categories) &&
      localSnapshot.categories.length > 0
    ) {
      const grouped = buildSectionsFromData(localSnapshot.categories, localSnapshot.items || []);
      setSections(grouped);
      setLoading(false);
      return;
    }

    // If database is completely empty, strictly return empty
    setSections([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 1. Immediately hydrate from local database snapshot on mount
    const local = getLocalMenuSnapshot();
    if (local && Array.isArray(local.categories) && local.categories.length > 0) {
      const grouped = buildSectionsFromData(local.categories, local.items || []);
      setSections(grouped);
      setLoading(false);
    }

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
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener(MENU_ORDER_EVENT, handleUpdate as EventListener);
      window.removeEventListener("storage", handleUpdate as EventListener);
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
