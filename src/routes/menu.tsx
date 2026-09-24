import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MenuItemRow } from "@/components/menu-item-row";
import { restaurant } from "@/data/menu";
import { usePublicMenu } from "@/hooks/use-public-menu";
import { SpecialOfferHeroBanner } from "@/components/special-offer-hero-banner";
import { isShopCategory } from "@/lib/supabase";
import { Loader2, UtensilsCrossed } from "lucide-react";

const title = "Menu — Halal Ali Dine Inn & Take Away";
const description =
  "Starters, charcoal grills, curries, biryani, breads and desserts. All dishes 100% halal, for dine in or take away.";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { sections, loading } = usePublicMenu();
  const categoryBarRef = useRef<HTMLDivElement | null>(null);
  const isClickScrollingRef = useRef(false);
  const clickTimeoutRef = useRef<number | null>(null);

  // ONLY display categories and dishes present in the persistent database
  const displaySections = useMemo(() => {
    return sections.map((s) => ({
      id: s.id,
      title: s.title,
      items: s.items.map((item) => ({
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image_url ?? undefined,
      })),
    }));
  }, [sections]);

  const [activeCategory, setActiveCategory] = useState<string>(displaySections[0]?.id || "");

  // Update activeCategory default when sections load or if active category was removed
  useEffect(() => {
    if (displaySections.length > 0) {
      const exists = displaySections.some((s) => s.id === activeCategory);
      if (!exists) {
        setActiveCategory(displaySections[0].id);
      }
    }
  }, [displaySections, activeCategory]);

  // Center the active category pill within the horizontal bar
  const centerActivePill = useCallback((categoryId: string) => {
    if (!categoryBarRef.current) return;
    const container = categoryBarRef.current;
    const activeBtn = container.querySelector(
      `[data-category-id="${categoryId}"]`,
    ) as HTMLElement | null;

    if (activeBtn) {
      const btnLeft = activeBtn.offsetLeft;
      const btnWidth = activeBtn.offsetWidth;
      const containerWidth = container.offsetWidth;
      const targetScroll = btnLeft - containerWidth / 2 + btnWidth / 2;

      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, []);

  // Optimized Scrollspy with requestAnimationFrame and click lock
  useEffect(() => {
    if (displaySections.length === 0) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      // If user recently tapped a category, ignore scrollspy until scroll settles
      if (isClickScrollingRef.current) return;

      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (isClickScrollingRef.current) return;

        const offsetThreshold = 150;
        let currentId = displaySections[0]?.id;

        for (const section of displaySections) {
          const el = document.getElementById(section.id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= offsetThreshold) {
              currentId = section.id;
            }
          }
        }

        if (currentId) {
          setActiveCategory((prev) => {
            if (prev !== currentId) {
              centerActivePill(currentId);
              return currentId;
            }
            return prev;
          });
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (clickTimeoutRef.current !== null) clearTimeout(clickTimeoutRef.current);
    };
  }, [displaySections, centerActivePill]);

  // Instant touch feedback and smooth hardware-accelerated scroll
  const handleCategoryClick = useCallback(
    (sectionId: string) => {
      setActiveCategory(sectionId);
      centerActivePill(sectionId);

      // Lock scrollspy so intermediate sections don't fight the animation
      isClickScrollingRef.current = true;
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }

      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Unlock after animation finishes
      clickTimeoutRef.current = window.setTimeout(() => {
        isClickScrollingRef.current = false;
      }, 650);
    },
    [centerActivePill],
  );

  return (
    <div className="min-h-screen bg-background text-primary">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-gold">
          100% Halal
        </span>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Our Full Menu</h1>
        <p className="mt-3 max-w-prose text-sm text-primary/70">
          Everything is cooked to order. Ask our team about allergens — most curries can be made
          milder or hotter to taste.
        </p>

        {/* Database Special Offer Banner (renders if active in database) */}
        <div className="my-6">
          <SpecialOfferHeroBanner />
        </div>

        {loading && displaySections.length === 0 && (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Loading menu from database...</span>
          </div>
        )}

        {!loading && displaySections.length === 0 && (
          <div className="my-12 rounded-2xl border border-dashed border-border/80 p-8 text-center">
            <UtensilsCrossed className="mx-auto size-8 text-muted-foreground/60 mb-2" />
            <h3 className="font-serif text-lg font-bold text-foreground">Menu Empty</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              No menu items currently found in the database. Please add dishes from the Admin Panel.
            </p>
          </div>
        )}

        {/* Floatable / Sticky Category Navigation Bar */}
        {displaySections.length > 0 && (
          <div className="sticky top-[57px] sm:top-[65px] z-40 -mx-6 mt-6 border-b border-border/80 bg-background/98 px-6 py-2.5 shadow-xs transition-shadow">
            <div
              ref={categoryBarRef}
              className="no-scrollbar flex items-center gap-2 overflow-x-auto touch-pan-x scroll-smooth py-0.5"
              role="tablist"
              aria-label="Menu categories"
            >
              {displaySections.map((section) => {
                const isActive = activeCategory === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    data-category-id={section.id}
                    onClick={() => handleCategoryClick(section.id)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                      isActive
                        ? "bg-gold text-gold-foreground shadow-sm ring-1 ring-gold"
                        : "border border-border bg-card/80 text-foreground/75 hover:bg-card hover:text-foreground"
                    }`}
                  >
                    <span>{section.title}</span>
                    {section.items.length > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-black/20 text-gold-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {section.items.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Menu Sections with Scroll Margin */}
        {displaySections.length > 0 && (
          <div className="mt-8 space-y-12">
            {displaySections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-36 space-y-6">
                <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
                  <h2 className="font-serif text-2xl font-bold text-foreground">{section.title}</h2>
                  <span className="text-xs font-medium text-muted-foreground">
                    {section.items.length} {section.items.length === 1 ? "dish" : "dishes"}
                  </span>
                </div>
                <div className="space-y-6">
                  {section.items.length > 0 ? (
                    section.items.map((item) => <MenuItemRow key={item.name} item={item} />)
                  ) : (
                    <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                      {isShopCategory({ name: section.title, slug: section.id })
                        ? "Shop items coming soon. Enjoy our freshly prepared kitchen menu above."
                        : "No dishes added to this section yet."}
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-2xl bg-primary p-6 text-primary-foreground">
          <p className="font-serif text-xl">Ordering take away?</p>
          <p className="mt-2 text-sm opacity-80">
            Call us and your food will be freshly boxed and ready to collect.
          </p>
          <a
            href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
            className="mt-4 inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-gold-foreground"
          >
            Call {restaurant.phone}
          </a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
