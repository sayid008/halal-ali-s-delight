import { useEffect, useState, useCallback } from "react";
import {
  supabase,
  isSupabaseConfigured,
  type DatabaseMenuItem,
  type DatabaseCategory,
  type MenuSectionWithItems,
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

  const sortedCategories = [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const grouped: MenuSectionWithItems[] = sortedCategories
    .map((cat) => {
      const categoryItems = items
        .filter(
          (item) =>
            item.category_id === cat.id ||
            item.category_id === cat.slug ||
            (cat.slug && item.category_id?.includes(cat.slug)) ||
            (cat.name && item.category_id?.toLowerCase() === cat.name.toLowerCase()),
        )
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? "",
          price: Number(item.price),
          image_url: item.image_url,
          available: item.available !== false,
          sort_order: item.sort_order ?? 0,
        }));

      return {
        id: cat.slug || cat.id,
        title: cat.name,
        items: categoryItems,
      };
    })
    .filter((sec) => sec.items.length > 0);

  return grouped;
}

export function usePublicMenu() {
  const [sections, setSections] = useState<MenuSectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    // 1. Try fetching from live Supabase database
    if (isSupabaseConfigured) {
      try {
        const [catRes, itemRes] = await Promise.all([
          supabase.from("categories").select("*").order("sort_order", { ascending: true }),
          supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
        ]);

        const dbCategories = (catRes.data as DatabaseCategory[]) || [];
        const dbItems = (itemRes.data as DatabaseMenuItem[]) || [];

        if (dbCategories.length > 0 && dbItems.length > 0) {
          const grouped = buildSectionsFromData(dbCategories, dbItems);
          setSections(grouped);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Error fetching menu from Supabase, checking local cache:", err);
      }
    }

    // 2. Fallback to Local Storage Admin snapshot if available
    const localSnapshot = getLocalMenuSnapshot();
    if (localSnapshot && localSnapshot.categories.length > 0 && localSnapshot.items.length > 0) {
      const grouped = buildSectionsFromData(localSnapshot.categories, localSnapshot.items);
      if (grouped.length > 0) {
        setSections(grouped);
        setLoading(false);
        return;
      }
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

    const handleUpdate = () => {
      fetchMenu();
    };

    window.addEventListener(MENU_ORDER_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(MENU_ORDER_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [fetchMenu]);

  return { sections, loading, error };
}
