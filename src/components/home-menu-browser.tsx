import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MenuSection } from "@/data/menu";
import { MenuItemRow } from "@/components/menu-item-row";
import heroBiryani from "@/assets/hero-biryani.jpg";

type Category = {
  id: string;
  label: string;
  image: string;
};

export function HomeMenuBrowser({ sections }: { sections: MenuSection[] }) {
  const [selected, setSelected] = useState("all");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const categories: Category[] = [
    { id: "all", label: "All Items", image: heroBiryani },
    ...sections.map((section) => ({
      id: section.id,
      label: section.title,
      image: section.items.find((item) => item.image)?.image ?? heroBiryani,
    })),
  ];
  const visibleSections = selected === "all" ? sections : sections.filter(({ id }) => id === selected);

  function scrollCategories(direction: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  return (
    <section aria-labelledby="home-menu-heading" className="border-y border-border bg-card py-10">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="home-menu-heading" className="font-serif text-2xl sm:text-3xl">
            What’s Your Mood?
          </h2>
          <div className="hidden gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Scroll categories left"
              onClick={() => scrollCategories(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Scroll categories right"
              onClick={() => scrollCategories(1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-3 overscroll-x-contain scroll-smooth touch-pan-x sm:mx-0 sm:px-0"
        >
          {categories.map((category) => {
            const isSelected = category.id === selected;
            return (
              <Button
                key={category.id}
                type="button"
                variant="ghost"
                aria-pressed={isSelected}
                onClick={(event) => {
                  setSelected(category.id);
                  event.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }}
                className="h-auto w-24 shrink-0 snap-start flex-col gap-3 rounded-none bg-transparent p-0 shadow-none hover:bg-transparent sm:w-28"
              >
                <span
                  className={`block aspect-square w-full overflow-hidden rounded-full border-2 bg-muted p-1 transition-colors ${
                    isSelected ? "border-gold" : "border-transparent"
                  }`}
                >
                  <img
                    src={category.image}
                    alt=""
                    width={160}
                    height={160}
                    loading="lazy"
                    className="size-full rounded-full object-cover"
                  />
                </span>
                <span className={`w-full whitespace-normal text-center text-sm ${isSelected ? "font-bold text-gold" : "text-primary"}`}>
                  {category.label}
                </span>
              </Button>
            );
          })}
        </div>

        <div aria-live="polite" className="mt-10 space-y-10">
          {visibleSections.map((section) => (
            <div key={section.id} className="space-y-6">
              <h3 className="font-serif text-2xl">{section.title}</h3>
              <div className="grid gap-6 md:grid-cols-2 md:gap-x-10">
                {section.items.map((item) => (
                  <MenuItemRow key={item.name} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}