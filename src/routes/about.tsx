import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import kitchen from "@/assets/dish-seekh-kebab.jpg";

const title = "Our Story — Halal Ali Dine Inn & Take Away";
const description =
  "A family kitchen since 1994, cooking halal grills and curries from recipes passed down through generations.";

export const Route = createFileRoute("/about")({
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
  component: AboutPage,
});

const values = [
  {
    title: "100% Halal",
    body: "Every cut of meat is sourced from certified halal suppliers we have worked with for years.",
  },
  {
    title: "Cooked to order",
    body: "Nothing sits under a lamp. Grills go on the charcoal when your order comes in.",
  },
  {
    title: "Family table",
    body: "Big platters, shared sides, and space for the whole family — or boxed for home.",
  },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-primary">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-gold">
          Since 1994
        </span>
        <h1 className="mt-3 font-serif text-4xl leading-tight">
          A family kitchen, <span className="italic">still</span> run by family
        </h1>

        <div className="mt-8 space-y-5 text-primary/80">
          <p>
            Ali started with one small counter, a charcoal grill, and his mother's spice tin. Word
            spread quickly — first among neighbours, then across the city — and the counter became a
            dining room.
          </p>
          <p>
            Three decades later the recipes have not changed. We still grind our own masalas, still
            marinate overnight, and still cook every curry in small batches so the flavour stays
            deep and honest.
          </p>
        </div>

        <img
          src={kitchen}
          alt="Charcoal-grilled seekh kebabs served with fresh green chutney"
          loading="lazy"
          width={512}
          height={512}
          className="mt-8 aspect-video w-full rounded-2xl object-cover"
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {values.map((value) => (
            <div key={value.title} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-serif text-xl">{value.title}</h2>
              <p className="mt-2 text-sm text-primary/70">{value.body}</p>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
