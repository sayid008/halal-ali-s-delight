import { useEffect, useState, useRef } from "react";
import { supabase, type DatabaseMenuItem, type DatabaseCategory } from "@/lib/supabase";
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
import { Loader2, Upload, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DatabaseMenuItem | null;
  categories: DatabaseCategory[];
  defaultCategoryId?: string;
  onSaved: () => void;
}

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  defaultCategoryId,
  onSaved,
}: MenuItemDialogProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("250");
  const [categoryId, setCategoryId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(String(item.price));
      setCategoryId(item.category_id ?? (categories[0]?.id || ""));
      setImageUrl(item.image_url ?? "");
    } else {
      setName("");
      setPrice("250");
      setCategoryId(defaultCategoryId || categories[0]?.id || "");
      setImageUrl("");
    }
  }, [item, open, categories, defaultCategoryId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be under 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage.from("menu-images").getPublicUrl(filePath);

      if (publicData?.publicUrl) {
        setImageUrl(publicData.publicUrl);
        toast.success("Image uploaded successfully!");
      }
    } catch (err: unknown) {
      console.error("Image upload error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to upload image file to storage.";
      toast.error(message);
    } finally {
      setUploadingImage(false);
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
      const payload = {
        name: name.trim(),
        description: item?.description ?? null,
        price: numPrice,
        category_id: categoryId || null,
        image_url: imageUrl.trim() || null,
        available: true,
        sort_order: item?.sort_order ?? 0,
      };

      if (item) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", item.id);

        if (error) throw error;
        toast.success(`"${name}" updated in menu!`);
      } else {
        const { error } = await supabase.from("menu_items").insert(payload);

        if (error) throw error;
        toast.success(`"${name}" added to menu!`);
      }

      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Error saving dish:", err);
      const message = err instanceof Error ? err.message : "Failed to save dish in database";
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
            Enter dish details, category, price in ₹, and upload a dish image.
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
