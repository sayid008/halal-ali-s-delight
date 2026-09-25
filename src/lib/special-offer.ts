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

  // 1. Fetch directly from Supabase database
  if (isSupabaseConfigured) {
    try {
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
          available:
            data.is_active !== undefined ? Boolean(data.is_active) : data.available !== false,
          show_overlay: data.show_overlay !== false,
          autoplay: data.autoplay !== undefined ? data.autoplay : (local.autoplay ?? true),
          updated_at: data.updated_at,
        };

        if (isStorageAvailable()) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteOffer));
          } catch {
            // ignore
          }
        }
        return remoteOffer;
      }
    } catch (err) {
      console.warn("Could not fetch special offer from Supabase:", err);
    }
  }

  return local;
}

export async function saveSpecialOffer(
  offer: SpecialOffer,
): Promise<SpecialOffer & { hasChanges?: boolean }> {
  const toSave: SpecialOffer = {
    ...offer,
    updated_at: new Date().toISOString(),
  };

  let hasChanges = false;

  // Direct Supabase database sync with change checking
  if (isSupabaseConfigured) {
    try {
      const { data: currentDbOffer } = await supabase
        .from("special_offers")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newIsActive = toSave.available !== false;
      const newPrice = Number(toSave.price) || 0;
      const newOriginalPrice = toSave.original_price ? Number(toSave.original_price) : null;

      const payload: Record<string, unknown> = {
        badge: toSave.badge || "Special Combo Offer",
        title: toSave.title || "Special Offer",
        description: toSave.description || "",
        price: newPrice,
        original_price: newOriginalPrice,
        image_url: toSave.image_url || "",
        slides: toSave.slides || [],
        is_active: newIsActive,
        updated_at: toSave.updated_at,
      };

      if (currentDbOffer) {
        // Check for changes
        const titleChanged = currentDbOffer.title !== payload.title;
        const descChanged = currentDbOffer.description !== payload.description;
        const badgeChanged = currentDbOffer.badge !== payload.badge;
        const priceChanged = Math.abs(Number(currentDbOffer.price) - newPrice) > 0.001;
        const origPriceChanged =
          Math.abs(Number(currentDbOffer.original_price || 0) - Number(newOriginalPrice || 0)) >
          0.001;
        const imgChanged = (currentDbOffer.image_url || "") !== (payload.image_url || "");
        const activeChanged = Boolean(currentDbOffer.is_active) !== newIsActive;
        const slidesChanged =
          JSON.stringify(currentDbOffer.slides || []) !== JSON.stringify(payload.slides || []);

        hasChanges =
          titleChanged ||
          descChanged ||
          badgeChanged ||
          priceChanged ||
          origPriceChanged ||
          imgChanged ||
          activeChanged ||
          slidesChanged;

        if (hasChanges) {
          const { error: updErr } = await supabase
            .from("special_offers")
            .update(payload)
            .eq("id", currentDbOffer.id);

          if (updErr) {
            console.warn("Special offer Supabase update notice:", updErr);
          } else {
            toSave.id = currentDbOffer.id;
          }
        } else {
          toSave.id = currentDbOffer.id;
        }
      } else {
        // Insert new special offer
        hasChanges = true;
        const { data: insData, error: insErr } = await supabase
          .from("special_offers")
          .insert(payload)
          .select()
          .maybeSingle();

        if (!insErr && insData?.id) {
          toSave.id = insData.id;
        }
      }
    } catch (err) {
      console.warn("Supabase special offer save notice:", err);
    }
  }

  // Always persist locally
  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn("Failed to write to localStorage:", err);
    }
  }

  // Notify listeners on current window and other tabs
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("special-offer-updated", { detail: toSave }));
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("halal_ali_special_offer_channel");
        bc.postMessage(toSave);
        bc.close();
      } catch {
        // ignore channel errors
      }
    }
  }

  return { ...toSave, hasChanges };
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

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchSpecialOffer().then((data) => {
          if (mounted && data) {
            setOffer(data);
          }
        });
      }
    };

    window.addEventListener("special-offer-updated", handleUpdate);
    window.addEventListener("storage", handleStorage);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("halal_ali_special_offer_channel");
        bc.onmessage = (msgEvent) => {
          if (msgEvent.data && typeof msgEvent.data === "object") {
            setOffer(msgEvent.data as SpecialOffer);
          }
        };
      } catch {
        // ignore channel errors
      }
    }

    const pollInterval = setInterval(() => {
      fetchSpecialOffer().then((data) => {
        if (mounted && data) {
          setOffer(data);
        }
      });
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      window.removeEventListener("special-offer-updated", handleUpdate);
      window.removeEventListener("storage", handleStorage);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (bc) {
        bc.close();
      }
    };
  }, []);

  return { offer, loading, setOffer };
}
