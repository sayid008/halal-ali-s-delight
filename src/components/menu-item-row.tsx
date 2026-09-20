import { formatPrice } from "@/lib/supabase";

type ItemProps = {
  name: string;
  description: string;
  price: number | string;
  image?: string | null;
};

export function MenuItemRow({ item }: { item: ItemProps }) {
  const displayPrice = typeof item.price === "number" ? formatPrice(item.price) : item.price;

  return (
    <div className="flex gap-4">
      {item.image ? (
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          width={512}
          height={512}
          className="size-24 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="grid size-24 shrink-0 place-items-center rounded-xl bg-muted">
          <span className="font-serif text-xl text-gold">{item.name.charAt(0)}</span>
        </div>
      )}
      <div className="flex-1 py-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold">{item.name}</h3>
          <span className="font-bold text-gold">{displayPrice}</span>
        </div>
        <p className="mt-1 text-sm text-primary/70">{item.description}</p>
      </div>
    </div>
  );
}
