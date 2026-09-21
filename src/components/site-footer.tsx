import { restaurant } from "@/data/menu";
import { getRestaurantStatus } from "@/lib/opening-hours";

export function SiteFooter() {
  const status = getRestaurantStatus();

  return (
    <footer className="border-t border-border bg-primary px-6 py-12 text-primary-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <p className="font-serif text-2xl">{restaurant.name}</p>
        <div className="grid gap-6 text-sm sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest opacity-60">Find us</p>
            <a
              href={restaurant.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold hover:underline transition-colors"
              title="Get directions in Google Maps"
            >
              {restaurant.address}
            </a>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-xs uppercase tracking-widest opacity-60">Hours</p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  status.isOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    status.isOpen ? "bg-emerald-400 animate-pulse" : "bg-white/40"
                  }`}
                />
                {status.isOpen ? "Open Now" : "Closed"}
              </span>
            </div>
            <p>{restaurant.hours}</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest opacity-60">Call to order</p>
            <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="underline">
              {restaurant.phone}
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs opacity-60">
          <p>100% halal certified. Dine in or take away, seven days a week.</p>
          <a href="/admin" className="hover:text-gold hover:underline">
            Admin Portal →
          </a>
        </div>
      </div>
    </footer>
  );
}
