import { useEffect, useState } from "react";
import { supabase, type DatabaseCategory } from "@/lib/supabase";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: DatabaseCategory | null;
  onSaved: () => void;
}

export function CategoryDialog({ open, onOpenChange, category, onSaved }: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSlug(category.slug);
      setSortOrder(category.sort_order);
    } else {
      setName("");
      setSlug("");
      setSortOrder(0);
    }
  }, [category, open]);

  function handleNameChange(value: string) {
    setName(value);
    if (!category) {
      // Auto generate slug for new categories
      const autoSlug = value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(autoSlug);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Please enter a category name and slug");
      return;
    }

    setSaving(true);
    try {
      if (category) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: name.trim(),
            slug: slug.trim(),
            sort_order: Number(sortOrder),
          })
          .eq("id", category.id);

        if (error) throw error;
        toast.success(`Category "${name}" updated!`);
      } else {
        const { error } = await supabase.from("categories").insert({
          name: name.trim(),
          slug: slug.trim(),
          sort_order: Number(sortOrder),
        });

        if (error) throw error;
        toast.success(`Category "${name}" created!`);
      }

      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Error saving category:", err);
      const message = err instanceof Error ? err.message : "Failed to save category";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "Add New Category"}</DialogTitle>
          <DialogDescription>
            Categories organize dishes on the website and swipeable menu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Category Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Charcoal Grills"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">URL Slug</Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. grill"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-order">Display Order</Label>
            <Input
              id="cat-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              placeholder="0"
            />
            <p className="text-[11px] text-muted-foreground">
              Lower numbers appear first on the menu.
            </p>
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {category ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
