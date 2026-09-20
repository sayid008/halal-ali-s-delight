import { Sparkles, Phone, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/supabase";
import { restaurant } from "@/data/menu";
import { useSpecialOffer } from "@/lib/special-offer";
import heroBiryani from "@/assets/hero-biryani.jpg";

export function SpecialOfferHeroBanner() {
  const { offer, loading } = useSpecialOffer();

  // If any special offer is not there or disabled, do not add anything (leave section omitted)
  if (loading || !offer || !offer.available) {
    return null;
  }

  const imgSrc = offer.image_url || heroBiryani;

  return (
    <div
      id="special-offer-hero"
      className="group relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-lg sm:aspect-[16/9]"
    >
      {/* Background Image preserving the exact dimensions */}
      <img
        src={imgSrc}
        alt={offer.title || "Special Offer"}
        width={800}
        height={1008}
        className="size-full rounded-2xl object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/* Special Offer Overlay */}
      {offer.available && (
        <div className="absolute inset-0 flex flex-col justify-between rounded-2xl bg-gradient-to-t from-black/95 via-black/40 to-black/20 p-5 sm:p-8">
          {/* Top Row: Badge and Offer Price */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-gold-foreground shadow-sm">
                <Sparkles className="size-3.5" />
                {offer.badge || "Special Combo Offer"}
              </span>
              <span className="hidden rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm sm:inline-block">
                Limited Time Deal
              </span>
            </div>

            {offer.price ? (
              <div className="rounded-xl border border-white/20 bg-black/70 px-3.5 py-1.5 text-right backdrop-blur-md shadow-sm">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  Combo Price
                </span>
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="font-serif text-lg font-bold text-gold sm:text-2xl">
                    {formatPrice(offer.price)}
                  </span>
                  {offer.original_price ? (
                    <span className="text-xs text-white/50 line-through">
                      {formatPrice(offer.original_price)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Bottom Row: Offer Title, Description & Action Buttons */}
          <div className="max-w-2xl space-y-2.5">
            {offer.show_overlay && (
              <>
                <h2 className="font-serif text-2xl font-bold leading-tight text-white drop-shadow-md sm:text-4xl">
                  {offer.title || "Royal Feast Special Combo"}
                </h2>

                {offer.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-white/90 drop-shadow-sm sm:line-clamp-3 sm:text-sm">
                    {offer.description}
                  </p>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1 sm:gap-3">
              <a
                href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-xs font-bold text-gold-foreground shadow-md transition-all hover:bg-gold/90 hover:shadow-lg sm:text-sm"
              >
                <Phone className="size-3.5" />
                <span>Claim Offer</span>
              </a>

              <Link
                to="/menu"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/30 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:text-sm"
              >
                <span>Full Menu</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
