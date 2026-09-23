import { useEffect, useState, useCallback } from "react";
import {
  supabase,
  isSupabaseConfigured,
  type DatabaseMenuItem,
  type DatabaseCategory,
  type MenuSectionWithItems,
  isShopCategory,
} from "@/lib/supabase";
import { menuSections as staticSections } from "@/data/menu";
import {
  applyOrderToStaticSections,
  getLocalMenuSnapshot,
  MENU_ORDER_EVENT,
} from "@/lib/menu-order";

function buildSectionsFromData(
  rawCategories: DatabaseCategory[],
  rawItems: DatabaseMenuItem[],
): MenuSectionWithItems[] {
  const categories = rawCategories.filter((c) => !c.deleted_at && c.available !== false);
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

  // Step 1: Match items with explicit category assignments
  items.forEach((item) => {
    const matchedCat = sortedCategories.find(
      (c) =>
        item.category_id === c.id ||
        item.category_id === c.slug ||
        (c.slug && item.category_id === `cat-${c.slug}`) ||
        (c.slug && item.category_id?.includes(c.slug)) ||
        (c.name && item.category_id?.toLowerCase() === c.name.toLowerCase()),
    );

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

  // Step 2: Unmatched items (null category_id, broken UUID, or unrecognized category)
  const unmatchedItems = items.filter((item) => !matchedItemIds.has(item.id));

  // Place unmatched items into the first category if available without distributing across categories
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

  return grouped;
}

function getInitialSections(): MenuSectionWithItems[] {
  // Always initialize with raw static sections for identical SSR & client hydration
  return staticSections.map((sec, secIdx) => ({
    id: sec.id,
    title: sec.title,
    items: sec.items.map((item, itemIdx) => ({
      id: `static-${sec.id}-${itemIdx}`,
      name: item.name,
      description: item.description,
      price: typeof item.price === "number" ? item.price : 250,
      image_url: item.image ?? null,
      available: true,
      sort_order: (secIdx + 1) * 100 + (itemIdx + 1),
    })),
  }));
}

export function usePublicMenu() {
  const [sections, setSections] = useState<MenuSectionWithItems[]>(getInitialSections);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    // 1. Try fetching from live Supabase database first so all users see database changes immediately
    if (isSupabaseConfigured) {
      try {
        const [catRes, itemRes] = await Promise.all([
          supabase
            .from("menu_categories")
            .select("*")
            .is("deleted_at", null)
            .eq("available", true)
            .order("sort_order", { ascending: true }),
          supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
        ]);

        const dbCategories = (catRes.data as DatabaseCategory[]) || [];
        const dbItems = (itemRes.data as DatabaseMenuItem[]) || [];

        if (dbCategories.length > 0) {
          const grouped = buildSectionsFromData(dbCategories, dbItems);
          setSections(grouped);
          saveLocalMenuSnapshot(dbCategories, dbItems);
          setLoading(false);
          return;
        } else if (dbItems.length > 0) {
          const fallbackCats: DatabaseCategory[] = staticSections.map((sec, idx) => ({
            id: `cat-${sec.id}`,
            name: sec.title,
            slug: sec.id,
            sort_order: idx + 1,
            created_at: new Date().toISOString(),
          }));
          const grouped = buildSectionsFromData(fallbackCats, dbItems);
          setSections(grouped);
          saveLocalMenuSnapshot(fallbackCats, dbItems);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Error fetching menu from Supabase:", err);
      }
    }

    // 2. Try fetching from server API database
    try {
      const res = await fetch("/api/menu");
      if (res.ok) {
        const data = (await res.json()) as {
          categories?: DatabaseCategory[];
          items?: DatabaseMenuItem[];
        };
        if (data.categories && data.categories.length > 0) {
          const grouped = buildSectionsFromData(data.categories, data.items || []);
          setSections(grouped);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore network error
    }

    // 3. Check Local Storage snapshot if Supabase and server API are offline or empty
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

    // 3. Final fallback to ordered static sections
    const orderedStatic = applyOrderToStaticSections(staticSections);
    setSections(
      orderedStatic.map((sec, secIdx) => ({
        id: sec.id,
        title: sec.title,
        items: sec.items.map((item, itemIdx) => ({
          id: `static-${sec.id}-${itemIdx}`,
          name: item.name,
          description: item.description,
          price: typeof item.price === "number" ? item.price : 250,
          image_url: item.image ?? null,
          available: true,
          sort_order: (secIdx + 1) * 100 + (itemIdx + 1),
        })),
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
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
          .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories" }, () =>
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

    return () => {
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
