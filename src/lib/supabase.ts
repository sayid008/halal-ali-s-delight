import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder-project.supabase.co";
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

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
};

export type DatabaseCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
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
