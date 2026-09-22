import { useEffect, useState, useCallback } from "react";
import {
  supabase,
  isSupabaseConfigured,
  type DatabaseMenuItem,
  type DatabaseCategory,
  type MenuSectionWithItems,
} from "@/lib/supabase";
import { menuSections as staticSections } from "@/data/menu";
import { applyOrderToStaticSections, MENU_ORDER_EVENT } from "@/lib/menu-order";

export function usePublicMenu() {
  const [sections, setSections] = useState<MenuSectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    if (!isSupabaseConfigured) {
      // Offline / local fallback with custom sort order
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
      return;
    }

    try {
      const [catRes, itemRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("menu_items").select("*").order("sort_order", { ascending: true }),
      ]);

      if (catRes.error || itemRes.error) {
        throw new Error(catRes.error?.message || itemRes.error?.message || "Failed to load");
      }

      const categories = ((catRes.data as DatabaseCategory[]) || []).filter(
        (c) => !c.deleted_at && c.available !== false,
      );
      const items = ((itemRes.data as DatabaseMenuItem[]) || []).filter(
        (i) => i.available !== false && !i.deleted_at,
      );

      if (categories.length === 0) {
        // Fallback to static sections with local order
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
      } else {
        const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);

        const grouped: MenuSectionWithItems[] = sortedCategories.map((cat) => {
          const categoryItems = items
            .filter((item) => item.category_id === cat.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description ?? "",
              price: Number(item.price),
              image_url: item.image_url,
              available: item.available,
              sort_order: item.sort_order,
            }));

          return {
            id: cat.slug,
            title: cat.name,
            items: categoryItems,
          };
        });

        setSections(grouped);
      }
    } catch {
      // On error, fall back to ordered static sections
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
      setError("Could not load latest menu from database");
    } finally {
      setLoading(false);
    }
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
