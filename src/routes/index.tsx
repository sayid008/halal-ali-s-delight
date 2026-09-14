import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MenuItemRow } from "@/components/menu-item-row";
import { chefSpecials, restaurant } from "@/data/menu";
import heroBiryani from "@/assets/hero-biryani.jpg";

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

const categories = [
  { id: "starters", label: "Starters" },
  { id: "grill", label: "Main Grill" },
  { id: "curries", label: "Curries" },
  { id: "biryani", label: "Biryani" },
  { id: "breads", label: "Breads" },
  { id: "desserts", label: "Desserts" },
];

function Index() {
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

          <img
            src={heroBiryani}
            alt="Royal lamb biryani with saffron rice and fresh coriander"
            width={800}
            height={1008}
            className="aspect-[4/5] w-full rounded-2xl object-cover sm:aspect-[16/9]"
          />
        </section>

        <div className="no-scrollbar mx-auto flex max-w-5xl gap-4 overflow-x-auto px-6 py-4">
          {categories.map((cat, i) => (
            <Link
              key={cat.id}
              to="/menu"
              hash={cat.id}
              className={
                i === 0
                  ? "whitespace-nowrap rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
                  : "whitespace-nowrap rounded-full border border-input px-5 py-2 text-sm font-medium"
              }
            >
              {cat.label}
            </Link>
          ))}
        </div>

        <section className="mx-auto max-w-5xl space-y-8 px-6 py-4 pb-28">
          <div className="space-y-6">
            <h2 className="font-serif text-2xl">Chef's Specials</h2>
            {chefSpecials.map((item) => (
              <MenuItemRow key={item.name} item={item} />
            ))}
          </div>

          <div className="space-y-4 rounded-2xl bg-primary p-6 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="grid size-8 place-items-center rounded-full bg-gold/25 text-gold">
                ●
              </div>
              <div>
                <p className="text-xs opacity-70">Location</p>
                <p className="text-sm font-medium">{restaurant.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid size-8 place-items-center rounded-full bg-gold/25 text-gold">
                ●
              </div>
              <div>
                <p className="text-xs opacity-70">Opening Hours</p>
                <p className="text-sm font-medium">{restaurant.hours}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-48px)] max-w-[342px] -translate-x-1/2 md:hidden">
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
