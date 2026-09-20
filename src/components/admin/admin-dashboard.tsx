import { useCallback, useEffect, useState } from "react";
import { supabase, formatPrice, type DatabaseMenuItem, type DatabaseCategory } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  LogOut,
  UtensilsCrossed,
  Upload,
} from "lucide-react";

type EditState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category_id: string;
  image_url: string;
  available: boolean;
};

const emptyForm: EditState = {
  name: "",
  description: "",
  price: "",
  category_id: "",
  image_url: "",
  available: true,
};

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<DatabaseMenuItem[]>([]);
  const [categories, setCategories] = useState<DatabaseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [itemRes, catRes] = await Promise.all([
      supabase.from("menu_items").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    if (itemRes.data) setItems(itemRes.data as DatabaseMenuItem[]);
    if (catRes.data) setCategories(catRes.data as DatabaseCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openAdd() {
    setEditForm({ ...emptyForm, category_id: categories[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(item: DatabaseMenuItem) {
    setEditForm({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category_id: item.category_id ?? "",
      image_url: item.image_url ?? "",
      available: item.available,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editForm.name.trim() || !editForm.category_id) {
      toast.error("Name and category are required");
      return;
    }
    setSaving(true);
    const payload = {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      price: Number(editForm.price) || 0,
      category_id: editForm.category_id,
      image_url: editForm.image_url || null,
      available: editForm.available,
    };

    if (editForm.id) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", editForm.id);
      if (error) toast.error("Failed to update item");
      else toast.success("Item updated");
    } else {
      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) toast.error("Failed to add item");
      else toast.success("Item added");
    }

    setSaving(false);
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) toast.error("Failed to delete item");
    else toast.success("Item deleted");
    setDeleteId(null);
    loadData();
  }

  async function moveItem(id: string, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((i) => i.id === id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const a = sorted[index];
    const b = sorted[swapIndex];
    await Promise.all([
      supabase.from("menu_items").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("menu_items").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    loadData();
  }

  async function toggleAvailable(item: DatabaseMenuItem) {
    const { error } = await supabase
      .from("menu_items")
      .update({ available: !item.available })
      .eq("id", item.id);
    if (error) toast.error("Failed to update");
    else loadData();
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
    setEditForm((f) => ({ ...f, image_url: urlData.publicUrl }));
    toast.success("Image uploaded");
    setUploading(false);
  }

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-5 text-gold" />
            <h1 className="font-serif text-lg font-bold">Menu Admin</h1>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="mr-2 size-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl">Menu Items</h2>
            <p className="text-sm text-muted-foreground">{items.length} items across {categories.length} categories</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add Item
          </Button>
        </div>

        {/* Items list */}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-xl border bg-card p-4"
            >
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="size-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted">
                  <span className="font-serif text-lg text-gold">{item.name.charAt(0)}</span>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{item.name}</h3>
                  {!item.available && (
                    <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-bold text-gold">{formatPrice(Number(item.price))}</span>
                  <span>{categoryName(item.category_id)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => moveItem(item.id, -1)} disabled={idx === 0} title="Move up">
                  <ArrowUp className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => moveItem(item.id, 1)} disabled={idx === items.length - 1} title="Move down">
                  <ArrowDown className="size-4" />
                </Button>
                <Switch checked={item.available} onCheckedChange={() => toggleAvailable(item)} title="Toggle availability" />
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} title="Delete" className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              No menu items yet. Click "Add Item" to get started.
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editForm.id ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex items-center gap-4">
                {editForm.image_url ? (
                  <img src={editForm.image_url} alt="Preview" className="size-20 rounded-lg object-cover" />
                ) : (
                  <div className="grid size-20 place-items-center rounded-lg bg-muted">
                    <Upload className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                  {uploading && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Loader2 className="mr-1 inline size-3 animate-spin" />
                      Uploading...
                    </p>
                  )}
                  {editForm.image_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-destructive"
                      onClick={() => setEditForm((f) => ({ ...f, image_url: "" }))}
                    >
                      Remove image
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Dish name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input id="price" type="number" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editForm.category_id} onValueChange={(v) => setEditForm((f) => ({ ...f, category_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={editForm.available} onCheckedChange={(v) => setEditForm((f) => ({ ...f, available: v }))} />
              <Label>Available to customers</Label>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this menu item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item will be permanently removed from your menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
