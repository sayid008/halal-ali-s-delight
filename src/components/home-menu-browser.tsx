import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
    <section aria-labelledby="home-menu-heading" className="bg-card py-10">
      <div className="mx-auto max-w-5xl px-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="px-5 pt-6 sm:px-7">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 id="home-menu-heading" className="font-serif text-2xl sm:text-3xl">
                Menu
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
              className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-5 overscroll-x-contain scroll-smooth touch-pan-x sm:-mx-7 sm:px-7"
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
          </div>

          <div className="h-px w-full bg-border" />

          <div aria-live="polite" className="space-y-8 px-5 py-6 sm:px-7">
            {visibleSections.map((section) => (
              <div key={section.id} className="space-y-5">
                <h3 className="font-serif text-2xl">{section.title}</h3>
                <div className="grid gap-6 md:grid-cols-2 md:gap-x-10">
                  {section.items.map((item) => (
                    <MenuItemRow key={item.name} item={item} />
                  ))}
                </div>
              </div>
            ))}

            <Link
              to="/menu"
              className="flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-bold text-gold-foreground shadow-lg"
            >
              View Full Menu
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
