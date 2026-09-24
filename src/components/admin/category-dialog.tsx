import { useState, useEffect } from "react";
import type { DatabaseCategory } from "@/lib/supabase";
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
import { Switch } from "@/components/ui/switch";
import { FolderPlus, Edit3, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: DatabaseCategory | null;
  onSave: (categoryData: {
    id?: string;
    name: string;
    slug: string;
    sort_order: number;
    available: boolean;
  }) => void;
  existingCount: number;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
  existingCount,
}: CategoryDialogProps) {
  const isEditing = Boolean(category);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name || "");
        setSlug(category.slug || "");
        setSortOrder(category.sort_order ?? 0);
        setAvailable(category.available !== false);
      } else {
        setName("");
        setSlug("");
        setSortOrder(existingCount);
        setAvailable(true);
      }
    }
  }, [open, category, existingCount]);

  function handleNameChange(val: string) {
    setName(val);
    if (!isEditing || !slug) {
      // Auto generate slug
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Category name is required");
      return;
    }

    const cleanSlug =
      slug.trim() ||
      cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    onSave({
      id: category?.id,
      name: cleanName,
      slug: cleanSlug,
      sort_order: Number(sortOrder) || 0,
      available,
    });

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {isEditing ? (
              <>
                <Edit3 className="size-4 text-primary" />
                Edit Category
              </>
            ) : (
              <>
                <FolderPlus className="size-4 text-primary" />
                Add New Category
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update category details and menu sorting."
              : "Create a new food or drink section for the menu."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" className="text-xs font-medium">
              Category Name *
            </Label>
            <Input
              id="cat-name"
              placeholder="e.g., Starters, Biryani & Rice, Sizzling Grills"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-9 text-sm"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-slug" className="text-xs font-medium">
                URL Identifier / Slug
              </Label>
              <span className="text-[10px] text-muted-foreground">Used for menu navigation</span>
            </div>
            <Input
              id="cat-slug"
              placeholder="e.g. biryani-rice"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="h-9 text-sm font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-order" className="text-xs font-medium">
                Display Order
              </Label>
              <Input
                id="cat-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center justify-between rounded-lg border border-border p-2.5 h-9">
                <span className="text-xs font-medium">Visible in Menu</span>
                <Switch checked={available} onCheckedChange={setAvailable} />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
            <Sparkles className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              All dishes assigned to this category will automatically appear under this section on
              both Home and Menu pages.
            </span>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5">
              {isEditing ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
