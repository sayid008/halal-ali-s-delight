import { useState, useRef, useEffect } from "react";
import {
  type SpecialOffer,
  DEFAULT_SPECIAL_OFFER,
  fetchSpecialOffer,
  saveSpecialOffer,
} from "@/lib/special-offer";
import { supabase, formatPrice } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Upload,
  RefreshCw,
  Save,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  ImageIcon,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import heroBiryani from "@/assets/hero-biryani.jpg";
import mixedGrill from "@/assets/dish-mixed-grill.jpg";
import butterChicken from "@/assets/dish-butter-chicken.jpg";
import chickenBiryani from "@/assets/dish-chicken-biryani.jpg";
import lambKarahi from "@/assets/dish-lamb-karahi.jpg";
import seekhKebab from "@/assets/dish-seekh-kebab.jpg";

const PRESET_IMAGES = [
  { name: "Royal Biryani (Default)", src: heroBiryani },
  { name: "Charcoal Mixed Grill", src: mixedGrill },
  { name: "Butter Chicken Feast", src: butterChicken },
  { name: "Dum Chicken Biryani", src: chickenBiryani },
  { name: "Slow-Cooked Lamb Karahi", src: lambKarahi },
  { name: "Flame-Grilled Seekh Kebab", src: seekhKebab },
];

export function SpecialOfferManager() {
  const [offer, setOffer] = useState<SpecialOffer>(DEFAULT_SPECIAL_OFFER);
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

      setOffer((prev) => ({ ...prev, image_url: uploadedUrl }));
      toast.success("Special offer image uploaded successfully!");
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
    if (!offer.title.trim()) {
      toast.error("Please enter a title for the special offer / combo");
      return;
    }

    setSaving(true);
    try {
      await saveSpecialOffer(offer);
      toast.success("Home page Special Offer banner updated successfully!");
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
    toast.info("Reset to default special offer details. Click 'Save Changes' to apply.");
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
            <Sparkles className="size-5 text-gold" />
            <h2 className="font-serif text-lg font-bold">Home Page Special Offer / Combo Banner</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Customize the prominent front banner image reserved for special offers and combo deals
            on the home page.
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
                <span>Hide / Remove Banner</span>
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
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Form Controls */}
        <div className="space-y-5 lg:col-span-6">
          {/* Image Upload Box */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" />
                Banner Image
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Preserves original 16:9 / 4:5 aspect ratio
              </span>
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
                  <Upload className="size-4 text-primary" />
                )}
                <span>{uploading ? "Uploading Image..." : "Upload New Image File"}</span>
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-medium text-muted-foreground">
                Or select from restaurant specialty photos:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_IMAGES.map((preset) => {
                  const isSelected = offer.image_url === preset.src;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setOffer((prev) => ({ ...prev, image_url: preset.src }))}
                      className={`relative overflow-hidden rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
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
                        <div className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm">
                          <Check className="size-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Offer Details Fields */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Flame className="size-4 text-gold" />
              Offer & Combo Details
            </h3>

            {/* Badge & Title */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="offer-badge" className="text-xs">
                  Badge / Tag Label
                </Label>
                <Input
                  id="offer-badge"
                  value={offer.badge}
                  onChange={(e) => setOffer((prev) => ({ ...prev, badge: e.target.value }))}
                  placeholder="e.g. Special Combo Offer"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="offer-title" className="text-xs">
                  Offer / Combo Title *
                </Label>
                <Input
                  id="offer-title"
                  value={offer.title}
                  onChange={(e) => setOffer((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Royal Feast Special Combo"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Description / Combo Items */}
            <div className="space-y-1.5">
              <Label htmlFor="offer-desc" className="text-xs">
                Combo Items & Description
              </Label>
              <textarea
                id="offer-desc"
                rows={3}
                value={offer.description}
                onChange={(e) => setOffer((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="List dishes included in this special combo (e.g. 1x Lamb Biryani, 2x Seekh Kebab, Naan & Raita)"
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Prices in INR */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="offer-price" className="text-xs">
                  Combo Special Price (₹ INR) *
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="offer-price"
                    type="number"
                    min="0"
                    step="1"
                    value={offer.price || ""}
                    onChange={(e) =>
                      setOffer((prev) => ({
                        ...prev,
                        price: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="499"
                    className="h-9 pl-7 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="offer-orig-price" className="text-xs">
                  Original / Regular Price (₹ INR) (Optional)
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="offer-orig-price"
                    type="number"
                    min="0"
                    step="1"
                    value={offer.original_price || ""}
                    onChange={(e) =>
                      setOffer((prev) => ({
                        ...prev,
                        original_price: e.target.value ? parseFloat(e.target.value) : undefined,
                      }))
                    }
                    placeholder="650"
                    className="h-9 pl-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-border flex flex-col gap-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offer.available}
                  onChange={(e) => setOffer((prev) => ({ ...prev, available: e.target.checked }))}
                  className="mt-0.5 size-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-xs font-semibold block">
                    Show Special Offer Banner on Home Page
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    If unchecked, no special offer or image will be shown on the home page (that
                    section is completely left empty / omitted).
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offer.show_overlay}
                  disabled={!offer.available}
                  onChange={(e) =>
                    setOffer((prev) => ({ ...prev, show_overlay: e.target.checked }))
                  }
                  className="mt-0.5 size-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                />
                <div>
                  <span className="text-xs font-semibold block">
                    Show Title & Description Overlay
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    Displays headline text and combo details directly over the banner image
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="space-y-4 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="size-4 text-primary" />
              Live Home Page Preview
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {offer.available ? "Exact home page size & aspect ratio" : "Currently hidden"}
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            {offer.available ? (
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl shadow-md sm:aspect-[16/9]">
                <img
                  src={offer.image_url || heroBiryani}
                  alt={offer.title || "Special Offer"}
                  className="size-full object-cover"
                />

                <div className="absolute inset-0 flex flex-col justify-between rounded-xl bg-gradient-to-t from-black/95 via-black/40 to-black/20 p-4 sm:p-6">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-foreground shadow-sm">
                      <Sparkles className="size-3" />
                      {offer.badge || "Special Combo Offer"}
                    </span>

                    {offer.price ? (
                      <div className="rounded-lg border border-white/20 bg-black/70 px-2.5 py-1 text-right backdrop-blur-md">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-white/70">
                          Combo Price
                        </span>
                        <div className="flex items-baseline justify-end gap-1">
                          <span className="font-serif text-base font-bold text-gold sm:text-xl">
                            {formatPrice(offer.price)}
                          </span>
                          {offer.original_price ? (
                            <span className="text-[11px] text-white/50 line-through">
                              {formatPrice(offer.original_price)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Bottom Row */}
                  <div className="max-w-md space-y-2">
                    {offer.show_overlay && (
                      <>
                        <h4 className="font-serif text-lg font-bold leading-tight text-white drop-shadow-md sm:text-2xl">
                          {offer.title || "Royal Feast Special Combo"}
                        </h4>

                        {offer.description && (
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-white/90 sm:text-xs">
                            {offer.description}
                          </p>
                        )}
                      </>
                    )}

                    <div className="pt-1 flex items-center gap-2">
                      <div className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-gold-foreground shadow-sm">
                        Claim Offer
                      </div>
                      <div className="rounded-full border border-white/30 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white">
                        Full Menu
                      </div>
                    </div>
                  </div>
                </div>
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
                  No special offer is currently active. The home page does not display any image or
                  banner in this section.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOffer((prev) => ({ ...prev, available: true }))}
                  className="mt-4 h-8 gap-1.5 text-xs font-medium"
                >
                  <Sparkles className="size-3.5 text-gold" />
                  <span>Enable Special Offer Banner</span>
                </Button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Changes take effect live on the home page once saved.
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
                <span>Save Banner</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
