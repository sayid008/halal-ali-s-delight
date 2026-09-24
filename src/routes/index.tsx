import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeMenuBrowser } from "@/components/home-menu-browser";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { restaurant } from "@/data/menu";
import { usePublicMenu } from "@/hooks/use-public-menu";
import { Loader2 } from "lucide-react";

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

  // ONLY display categories and items present in the persistent database
  const displaySections = sections.map((s) => ({
    id: s.id,
    title: s.title,
    items: s.items.map((item) => ({
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image_url ?? undefined,
    })),
  }));

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
        </section>

        {loading && sections.length === 0 ? (
          <div className="mx-auto max-w-5xl px-6 py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading menu from database...</span>
          </div>
        ) : (
          <HomeMenuBrowser sections={displaySections} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
