import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import heroBiryani from "@/assets/hero-biryani.jpg";

export interface SpecialOffer {
  id?: string;
  badge: string;
  title: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
  available: boolean;
  show_overlay: boolean;
  updated_at?: string;
}

export const DEFAULT_SPECIAL_OFFER: SpecialOffer = {
  badge: "Special Combo Offer",
  title: "Royal Feast Special Combo",
  description:
    "Includes Royal Lamb Biryani, 2x Flame-Grilled Lamb Seekh Kebabs, Butter Naan & Cooling Mint Raita.",
  price: 499,
  original_price: 650,
  image_url: heroBiryani,
  available: true,
  show_overlay: true,
};

const STORAGE_KEY = "halal_ali_special_offer";

export function getLocalSpecialOffer(): SpecialOffer {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_SPECIAL_OFFER,
        ...parsed,
        image_url: parsed.image_url || DEFAULT_SPECIAL_OFFER.image_url,
      };
    }
  } catch (err) {
    console.warn("Failed to parse local special offer:", err);
  }
  return DEFAULT_SPECIAL_OFFER;
}

export async function fetchSpecialOffer(): Promise<SpecialOffer> {
  const local = getLocalSpecialOffer();

  if (!isSupabaseConfigured) {
    return local;
  }

  try {
    // Try reading from a special_offers or site_settings table
    const { data, error } = await supabase
      .from("special_offers")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const remoteOffer: SpecialOffer = {
        id: data.id,
        badge: data.badge || DEFAULT_SPECIAL_OFFER.badge,
        title: data.title || DEFAULT_SPECIAL_OFFER.title,
        description: data.description || DEFAULT_SPECIAL_OFFER.description,
        price: Number(data.price) || DEFAULT_SPECIAL_OFFER.price,
        original_price: data.original_price ? Number(data.original_price) : undefined,
        image_url: data.image_url || DEFAULT_SPECIAL_OFFER.image_url,
        available: data.available !== false,
        show_overlay: data.show_overlay !== false,
        updated_at: data.updated_at,
      };
      // Cache locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteOffer));
      return remoteOffer;
    }
  } catch (err) {
    console.warn("Could not fetch remote special offer:", err);
  }

  return local;
}

export async function saveSpecialOffer(offer: SpecialOffer): Promise<SpecialOffer> {
  const toSave: SpecialOffer = {
    ...offer,
    updated_at: new Date().toISOString(),
  };

  // Always persist locally
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn("Failed to write to localStorage:", err);
  }

  // Notify listeners on current window
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("special-offer-updated", { detail: toSave }));
  }

  // Persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      if (toSave.id) {
        await supabase.from("special_offers").upsert({
          id: toSave.id,
          badge: toSave.badge,
          title: toSave.title,
          description: toSave.description,
          price: toSave.price,
          original_price: toSave.original_price || null,
          image_url: toSave.image_url,
          available: toSave.available,
          show_overlay: toSave.show_overlay,
          updated_at: toSave.updated_at,
        });
      } else {
        const { data } = await supabase
          .from("special_offers")
          .insert({
            badge: toSave.badge,
            title: toSave.title,
            description: toSave.description,
            price: toSave.price,
            original_price: toSave.original_price || null,
            image_url: toSave.image_url,
            available: toSave.available,
            show_overlay: toSave.show_overlay,
            updated_at: toSave.updated_at,
          })
          .select()
          .maybeSingle();

        if (data?.id) {
          toSave.id = data.id;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        }
      }
    } catch (err) {
      console.warn("Remote special offer save attempt:", err);
    }
  }

  return toSave;
}

export function useSpecialOffer() {
  const [offer, setOffer] = useState<SpecialOffer>(getLocalSpecialOffer);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchSpecialOffer().then((data) => {
      if (mounted) {
        setOffer(data);
        setLoading(false);
      }
    });

    function handleUpdate(e: Event) {
      const customEvent = e as CustomEvent<SpecialOffer>;
      if (customEvent.detail) {
        setOffer(customEvent.detail);
      } else {
        setOffer(getLocalSpecialOffer());
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setOffer(getLocalSpecialOffer());
      }
    }

    window.addEventListener("special-offer-updated", handleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      mounted = false;
      window.removeEventListener("special-offer-updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return { offer, loading, setOffer };
}
