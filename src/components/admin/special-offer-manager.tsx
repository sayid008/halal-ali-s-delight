import { useState, useEffect } from "react";
import {
  type SpecialOffer,
  type SpecialOfferSlide,
  DEFAULT_SLIDES,
  getLocalSpecialOffer,
  fetchSpecialOffer,
  saveSpecialOffer,
} from "@/lib/special-offer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Flame,
  Tag,
  ArrowUpDown,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

export function SpecialOfferManager() {
  const [offer, setOffer] = useState<SpecialOffer>(() => {
    return getLocalSpecialOffer();
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load from API on mount
  useEffect(() => {
    async function loadServerOffer() {
      try {
        const loaded = await fetchSpecialOffer();
        if (loaded) {
          setOffer(loaded);
        }
      } catch (e) {
        console.warn("Could not fetch server special offer:", e);
      }
    }
    loadServerOffer();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSavedSuccess(false);

    try {
      await saveSpecialOffer(offer);

      setSavedSuccess(true);
      toast.success("Special Offer Banners Updated Successfully!", {
        description: "Your home page promotional hero banners are now live.",
      });
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error("Failed to save offer", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  function updateSlide(index: number, updates: Partial<SpecialOfferSlide>) {
    const slides = [...(offer.slides || [])];
    slides[index] = { ...slides[index], ...updates };
    setOffer({ ...offer, slides });
  }

  function addSlide() {
    const slides = [...(offer.slides || [])];
    const newSlide: SpecialOfferSlide = {
      id: "slide-" + Date.now(),
      badge: "Weekend Special Deal",
      title: "New Promotional Combo Platter",
      description:
        "Delicious combination of appetizers, grilled specialities, and freshly baked breads.",
      price: 399,
      original_price: 499,
      image_url:
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80",
    };
    slides.push(newSlide);
    setOffer({ ...offer, slides });
    toast.success("New promotion slide added");
  }

  function removeSlide(index: number) {
    const slides = [...(offer.slides || [])];
    if (slides.length <= 1) {
      toast.error("You must have at least one promotion slide");
      return;
    }
    slides.splice(index, 1);
    setOffer({ ...offer, slides });
    toast.info("Slide removed");
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Control Card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="size-5 text-amber-500" />
                Home Hero Promotional Banner
              </CardTitle>
              <CardDescription className="text-xs">
                Manage high-impact special offer slides, discount combos, and hero carousels shown
                to customers.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 bg-primary text-primary-foreground font-medium text-xs h-9"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-300" />
                    Saved Live!
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    {saving ? "Saving..." : "Save All Offers"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <span className="text-xs font-semibold block">Enable Promo Banner</span>
                <span className="text-[10px] text-muted-foreground">
                  Show hero carousel on website
                </span>
              </div>
              <Switch
                checked={offer.available}
                onCheckedChange={(val) => setOffer({ ...offer, available: val })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <span className="text-xs font-semibold block">Auto-Play Slides</span>
                <span className="text-[10px] text-muted-foreground">
                  Rotate automatically every 5s
                </span>
              </div>
              <Switch
                checked={offer.autoplay !== false}
                onCheckedChange={(val) => setOffer({ ...offer, autoplay: val })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <span className="text-xs font-semibold block">Overlay Backdrop</span>
                <span className="text-[10px] text-muted-foreground">
                  High contrast text overlay
                </span>
              </div>
              <Switch
                checked={offer.show_overlay !== false}
                onCheckedChange={(val) => setOffer({ ...offer, show_overlay: val })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slide Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Flame className="size-4 text-orange-500" />
            Active Carousel Slides ({offer.slides?.length || 0})
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSlide}
            className="h-8 text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Promotion Slide
          </Button>
        </div>

        <div className="space-y-4">
          {(offer.slides || []).map((slide, idx) => (
            <Card key={slide.id || idx} className="border-border/60 overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono bg-background">
                    Slide #{idx + 1}
                  </Badge>
                  <span className="text-xs font-semibold truncate max-w-[200px] sm:max-w-none">
                    {slide.title || "Untitled Slide"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSlide(idx)}
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remove Slide"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left Form (8 cols) */}
                <div className="md:col-span-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium flex items-center gap-1">
                        <Tag className="size-3 text-primary" /> Badge Text
                      </Label>
                      <Input
                        value={slide.badge}
                        onChange={(e) => updateSlide(idx, { badge: e.target.value })}
                        placeholder="e.g. Special Deal, Chef's Choice"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] font-medium">Deal Title *</Label>
                      <Input
                        value={slide.title}
                        onChange={(e) => updateSlide(idx, { title: e.target.value })}
                        placeholder="e.g. Royal Lamb Dum Biryani Feast"
                        className="h-8 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Description</Label>
                    <Textarea
                      rows={2}
                      value={slide.description}
                      onChange={(e) => updateSlide(idx, { description: e.target.value })}
                      placeholder="Details of what is included in the deal..."
                      className="text-xs resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">Deal Price (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={slide.price}
                        onChange={(e) =>
                          updateSlide(idx, { price: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-muted-foreground">
                        Original Price (£)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={slide.original_price || ""}
                        onChange={(e) =>
                          updateSlide(idx, {
                            original_price: parseFloat(e.target.value) || undefined,
                          })
                        }
                        placeholder="e.g. 15.99"
                        className="h-8 text-xs text-muted-foreground line-through"
                      />
                    </div>

                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-medium flex items-center gap-1">
                        <ImageIcon className="size-3 text-muted-foreground" /> Image URL
                      </Label>
                      <Input
                        value={slide.image_url}
                        onChange={(e) => updateSlide(idx, { image_url: e.target.value })}
                        placeholder="https://images.unsplash.com/..."
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Preview (4 cols) */}
                <div className="md:col-span-4 flex flex-col justify-center">
                  <div className="relative rounded-lg overflow-hidden border border-border aspect-video bg-muted flex items-center justify-center group shadow-inner">
                    {slide.image_url ? (
                      <img
                        src={slide.image_url}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageIcon className="size-8 text-muted-foreground/40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5 flex flex-col justify-end text-white">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                        {slide.badge || "PROMO"}
                      </span>
                      <span className="text-xs font-bold leading-tight truncate">
                        {slide.title || "Offer Title"}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-black text-amber-400">
                          £{slide.price.toFixed(2)}
                        </span>
                        {slide.original_price && (
                          <span className="text-[10px] text-white/60 line-through">
                            £{slide.original_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
