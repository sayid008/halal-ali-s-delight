import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Tag, Phone, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/supabase";
import { restaurant } from "@/data/menu";
import { useSpecialOffer, getOfferSlides, type SpecialOfferSlide } from "@/lib/special-offer";
import heroBiryani from "@/assets/hero-biryani.jpg";

interface SpecialOfferHeroBannerProps {
  // Optional custom slides for previewing in the admin panel
  customSlides?: SpecialOfferSlide[];
  customOverlay?: boolean;
}

export function SpecialOfferHeroBanner({
  customSlides,
  customOverlay,
}: SpecialOfferHeroBannerProps = {}) {
  const { offer } = useSpecialOffer();

  const slides = customSlides ?? (offer ? getOfferSlides(offer) : []);
  const showOverlay = customOverlay !== undefined ? customOverlay : (offer?.show_overlay ?? true);
  const isAvailable = offer?.available ?? true;
  const isAutoPlayEnabled = offer?.autoplay ?? true;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: slides.length > 1,
    duration: 25,
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Autoplay functionality with pause on hover/touch
  useEffect(() => {
    if (!emblaApi || slides.length <= 1 || !isAutoPlayEnabled || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5500);

    return () => clearInterval(interval);
  }, [emblaApi, slides.length, isAutoPlayEnabled, isPaused]);

  const scrollTo = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index);
    },
    [emblaApi],
  );

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  // If disabled or empty, omit banner
  if (!offer) {
    return null;
  }

  if (!isAvailable && !customSlides) {
    return null;
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <div
      id="special-offer-hero"
      className="group relative w-full overflow-hidden rounded-2xl shadow-lg select-none min-h-[350px] sm:min-h-[400px] aspect-[4/4.5] sm:aspect-[16/9] max-h-[500px] sm:max-h-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Embla Carousel Viewport */}
      <div className="size-full overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
        <div className="flex size-full">
          {slides.map((slide, idx) => {
            const imgSrc = slide.image_url || heroBiryani;
            const savings =
              slide.original_price && slide.price && slide.original_price > slide.price
                ? slide.original_price - slide.price
                : null;

            return (
              <div
                key={slide.id || `slide-${idx}`}
                className="relative size-full min-w-full shrink-0 grow-0 basis-full"
              >
                {/* Slide Background Image */}
                <img
                  src={imgSrc}
                  alt={slide.title || "Special Offer"}
                  width={800}
                  height={1008}
                  className="size-full rounded-2xl object-cover"
                  loading={idx === 0 ? "eager" : "lazy"}
                />

                {/* Gradient and Offer Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-between rounded-2xl bg-gradient-to-t from-black/95 via-black/45 to-black/30 p-4 sm:p-7 md:p-8">
                  {/* Top Row: Tag Badge & Price Callout */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-foreground shadow-sm sm:px-3.5 sm:py-1.5 sm:text-xs">
                        <Tag className="size-3 sm:size-3.5" />
                        {slide.badge || "Special Offer"}
                      </span>

                      {savings !== null && (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-950/80 px-2.5 py-1 text-[10px] font-bold text-emerald-300 backdrop-blur-sm sm:text-[11px]">
                          Save {formatPrice(savings)}
                        </span>
                      )}
                    </div>

                    {slide.price ? (
                      <div className="rounded-xl border border-white/20 bg-black/75 px-2.5 py-1 text-right backdrop-blur-md shadow-sm sm:px-3.5 sm:py-1.5 shrink-0">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-white/70 sm:text-[10px]">
                          Special Price
                        </span>
                        <div className="flex items-baseline justify-end gap-1 sm:gap-1.5">
                          <span className="font-serif text-base font-bold text-gold sm:text-2xl">
                            {formatPrice(slide.price)}
                          </span>
                          {slide.original_price ? (
                            <span className="text-[11px] text-white/50 line-through sm:text-xs">
                              {formatPrice(slide.original_price)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Bottom Area: Title, Description & Action Buttons */}
                  <div className="max-w-2xl space-y-2 pb-10 sm:space-y-2.5 sm:pb-7">
                    {showOverlay && (
                      <>
                        <h2 className="font-serif text-xl font-bold leading-tight text-white drop-shadow-md sm:text-3xl lg:text-4xl">
                          {slide.title || "Royal Feast Special Combo"}
                        </h2>

                        {slide.description && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-white/90 drop-shadow-sm sm:line-clamp-3 sm:text-sm">
                            {slide.description}
                          </p>
                        )}
                      </>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1 sm:gap-3">
                      <a
                        href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-bold text-gold-foreground shadow-md transition-all hover:bg-gold/90 hover:shadow-lg sm:min-h-[44px] sm:px-5 sm:text-sm whitespace-nowrap"
                      >
                        <Phone className="size-3.5" />
                        <span>Call to Order</span>
                      </a>

                      <Link
                        to="/menu"
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-white/35 bg-black/40 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:min-h-[44px] sm:px-4 sm:text-sm whitespace-nowrap"
                      >
                        <span>View Menu</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows for Easy Browsing (Desktop / Tablet, hidden on small mobile) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scrollPrev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 hidden sm:flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white backdrop-blur-md transition-all opacity-80 hover:opacity-100 hover:bg-black/80 hover:scale-105 active:scale-95 focus:outline-none"
            aria-label="Previous special offer"
          >
            <ChevronLeft className="size-5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scrollNext();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white backdrop-blur-md transition-all opacity-80 hover:opacity-100 hover:bg-black/80 hover:scale-105 active:scale-95 focus:outline-none"
            aria-label="Next special offer"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* Pagination Dots Indicator: Clean, Finger-Friendly & Unobtrusive */}
      {slides.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 backdrop-blur-md z-10 shadow-lg select-none sm:bottom-3 sm:px-3">
          {slides.map((slide, idx) => {
            const isActive = idx === selectedIndex;
            return (
              <button
                key={slide.id || `dot-${idx}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollTo(idx);
                }}
                className="group flex h-6 items-center justify-center px-1 focus:outline-none sm:h-7"
                aria-label={`Slide to special offer ${idx + 1}: ${slide.title}`}
                title={`Offer ${idx + 1}: ${slide.title}`}
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    isActive
                      ? "h-1.5 w-5 bg-gold shadow-xs sm:h-2 sm:w-6"
                      : "size-1.5 bg-white/40 group-hover:bg-white/80 group-hover:scale-125 sm:size-2"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
