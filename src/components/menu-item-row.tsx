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
    <div className="flex items-center gap-3 sm:gap-4 py-1">
      {item.image ? (
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          width={256}
          height={256}
          className="size-14 sm:size-16 shrink-0 rounded-lg object-cover border border-border/40"
        />
      ) : (
        <div className="grid size-14 sm:size-16 shrink-0 place-items-center rounded-lg bg-muted/70 border border-border/40">
          <span className="font-serif text-base sm:text-lg text-gold">{item.name.charAt(0)}</span>
        </div>
      )}
      <div className="flex flex-1 min-w-0 flex-col justify-center">
        <div className="flex items-center justify-between gap-2.5">
          <h3 className="font-medium text-xs sm:text-sm text-foreground truncate">{item.name}</h3>
          <div className="flex-1 min-w-[20px] border-b border-dotted border-border/50" />
          <span className="shrink-0 font-semibold text-xs sm:text-sm text-gold">
            {displayPrice}
          </span>
        </div>
        {item.description ? (
          <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {item.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
