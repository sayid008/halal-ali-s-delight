import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeMenuBrowser } from "@/components/home-menu-browser";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { menuSections as staticSections, restaurant } from "@/data/menu";
import { usePublicMenu } from "@/hooks/use-public-menu";
import { SpecialOfferHeroBanner } from "@/components/special-offer-hero-banner";
import { getRestaurantStatus } from "@/lib/opening-hours";
import { Clock, MapPin, Phone, ArrowUpRight, ChevronRight } from "lucide-react";

const title = "Halal Ali Dine Inn & Take Away — Authentic Halal Cuisine in London";
const description =
  "Family-run halal restaurant serving charcoal grills, curries and biryani. Dine in or take away, open daily 12pm–11pm.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "restaurant" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { sections, loading } = usePublicMenu();

  const displaySections =
    sections.length > 0
      ? sections.map((s) => ({
          id: s.id,
          title: s.title,
          items: s.items.map((item) => ({
            name: item.name,
            description: item.description,
            price: item.price,
            image: item.image_url ?? undefined,
          })),
        }))
      : staticSections;

  return (
    <div className="min-h-screen bg-background text-primary">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-8 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold">
              Established 1994
            </span>
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
              Authentic <span className="italic">Halal</span>
              <br />
              Cuisine in the Heart of the City
            </h1>
            <div className="flex flex-wrap gap-3">
              <a
                href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
              >
                Order for Take Away
              </a>
              <Link
                to="/contact"
                className="rounded-full border border-primary px-6 py-3 text-sm font-medium text-primary"
              >
                Book a Table
              </Link>
            </div>
          </div>

          <SpecialOfferHeroBanner />
        </section>

        <HomeMenuBrowser sections={displaySections} />

        <section className="mx-auto max-w-5xl px-6 py-10 pb-28">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Location Card */}
              <div className="flex items-start gap-3.5">
                <a
                  href={restaurant.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold transition-transform hover:scale-105 active:scale-95"
                  title="Open in Google Maps"
                >
                  <MapPin className="size-5" />
                </a>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Location
                  </p>
                  <a
                    href={restaurant.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-sm font-medium text-foreground hover:text-gold transition-colors"
                  >
                    {restaurant.address}
                  </a>
                  <a
                    href={restaurant.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                  >
                    <span>Get Directions</span>
                    <ArrowUpRight className="size-3" />
                  </a>
                </div>
              </div>

              {/* Opening Hours with Live Status */}
              {(() => {
                const status = getRestaurantStatus();
                return (
                  <div className="flex items-start gap-3.5 border-t border-border pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                      <Clock className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Opening Hours
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            status.isOpen
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              status.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                            }`}
                          />
                          {status.statusText}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        Today: {status.todaySchedule.openTime} – {status.todaySchedule.closeTime}
                      </p>
                      <Link
                        to="/contact"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                      >
                        <span>View weekly schedule</span>
                        <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {/* Phone / Call to Order */}
              <div className="flex items-start gap-3.5 border-t border-border pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <Phone className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Orders & Bookings
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    Dine in or takeaway orders
                  </p>
                  <a
                    href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline"
                  >
                    <span>Call {restaurant.phone}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-80px)] max-w-[342px] -translate-x-1/2 md:hidden">
        <Link
          to="/menu"
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gold py-4 font-bold text-gold-foreground shadow-xl"
        >
          <span>View Full Menu</span>
        </Link>
      </div>

      <SiteFooter />
    </div>
  );
}
