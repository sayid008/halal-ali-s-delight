import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder-project.supabase.co";
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !String(import.meta.env.VITE_SUPABASE_URL).includes("placeholder-project"),
);

export const LOCAL_ADMIN_STORAGE_KEY = "halal_ali_admin_session";

export interface AdminUserSession {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    role?: string;
  };
}

export function getLocalAdminSession(): AdminUserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.user && parsed.user.email) {
      return parsed as AdminUserSession;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveLocalAdminSession(email?: string): AdminUserSession {
  const session: AdminUserSession = {
    access_token: "local-admin-" + Date.now(),
    token_type: "bearer",
    user: {
      id: "local-admin-id",
      email: email?.trim() || "admin@halal-ali.com",
      role: "admin",
    },
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_ADMIN_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn("Failed to write admin session to localStorage:", e);
    }
  }
  return session;
}

export function clearLocalAdminSession() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LOCAL_ADMIN_STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to remove admin session from localStorage:", e);
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type DatabaseMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  available: boolean;
  sort_order: number;
  created_at: string;
  deleted_at?: string | null;
};

export type DatabaseCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  available?: boolean;
  created_at: string;
  deleted_at?: string | null;
};

export type MenuSectionWithItems = {
  id: string;
  title: string;
  items: {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    available: boolean;
    sort_order: number;
  }[];
};

/**
 * Checks whether a category is a "Shop" or merchandise category
 * (excluded from standard food menu item distribution).
 */
export function isShopCategory(
  cat?: { name?: string | null; slug?: string | null } | null,
): boolean {
  if (!cat) return false;
  const name = (cat.name || "").trim().toLowerCase();
  const slug = (cat.slug || "").trim().toLowerCase();
  return (
    name === "shop" ||
    slug === "shop" ||
    name.startsWith("shop") ||
    slug.startsWith("shop") ||
    name.includes("shop") ||
    slug.includes("shop") ||
    name === "store" ||
    slug === "store" ||
    name.includes("store") ||
    name === "merchandise" ||
    slug === "merchandise"
  );
}

/**
 * Evenly distributes items across all active categories, strictly excluding "Shop".
 */
export function distributeItemsAcrossCategories(
  categories: DatabaseCategory[],
  items: DatabaseMenuItem[],
): {
  updatedItems: DatabaseMenuItem[];
  distributedCount: number;
  categoriesUsed: number;
} {
  const eligibleCategories = categories.filter(
    (c) => !c.deleted_at && c.available !== false && !isShopCategory(c),
  );

  if (eligibleCategories.length === 0) {
    return { updatedItems: items, distributedCount: 0, categoriesUsed: 0 };
  }

  // Sort categories by sort_order
  const sortedCategories = [...eligibleCategories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const activeItems = items.filter((i) => !i.deleted_at);
  const trashedItems = items.filter((i) => !!i.deleted_at);
  const totalCats = sortedCategories.length;

  const distributedActiveItems = activeItems.map((item, index) => {
    const targetCat = sortedCategories[index % totalCats];
    const newSortOrder = Math.floor(index / totalCats) * 10 + 10;
    return {
      ...item,
      category_id: targetCat.id,
      sort_order: newSortOrder,
    };
  });

  return {
    updatedItems: [...distributedActiveItems, ...trashedItems],
    distributedCount: distributedActiveItems.length,
    categoriesUsed: totalCats,
  };
}

export function formatPrice(price: number | string): string {
  if (typeof price === "string") {
    if (price.startsWith("₹")) {
      return price;
    }
    const cleanStr = price.replace(/[^\d.]/g, "");
    const parsed = parseFloat(cleanStr);
    if (!isNaN(parsed)) {
      return `₹${parsed % 1 === 0 ? parsed.toLocaleString("en-IN") : parsed.toFixed(2)}`;
    }
    return `₹${price}`;
  }
  const num = Number(price);
  if (isNaN(num)) return "₹0";
  return `₹${num % 1 === 0 ? num.toLocaleString("en-IN") : num.toFixed(2)}`;
}
