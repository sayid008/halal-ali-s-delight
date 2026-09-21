import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OpeningHoursCard } from "@/components/opening-hours-card";
import { restaurant } from "@/data/menu";
import { MapPin, ArrowUpRight, Phone } from "lucide-react";

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
              href={restaurant.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-4 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold hover:text-gold-foreground"
            >
              <MapPin className="size-3.5" />
              <span>Get Directions in Maps</span>
              <ArrowUpRight className="size-3" />
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

        <div className="mt-6">
          <OpeningHoursCard />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
