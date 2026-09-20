import { formatPrice } from "@/lib/supabase";

type ItemProps = {
  name: string;
  description?: string;
  price: number | string;
  image?: string | null;
};

export function MenuItemRow({ item }: { item: ItemProps }) {
  const displayPrice = formatPrice(item.price);

  return (
    <div className="flex items-center gap-4">
      {item.image ? (
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          width={512}
          height={512}
          className="size-20 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-muted">
          <span className="font-serif text-xl text-gold">{item.name.charAt(0)}</span>
        </div>
      )}
      <div className="flex flex-1 items-center justify-between gap-3 py-1">
        <h3 className="font-semibold text-primary">{item.name}</h3>
        <div className="flex-1 border-b border-dotted border-border/80" />
        <span className="shrink-0 font-bold text-gold">{displayPrice}</span>
      </div>
    </div>
  );
}
