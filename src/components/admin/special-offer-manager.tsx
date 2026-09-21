import { useState, useRef, useEffect } from "react";
import {
  type SpecialOffer,
  type SpecialOfferSlide,
  DEFAULT_SPECIAL_OFFER,
  DEFAULT_SLIDES,
  fetchSpecialOffer,
  saveSpecialOffer,
  getOfferSlides,
} from "@/lib/special-offer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecialOfferHeroBanner } from "@/components/special-offer-hero-banner";
import {
  Tag,
  Upload,
  RefreshCw,
  Save,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  ImageIcon,
  Flame,
  Plus,
  Trash2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import heroBiryani from "@/assets/hero-biryani.jpg";
import mixedGrill from "@/assets/dish-mixed-grill.jpg";
import butterChicken from "@/assets/dish-butter-chicken.jpg";
import chickenBiryani from "@/assets/dish-chicken-biryani.jpg";
import lambKarahi from "@/assets/dish-lamb-karahi.jpg";
import seekhKebab from "@/assets/dish-seekh-kebab.jpg";

const PRESET_IMAGES = [
  { name: "Royal Biryani", src: heroBiryani },
  { name: "Charcoal Mixed Grill", src: mixedGrill },
  { name: "Butter Chicken Feast", src: butterChicken },
  { name: "Dum Chicken Biryani", src: chickenBiryani },
  { name: "Slow-Cooked Lamb Karahi", src: lambKarahi },
  { name: "Flame-Grilled Seekh Kebab", src: seekhKebab },
];

export function SpecialOfferManager() {
  const [offer, setOffer] = useState<SpecialOffer>(DEFAULT_SPECIAL_OFFER);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSpecialOffer().then((data) => {
      setOffer(data);
      setLoading(false);
    });
  }, []);

  const slides: SpecialOfferSlide[] = getOfferSlides(offer);
  const currentSlide: SpecialOfferSlide = slides[activeSlideIdx] || slides[0] || DEFAULT_SLIDES[0];

  function updateSlide(idx: number, patch: Partial<SpecialOfferSlide>) {
    setOffer((prev) => {
      const currentSlides = getOfferSlides(prev);
      const updatedSlides = currentSlides.map((s, i) => (i === idx ? { ...s, ...patch } : s));

      return {
        ...prev,
        slides: updatedSlides,
        // Keep top-level in sync with first slide for backward compatibility
        ...(idx === 0
          ? {
              badge: patch.badge ?? prev.badge,
              title: patch.title ?? prev.title,
              description: patch.description ?? prev.description,
              price: patch.price ?? prev.price,
              original_price: patch.original_price ?? prev.original_price,
              image_url: patch.image_url ?? prev.image_url,
            }
          : {}),
      };
    });
  }

  function handleAddSlide() {
    if (slides.length >= 8) {
      toast.error("Maximum 8 special offers / slides allowed");
      return;
    }

    const presetIdx = slides.length % PRESET_IMAGES.length;
    const newSlide: SpecialOfferSlide = {
      id: `slide-${Date.now()}`,
      badge: "Special Combo Offer",
      title: `Special Offer #${slides.length + 1}`,
      description:
        "Delicious chef special combo including fresh naan, aromatic rice and cooling dip.",
      price: 499,
      original_price: 650,
      image_url: PRESET_IMAGES[presetIdx].src,
    };

    setOffer((prev) => {
      const updatedSlides = [...getOfferSlides(prev), newSlide];
      return { ...prev, slides: updatedSlides };
    });

    setActiveSlideIdx(slides.length);
    toast.success(`Special Offer Slide #${slides.length + 1} added!`);
  }

  function handleDeleteSlide(idxToDelete: number) {
    if (slides.length <= 1) {
      toast.error("You must have at least one special offer slide");
      return;
    }

    setOffer((prev) => {
      const updated = getOfferSlides(prev).filter((_, i) => i !== idxToDelete);
      return {
        ...prev,
        slides: updated,
        ...(idxToDelete === 0 && updated[0]
          ? {
              badge: updated[0].badge,
              title: updated[0].title,
              description: updated[0].description,
              price: updated[0].price,
              original_price: updated[0].original_price,
              image_url: updated[0].image_url,
            }
          : {}),
      };
    });

    if (activeSlideIdx >= idxToDelete && activeSlideIdx > 0) {
      setActiveSlideIdx(activeSlideIdx - 1);
    }
    toast.info("Slide removed.");
  }

  function handleMoveSlide(fromIdx: number, direction: "left" | "right") {
    const toIdx = direction === "left" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= slides.length) return;

    setOffer((prev) => {
      const arr = [...getOfferSlides(prev)];
      const temp = arr[fromIdx];
      arr[fromIdx] = arr[toIdx];
      arr[toIdx] = temp;

      return {
        ...prev,
        slides: arr,
        badge: arr[0].badge,
        title: arr[0].title,
        description: arr[0].description,
        price: arr[0].price,
        original_price: arr[0].original_price,
        image_url: arr[0].image_url,
      };
    });

    setActiveSlideIdx(toIdx);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image file must be under 8MB");
      return;
    }

    setUploading(true);
    try {
      let uploadedUrl = "";

      // Try uploading to Supabase Storage if available
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `special-offer-${Date.now()}.${fileExt}`;
        const filePath = `offers/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicData } = supabase.storage.from("menu-images").getPublicUrl(filePath);

          if (publicData?.publicUrl) {
            uploadedUrl = publicData.publicUrl;
          }
        }
      } catch (err) {
        console.warn("Supabase storage upload fallback to local data URL:", err);
      }

      // If storage didn't return a URL, read as Data URL
      if (!uploadedUrl) {
        uploadedUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      updateSlide(activeSlideIdx, { image_url: uploadedUrl });
      toast.success(`Image for Slide #${activeSlideIdx + 1} updated!`);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const message = err instanceof Error ? err.message : "Failed to upload image.";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSave() {
    const currentSlides = getOfferSlides(offer);
    const hasEmptyTitle = currentSlides.some((s) => !s.title.trim());
    if (hasEmptyTitle) {
      toast.error("Please provide a title for all special offer slides.");
      return;
    }

    setSaving(true);
    try {
      await saveSpecialOffer(offer);
      toast.success("Special Offer banner & all slides saved successfully!");
    } catch (err: unknown) {
      console.error("Failed to save offer:", err);
      const message = err instanceof Error ? err.message : "Failed to save special offer.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefault() {
    setOffer(DEFAULT_SPECIAL_OFFER);
    setActiveSlideIdx(0);
    toast.info("Reset to default special offers. Click 'Save Changes' to apply.");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
        <RefreshCw className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-gold" />
            <h2 className="font-serif text-lg font-bold">Home Page Special Offers & Slides</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage multiple special offer images and deals. Visitors can swipe left to browse
            offers, view interactive dots, and claim combos directly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={offer.available ? "outline" : "default"}
            size="sm"
            onClick={() => setOffer((prev) => ({ ...prev, available: !prev.available }))}
            className="h-9 gap-1.5 text-xs"
          >
            {offer.available ? (
              <>
                <EyeOff className="size-3.5 text-muted-foreground" />
                <span>Hide Banner</span>
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                <span>Enable Banner</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefault}
            className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-9 gap-1.5 bg-primary text-xs font-semibold"
          >
            {saving ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>Save All Changes</span>
          </Button>
        </div>
      </div>

      {/* Slide Navigation / Selector Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-gold" />
            <h3 className="text-sm font-semibold">Special Offer Slides ({slides.length})</h3>
            <span className="text-[11px] text-muted-foreground">
              Each slide appears as a dot on the home page
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddSlide}
            disabled={slides.length >= 8}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5 text-gold" />
            <span>Add Slide / Image</span>
          </Button>
        </div>

        {/* Thumbnail Cards for Slides */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {slides.map((s, idx) => {
            const isSelected = idx === activeSlideIdx;
            return (
              <div
                key={s.id || `thumb-${idx}`}
                onClick={() => setActiveSlideIdx(idx)}
                className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-gold ring-2 ring-gold/40 bg-gold/5"
                    : "border-border hover:border-muted-foreground/40 bg-background/50 opacity-80 hover:opacity-100"
                }`}
              >
                {/* Thumbnail Image */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                  <img
                    src={s.image_url || heroBiryani}
                    alt={s.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-xs">
                    #{idx + 1}
                  </span>
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-gold p-1 text-gold-foreground shadow-xs">
                      <Check className="size-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Card details */}
                <div className="p-2">
                  <p className="truncate text-xs font-semibold text-foreground">{s.title}</p>
                  <p className="font-serif text-[11px] font-bold text-gold">
                    ₹{s.price}
                    {s.original_price ? (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground line-through">
                        ₹{s.original_price}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Editor for Selected Slide */}
        <div className="space-y-5 lg:col-span-6">
          {/* Active Slide Header & Order Controls */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-gold-foreground">
                {activeSlideIdx + 1}
              </span>
              <span className="text-xs font-semibold">Editing Slide #{activeSlideIdx + 1}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {slides.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activeSlideIdx === 0}
                    onClick={() => handleMoveSlide(activeSlideIdx, "left")}
                    className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    title="Move Slide Earlier"
                  >
                    Move Left
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activeSlideIdx === slides.length - 1}
                    onClick={() => handleMoveSlide(activeSlideIdx, "right")}
                    className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    title="Move Slide Later"
                  >
                    Move Right
                  </Button>
                </>
              )}

              {slides.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSlide(activeSlideIdx)}
                  className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  title="Delete this slide"
                >
                  <Trash2 className="size-3.5 mr-1" />
                  <span>Delete</span>
                </Button>
              )}
            </div>
          </div>

          {/* Slide Image Box */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="size-4 text-gold" />
                Slide Image
              </Label>
              <span className="text-[11px] text-muted-foreground">Slide #{activeSlideIdx + 1}</span>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Upload Button */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-10 gap-2 border-dashed font-medium text-xs flex-1"
              >
                {uploading ? (
                  <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="size-4 text-gold" />
                )}
                <span>
                  {uploading
                    ? "Uploading Image..."
                    : `Upload Custom Image for Slide #${activeSlideIdx + 1}`}
                </span>
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-medium text-muted-foreground">
                Or pick from restaurant food photography:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_IMAGES.map((preset) => {
                  const isSelected = currentSlide.image_url === preset.src;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => updateSlide(activeSlideIdx, { image_url: preset.src })}
                      className={`relative overflow-hidden rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-gold ring-2 ring-gold/40"
                          : "border-border hover:border-muted-foreground/40 opacity-80 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={preset.src}
                        alt={preset.name}
                        className="h-14 w-full object-cover"
                      />
                      <div className="p-1 text-[10px] font-medium truncate bg-card">
                        {preset.name}
                      </div>
                      {isSelected && (
                        <div className="absolute right-1 top-1 rounded-full bg-gold p-0.5 text-gold-foreground shadow-sm">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Slide Content Fields */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Flame className="size-4 text-gold" />
              Slide Offer Details
            </h3>

            {/* Badge & Title */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`offer-badge-${activeSlideIdx}`} className="text-xs">
                  Badge / Tag Label
                </Label>
                <Input
                  id={`offer-badge-${activeSlideIdx}`}
                  value={currentSlide.badge}
                  onChange={(e) => updateSlide(activeSlideIdx, { badge: e.target.value })}
                  placeholder="e.g. Special Combo Offer"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`offer-title-${activeSlideIdx}`} className="text-xs">
                  Offer / Combo Title *
                </Label>
                <Input
                  id={`offer-title-${activeSlideIdx}`}
                  value={currentSlide.title}
                  onChange={(e) => updateSlide(activeSlideIdx, { title: e.target.value })}
                  placeholder="e.g. Royal Feast Special Combo"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor={`offer-desc-${activeSlideIdx}`} className="text-xs">
                Combo Items & Description
              </Label>
              <textarea
                id={`offer-desc-${activeSlideIdx}`}
                rows={3}
                value={currentSlide.description}
                onChange={(e) => updateSlide(activeSlideIdx, { description: e.target.value })}
                placeholder="Dishes included in this special combo (e.g. 1x Lamb Biryani, 2x Seekh Kebab, Naan & Raita)"
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Prices in INR */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`offer-price-${activeSlideIdx}`} className="text-xs">
                  Combo Price (₹ INR) *
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id={`offer-price-${activeSlideIdx}`}
                    type="number"
                    min="0"
                    step="1"
                    value={currentSlide.price || ""}
                    onChange={(e) =>
                      updateSlide(activeSlideIdx, {
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="499"
                    className="h-9 pl-7 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`offer-orig-${activeSlideIdx}`} className="text-xs">
                  Original Regular Price (₹ INR) (Optional)
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id={`offer-orig-${activeSlideIdx}`}
                    type="number"
                    min="0"
                    step="1"
                    value={currentSlide.original_price || ""}
                    onChange={(e) =>
                      updateSlide(activeSlideIdx, {
                        original_price: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="650"
                    className="h-9 pl-7 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Global Carousel Options */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Display & Carousel Settings</h3>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={offer.available}
                onChange={(e) => setOffer((prev) => ({ ...prev, available: e.target.checked }))}
                className="mt-0.5 size-4 rounded border-gray-300 text-gold focus:ring-gold"
              />
              <div>
                <span className="text-xs font-semibold block">
                  Show Special Offer Banner on Home Page
                </span>
                <span className="text-[11px] text-muted-foreground">
                  If unchecked, the special offer hero section is completely omitted from the home
                  page.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={offer.autoplay ?? true}
                onChange={(e) => setOffer((prev) => ({ ...prev, autoplay: e.target.checked }))}
                className="mt-0.5 size-4 rounded border-gray-300 text-gold focus:ring-gold"
              />
              <div>
                <span className="text-xs font-semibold block">
                  Auto-Advance Slides Automatically
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Transitions to the next special offer every 5.5 seconds (automatically pauses when
                  touched or hovered).
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={offer.show_overlay}
                onChange={(e) => setOffer((prev) => ({ ...prev, show_overlay: e.target.checked }))}
                className="mt-0.5 size-4 rounded border-gray-300 text-gold focus:ring-gold"
              />
              <div>
                <span className="text-xs font-semibold block">
                  Show Title & Description Overlay
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Displays the gold badge, combo title, description, and action buttons directly
                  over the banner image.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="space-y-4 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="size-4 text-gold" />
              Live Interactive Slider Preview
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {offer.available ? "Slide left/right to test gestures" : "Currently hidden"}
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            {offer.available ? (
              <div>
                {/* Embedded Real Slider with swipe, dots, and arrows */}
                <SpecialOfferHeroBanner customSlides={slides} customOverlay={offer.show_overlay} />

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  👆 <strong>Interactive:</strong> Swipe or drag left/right (or tap the dots below)
                  to test sliding between offers.
                </p>
              </div>
            ) : (
              <div className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center sm:aspect-[16/9]">
                <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
                  <EyeOff className="size-6" />
                </div>
                <h4 className="font-serif text-base font-semibold text-foreground">
                  Section Omitted on Home Page
                </h4>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  No special offer is currently active. The home page leaves this section omitted.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOffer((prev) => ({ ...prev, available: true }))}
                  className="mt-4 h-8 gap-1.5 text-xs font-medium"
                >
                  <Tag className="size-3.5 text-gold" />
                  <span>Enable Special Offer Banner</span>
                </Button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {slides.length} {slides.length === 1 ? "offer" : "offers"} ready to display.
              </span>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-8 gap-1.5 bg-primary text-xs font-semibold"
              >
                {saving ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>Save All Changes</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
