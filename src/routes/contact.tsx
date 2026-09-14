import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { restaurant } from "@/data/menu";

const title = "Contact & Find Us — Halal Ali Dine Inn & Take Away";
const description =
  "Address, opening hours and phone number for Halal Ali Dine Inn & Take Away. Call to book a table or place a takeaway order.";

export const Route = createFileRoute("/contact")({
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
  component: ContactPage,
});

const hours = [
  { day: "Monday – Thursday", time: "12:00 – 23:00" },
  { day: "Friday – Saturday", time: "12:00 – 23:00" },
  { day: "Sunday", time: "12:00 – 23:00" },
];

function ContactPage() {
  const tel = restaurant.phone.replace(/\s/g, "");

  return (
    <div className="min-h-screen bg-background text-primary">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-gold">
          Dine In & Take Away
        </span>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Come and eat with us</h1>
        <p className="mt-3 max-w-prose text-sm text-primary/70">
          Tables are first come, first served for parties under six. For larger groups or a takeaway
          order, give us a ring.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-serif text-xl">Address</h2>
            <p className="mt-2 text-sm text-primary/80">{restaurant.address}</p>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm font-medium text-gold underline"
            >
              Open in maps
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-serif text-xl">Phone</h2>
            <p className="mt-2 text-sm text-primary/80">Bookings and takeaway orders</p>
            <a
              href={`tel:${tel}`}
              className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Call {restaurant.phone}
            </a>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl">Opening hours</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {hours.map((row) => (
              <li key={row.day} className="flex justify-between border-b border-border pb-2">
                <span className="text-primary/70">{row.day}</span>
                <span className="font-medium">{row.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
