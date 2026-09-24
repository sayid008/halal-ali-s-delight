import { useEffect, useState, useRef } from "react";
import type { DatabaseMenuItem, DatabaseCategory } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Image as ImageIcon, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DatabaseMenuItem | null;
  categories: DatabaseCategory[];
  defaultCategoryId?: string;
  onSave: (data: {
    id?: string;
    name: string;
    description: string | null;
    price: number;
    category_id: string | null;
    image_url: string | null;
    available: boolean;
    sort_order: number;
  }) => void | Promise<void>;
}

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  defaultCategoryId,
  onSave,
}: MenuItemDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("250");
  const [categoryId, setCategoryId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [available, setAvailable] = useState<boolean>(true);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setDescription(item.description || "");
      setPrice(String(item.price ?? "250"));
      setCategoryId(item.category_id ?? (categories[0]?.id || ""));
      setImageUrl(item.image_url ?? "");
      setAvailable(item.available !== false);
    } else {
      setName("");
      setDescription("");
      setPrice("250");
      setCategoryId(defaultCategoryId || categories[0]?.id || "");
      setImageUrl("");
      setAvailable(true);
    }
  }, [item, open, categories, defaultCategoryId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setImageUrl(dataUrl);
          toast.success("Dish image uploaded successfully!");
        }
        setUploadingImage(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read image file.");
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to upload image file.");
      setUploadingImage(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a dish name");
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Please provide a valid price in ₹");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: item?.id,
        name: name.trim(),
        description: description.trim() || null,
        price: numPrice,
        category_id: categoryId || null,
        image_url: imageUrl.trim() || null,
        available: available,
        sort_order: item?.sort_order ?? 0,
      });

      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Error saving dish:", err);
      let message = "Failed to save dish";
      if (err && typeof err === "object") {
        const anyErr = err as { message?: string; details?: string; hint?: string };
        message = anyErr.message || anyErr.details || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Menu Dish" : "Add New Dish"}</DialogTitle>
          <DialogDescription>
            Enter dish details, category, price in ₹, visibility status, and dish image.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Dish Name */}
          <div className="space-y-1.5">
            <Label htmlFor="dish-name">Dish Name</Label>
            <Input
              id="dish-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Royal Lamb Biryani"
              required
            />
          </div>

          {/* Dish Description */}
          <div className="space-y-1.5">
            <Label htmlFor="dish-description">Description / Ingredients (Optional)</Label>
            <Input
              id="dish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Tender lamb slow-cooked with aromatic saffron basmati rice"
            />
          </div>

          {/* Category & Price Row (in INR) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dish-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="dish-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dish-price">Price (₹ INR)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="dish-price"
                  type="number"
                  step="any"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="250"
                  className="pl-7 font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Visibility / Active Status Section */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {available ? (
                    <Eye className="size-4 text-emerald-500" />
                  ) : (
                    <EyeOff className="size-4 text-muted-foreground" />
                  )}
                  <span>Visibility Status</span>
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {available
                    ? "Active (Visible on customer menu)"
                    : "Inactive (Hidden from customer menu, safely kept in admin)"}
                </p>
              </div>

              <div className="inline-flex rounded-lg border border-border bg-background p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAvailable(true)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    available
                      ? "bg-emerald-500 text-black shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="size-3" />
                  <span>Active</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAvailable(false)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    !available
                      ? "bg-muted-foreground/30 text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <EyeOff className="size-3" />
                  <span>Inactive</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dish Image File Upload Only */}
          <div className="space-y-2 rounded-xl border border-border bg-background/50 p-3.5">
            <Label className="flex items-center gap-2">
              <ImageIcon className="size-4 text-gold" />
              <span>Dish Image</span>
            </Label>

            {imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
                    title="Remove image"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">Image uploaded</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1.5 h-7 text-xs"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 size-3" />
                    Replace Image File
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      Uploading image...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 size-3.5" />
                      Upload Image File
                    </>
                  )}
                </Button>
                <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                  Upload an image from your computer or phone (PNG, JPG, WEBP)
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploadingImage}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {item ? "Save Changes" : "Add to Menu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
