import { useEffect, useState } from "react";
import { supabase, type DatabaseMenuItem, type DatabaseCategory, type MenuSectionWithItems } from "@/lib/supabase";

export function usePublicMenu() {
  const [sections, setSections] = useState<MenuSectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchMenu() {
      const [catRes, itemRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("menu_items").select("*").order("sort_order"),
      ]);

      if (!mounted) return;

      if (catRes.error || itemRes.error) {
        setError("Could not load menu");
        setLoading(false);
        return;
      }

      const categories = catRes.data as DatabaseCategory[];
      const items = (itemRes.data as DatabaseMenuItem[]).filter((i) => i.available);

      const grouped: MenuSectionWithItems[] = categories.map((cat) => ({
        id: cat.slug,
        title: cat.name,
        items: items
          .filter((item) => item.category_id === cat.id)
          .map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description ?? "",
            price: Number(item.price),
            image_url: item.image_url,
            available: item.available,
            sort_order: item.sort_order,
          })),
      }));

      setSections(grouped);
      setLoading(false);
    }

    fetchMenu();
  }, []);

  return { sections, loading, error };
}
