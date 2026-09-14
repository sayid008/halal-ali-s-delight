import { restaurant } from "@/data/menu";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-primary px-6 py-12 text-primary-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <p className="font-serif text-2xl">{restaurant.name}</p>
        <div className="grid gap-6 text-sm sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest opacity-60">Find us</p>
            <p>{restaurant.address}</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest opacity-60">Hours</p>
            <p>{restaurant.hours}</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest opacity-60">Call to order</p>
            <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="underline">
              {restaurant.phone}
            </a>
          </div>
        </div>
        <p className="text-xs opacity-60">
          100% halal certified. Dine in or take away, seven days a week.
        </p>
      </div>
    </footer>
  );
}
