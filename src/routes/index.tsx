import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeMenuBrowser } from "@/components/home-menu-browser";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SpecialOfferHeroBanner } from "@/components/special-offer-hero-banner";
import { restaurant } from "@/data/menu";
import { usePublicMenu, fetchPublicMenuFromDatabase } from "@/hooks/use-public-menu";

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
  loader: async () => {
    return await fetchPublicMenuFromDatabase();
  },
  component: Index,
});

function Index() {
  const initialSections = Route.useLoaderData();
  const { sections } = usePublicMenu(initialSections);

  // Seamless immediate render of categories and items with bulletproof null checks
  const displaySections = (sections && sections.length > 0 ? sections : []).map((s) => ({
    id: s?.id ?? "category",
    title: s?.title ?? "Menu",
    items: (s?.items || []).map((item) => ({
      name: item?.name ?? "",
      description: item?.description ?? "",
      price: item?.price ?? 0,
      image: item?.image_url ?? undefined,
    })),
  }));

  return (
    <div className="min-h-screen bg-background text-primary animate-in fade-in-0 duration-300">
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

          {/* Database Live Special Offer Banner */}
          <div className="mb-8">
            <SpecialOfferHeroBanner />
          </div>
        </section>

        <HomeMenuBrowser sections={displaySections} />
      </main>

      <SiteFooter />
    </div>
  );
}
