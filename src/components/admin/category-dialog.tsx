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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const isUUID = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

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
  const [available, setAvailable] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSlug(category.slug);
      setSortOrder(category.sort_order);
      setAvailable(category.available !== false);
    } else {
      setName("");
      setSlug("");
      setSortOrder(0);
      setAvailable(true);
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
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        sort_order: Number(sortOrder),
        available: available,
      };

      if (category) {
        if (isUUID(category.id)) {
          const { error } = await supabase.from("categories").update(payload).eq("id", category.id);

          if (error) throw error;
        } else {
          // If fallback/static ID, try updating by slug or insert
          const { error: updateError } = await supabase
            .from("categories")
            .update(payload)
            .eq("slug", category.slug);

          if (updateError) {
            const { error: insertError } = await supabase.from("categories").insert(payload);
            if (insertError) throw insertError;
          }
        }
        toast.success(`Category "${name}" updated!`);
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
        toast.success(`Category "${name}" created!`);
      }

      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Error saving category:", err);
      let message = "Failed to save category in database";
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
                    ? "Active 👁️ (Visible on customer menu)"
                    : "Inactive 👁️‍🗨️ (Hidden from customer menu, safely kept in admin)"}
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
