import { useState, useEffect } from "react";
import type { DatabaseMenuItem, DatabaseCategory } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UtensilsCrossed, Edit2, ImageIcon, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Preset food image gallery for quick selection
const FOOD_IMAGE_PRESETS = [
  {
    label: "Biryani Feast",
    url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Tandoori Grill",
    url: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Butter Chicken",
    url: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Seekh Kebabs",
    url: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Garlic Naan",
    url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Samosas / Starters",
    url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Lamb Karahi",
    url: "https://images.unsplash.com/photo-1545247181-516773cae754?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Mango Lassi / Drinks",
    url: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=800&auto=format&fit=crop&q=80",
  },
];

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DatabaseMenuItem | null;
  categories: DatabaseCategory[];
  onSave: (itemData: {
    id?: string;
    name: string;
    description: string;
    price: number;
    category_id: string | null;
    image_url: string | null;
    available: boolean;
    sort_order: number;
  }) => void;
  existingCount: number;
}

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  onSave,
  existingCount,
}: MenuItemDialogProps) {
  const isEditing = Boolean(item);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("0.00");
  const [categoryId, setCategoryId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [available, setAvailable] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  const activeCategories = categories.filter((c) => !c.deleted_at);

  useEffect(() => {
    if (open) {
      if (item) {
        setName(item.name || "");
        setDescription(item.description || "");
        setPrice(item.price !== undefined ? String(item.price) : "0.00");
        setCategoryId(item.category_id || (activeCategories[0]?.id ?? ""));
        setImageUrl(item.image_url || "");
        setAvailable(item.available !== false);
        setSortOrder(item.sort_order ?? 0);
      } else {
        setName("");
        setDescription("");
        setPrice("9.95");
        setCategoryId(activeCategories[0]?.id ?? "");
        setImageUrl(FOOD_IMAGE_PRESETS[0].url);
        setAvailable(true);
        setSortOrder(existingCount);
      }
    }
  }, [open, item, existingCount]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Dish name is required");
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    onSave({
      id: item?.id,
      name: cleanName,
      description: description.trim(),
      price: Math.round(numPrice * 100) / 100,
      category_id: categoryId || null,
      image_url: imageUrl.trim() || null,
      available,
      sort_order: Number(sortOrder) || 0,
    });

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {isEditing ? (
              <>
                <Edit2 className="size-4 text-primary" />
                Edit Dish Details
              </>
            ) : (
              <>
                <UtensilsCrossed className="size-4 text-primary" />
                Add New Dish to Menu
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update dish pricing, description, category, and availability."
              : "Create a new delicious dish for your customers."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Dish Name */}
          <div className="space-y-1.5">
            <Label htmlFor="dish-name" className="text-xs font-medium">
              Dish Name *
            </Label>
            <Input
              id="dish-name"
              placeholder="e.g., Royal Lamb Dum Biryani, Chicken Tikka Masala"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              autoFocus
              required
            />
          </div>

          {/* Category & Price Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dish-price" className="text-xs font-medium">
                Price (£) *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground">
                  £
                </span>
                <Input
                  id="dish-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="9.95"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-7 h-9 text-sm font-semibold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="dish-desc" className="text-xs font-medium">
              Description & Ingredients
            </Label>
            <Textarea
              id="dish-desc"
              rows={2}
              placeholder="Fragrant basmati rice slow-cooked with marinated tender lamb, saffron, caramelized onions, and authentic spices..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {/* Image URL & Quick Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dish-img" className="text-xs font-medium flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-muted-foreground" />
                Image URL
              </Label>
              <span className="text-[10px] text-muted-foreground">Direct link or preset</span>
            </div>
            <Input
              id="dish-img"
              placeholder="https://images.unsplash.com/..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="h-9 text-xs font-mono"
            />

            {/* Quick Image Gallery Buttons */}
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-amber-500" /> Quick select dish photos:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 rounded-md bg-muted/40 border border-border/50">
                {FOOD_IMAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className={`text-[11px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                      imageUrl === preset.url
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "bg-background hover:bg-muted text-foreground border-border/60"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Preview */}
            {imageUrl && (
              <div className="mt-2 flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/20">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="size-12 rounded object-cover border border-border"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="text-[11px] text-muted-foreground truncate">
                  <span className="font-medium text-foreground block">Image Preview</span>
                  <span className="truncate block max-w-[340px]">{imageUrl}</span>
                </div>
              </div>
            )}
          </div>

          {/* Availability & Sorting */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between rounded-lg border border-border p-2.5 h-11">
              <div>
                <span className="text-xs font-medium block">Available / In Stock</span>
                <span className="text-[10px] text-muted-foreground">Customer can order</span>
              </div>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dish-sort" className="text-[11px] font-medium">
                Display Order
              </Label>
              <Input
                id="dish-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="h-11 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5 font-medium">
              {isEditing ? "Update Dish" : "Add Dish to Menu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
