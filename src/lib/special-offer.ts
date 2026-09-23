import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import heroBiryani from "@/assets/hero-biryani.jpg";
import mixedGrill from "@/assets/dish-mixed-grill.jpg";
import butterChicken from "@/assets/dish-butter-chicken.jpg";

export interface SpecialOfferSlide {
  id: string;
  badge: string;
  title: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
}

export interface SpecialOffer {
  id?: string;
  badge: string;
  title: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
  slides?: SpecialOfferSlide[];
  available: boolean;
  show_overlay: boolean;
  autoplay?: boolean;
  updated_at?: string;
}

export const DEFAULT_SLIDES: SpecialOfferSlide[] = [
  {
    id: "slide-1",
    badge: "Special Combo Offer",
    title: "Royal Feast Special Combo",
    description:
      "Includes Royal Lamb Biryani, 2x Flame-Grilled Lamb Seekh Kebabs, Butter Naan & Cooling Mint Raita.",
    price: 499,
    original_price: 650,
    image_url: heroBiryani,
  },
  {
    id: "slide-2",
    badge: "Grill Special Deal",
    title: "Charcoal Mixed Grill Platter",
    description:
      "Sizzling platter of marinated lamb chops, tender chicken tikka, seekh kebabs, garlic naan & mint chutney.",
    price: 599,
    original_price: 750,
    image_url: mixedGrill,
  },
  {
    id: "slide-3",
    badge: "Chef's Recommendation",
    title: "Delhi Butter Chicken Combo",
    description:
      "Creamy butter chicken slow-simmered in aromatic spices with 2x garlic butter naans & jeera pilau.",
    price: 449,
    original_price: 550,
    image_url: butterChicken,
  },
];

export const DEFAULT_SPECIAL_OFFER: SpecialOffer = {
  badge: DEFAULT_SLIDES[0].badge,
  title: DEFAULT_SLIDES[0].title,
  description: DEFAULT_SLIDES[0].description,
  price: DEFAULT_SLIDES[0].price,
  original_price: DEFAULT_SLIDES[0].original_price,
  image_url: DEFAULT_SLIDES[0].image_url,
  slides: DEFAULT_SLIDES,
  available: true,
  show_overlay: true,
  autoplay: true,
};

export function getOfferSlides(offer: SpecialOffer): SpecialOfferSlide[] {
  if (offer.slides && Array.isArray(offer.slides) && offer.slides.length > 0) {
    return offer.slides;
  }
  return [
    {
      id: "slide-1",
      badge: offer.badge || "Special Combo Offer",
      title: offer.title || "Special Offer",
      description: offer.description || "",
      price: offer.price || 499,
      original_price: offer.original_price,
      image_url: offer.image_url || heroBiryani,
    },
  ];
}

const STORAGE_KEY = "halal_ali_special_offer";

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getLocalSpecialOffer(): SpecialOffer {
  if (!isStorageAvailable()) {
    return DEFAULT_SPECIAL_OFFER;
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const slides: SpecialOfferSlide[] =
        Array.isArray(parsed.slides) && parsed.slides.length > 0
          ? parsed.slides.map((s: Partial<SpecialOfferSlide>, idx: number) => ({
              id: s.id || `slide-${idx + 1}`,
              badge: s.badge || parsed.badge || "Special Combo Offer",
              title: s.title || parsed.title || "Special Offer",
              description: s.description ?? parsed.description ?? "",
              price: Number(s.price) || Number(parsed.price) || 499,
              original_price: s.original_price ? Number(s.original_price) : undefined,
              image_url: s.image_url || parsed.image_url || heroBiryani,
            }))
          : DEFAULT_SLIDES;

      return {
        ...DEFAULT_SPECIAL_OFFER,
        ...parsed,
        image_url: slides[0]?.image_url || parsed.image_url || DEFAULT_SPECIAL_OFFER.image_url,
        slides,
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
    const res = await fetch("/api/special-offer");
    if (res.ok) {
      const data = (await res.json()) as { offer?: SpecialOffer };
      if (data.offer) {
        if (isStorageAvailable()) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.offer));
          } catch {
            // ignore
          }
        }
        return data.offer;
      }
    }
  } catch {
    // ignore
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
        slides: data.slides || local.slides || DEFAULT_SLIDES,
        available: data.available !== false,
        show_overlay: data.show_overlay !== false,
        autoplay: data.autoplay !== undefined ? data.autoplay : (local.autoplay ?? true),
        updated_at: data.updated_at,
      };

      // If local storage has a newer update timestamp, prefer local
      if (local.updated_at && remoteOffer.updated_at) {
        const localTime = new Date(local.updated_at).getTime();
        const remoteTime = new Date(remoteOffer.updated_at).getTime();
        if (localTime > remoteTime) {
          return local;
        }
      } else if (local.updated_at && !remoteOffer.updated_at) {
        return local;
      }
      // Cache locally
      if (isStorageAvailable()) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteOffer));
        } catch (e) {
          console.warn("Failed to cache remote offer in localStorage:", e);
        }
      }
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

  // Always persist locally if storage is available
  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn("Failed to write to localStorage:", err);
    }
  }

  // Persist to server API database
  if (typeof fetch !== "undefined") {
    fetch("/api/special-offer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toSave),
    }).catch(() => {
      // ignore network errors
    });
  }

  // Notify listeners on current window
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("special-offer-updated", { detail: toSave }));
  }

  // Persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const payload: Record<string, unknown> = {
        badge: toSave.badge || "Special Combo Offer",
        title: toSave.title || "Special Offer",
        description: toSave.description || "",
        price: Number(toSave.price) || 0,
        original_price: toSave.original_price ? Number(toSave.original_price) : null,
        image_url: toSave.image_url || "",
        slides: toSave.slides || [],
        available: toSave.available !== false,
        show_overlay: toSave.show_overlay !== false,
        autoplay: toSave.autoplay !== false,
        updated_at: toSave.updated_at,
      };

      if (toSave.id && !toSave.id.startsWith("offer-")) {
        payload.id = toSave.id;
        const { error } = await supabase.from("special_offers").upsert(payload);
        if (error) {
          console.warn("Supabase upsert error in special_offers, falling back to insert:", error);
          delete payload.id;
          const { data: insData } = await supabase
            .from("special_offers")
            .insert(payload)
            .select()
            .maybeSingle();
          if (insData?.id) {
            toSave.id = insData.id;
            if (isStorageAvailable()) {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
            }
          }
        }
      } else {
        const { data, error } = await supabase
          .from("special_offers")
          .insert(payload)
          .select()
          .maybeSingle();

        if (!error && data?.id) {
          toSave.id = data.id;
          if (isStorageAvailable()) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
          }
        }
      }
    } catch (err) {
      console.warn("Remote special offer save attempt:", err);
    }
  }

  return toSave;
}

export function useSpecialOffer() {
  // Always initialize with DEFAULT_SPECIAL_OFFER for consistent SSR and initial client hydration
  const [offer, setOffer] = useState<SpecialOffer>(DEFAULT_SPECIAL_OFFER);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Immediately sync with local storage on mount (after hydration)
    const local = getLocalSpecialOffer();
    if (local) {
      setOffer(local);
    }

    fetchSpecialOffer().then((data) => {
      if (mounted && data) {
        setOffer(data);
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
