import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MenuItemRow } from "@/components/menu-item-row";
import { restaurant, menuSections as staticSections } from "@/data/menu";
import { usePublicMenu } from "@/hooks/use-public-menu";
import { Loader2 } from "lucide-react";

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

  // Use Supabase data if available, otherwise fall back to static
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
      : staticSections.map((s) => ({
          id: s.id,
          title: s.title,
          items: s.items,
        }));

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

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading menu...
          </div>
        )}

        <div className="no-scrollbar -mx-6 mt-6 flex gap-3 overflow-x-auto px-6 pb-2">
          {displaySections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="whitespace-nowrap rounded-full border border-input px-5 py-2 text-sm font-medium"
            >
              {section.title}
            </a>
          ))}
        </div>

        <div className="mt-10 space-y-12">
          {displaySections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-6">
              <h2 className="font-serif text-2xl">{section.title}</h2>
              <div className="space-y-6">
                {section.items.map((item) => (
                  <MenuItemRow key={item.name} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>

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
