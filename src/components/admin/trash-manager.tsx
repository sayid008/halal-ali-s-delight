import { useState } from "react";
import type { DatabaseCategory, DatabaseMenuItem } from "@/lib/supabase";
import { getDaysRemaining } from "@/lib/trash";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FolderOpen,
  UtensilsCrossed,
  Clock,
  ShieldAlert,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TrashManagerProps {
  trashedCategories: DatabaseCategory[];
  trashedItems: DatabaseMenuItem[];
  onRestoreCategory: (catId: string) => void;
  onRestoreItem: (itemId: string) => void;
  onPermanentDeleteCategory: (catId: string) => void;
  onPermanentDeleteItem: (itemId: string) => void;
  onEmptyAllTrash: () => void;
}

export function TrashManager({
  trashedCategories,
  trashedItems,
  onRestoreCategory,
  onRestoreItem,
  onPermanentDeleteCategory,
  onPermanentDeleteItem,
  onEmptyAllTrash,
}: TrashManagerProps) {
  const [activeTab, setActiveTab] = useState<"all" | "items" | "categories">("all");

  const totalTrashCount = trashedCategories.length + trashedItems.length;

  return (
    <div className="space-y-6">
      {/* Top Warning Banner & Actions */}
      <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                <Trash2 className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  Trash & Soft-Delete Retention
                  <Badge variant="outline" className="text-xs font-mono">
                    {totalTrashCount} in trash
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Deleted menu items and categories are safely kept for 30 days before permanent
                  removal. You can restore them anytime.
                </CardDescription>
              </div>
            </div>

            {totalTrashCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5 shrink-0">
                    <Trash2 className="size-3.5" />
                    Empty Trash Forever
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <ShieldAlert className="size-5 text-destructive" />
                      Permanently Empty Trash?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs">
                      This will permanently delete all {totalTrashCount} items and categories
                      currently in the trash bin. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onEmptyAllTrash}
                      className="bg-destructive hover:bg-destructive/90 text-xs"
                    >
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Button
          variant={activeTab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("all")}
          className="h-7 text-xs"
        >
          All ({totalTrashCount})
        </Button>
        <Button
          variant={activeTab === "items" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("items")}
          className="h-7 text-xs"
        >
          Dishes ({trashedItems.length})
        </Button>
        <Button
          variant={activeTab === "categories" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("categories")}
          className="h-7 text-xs"
        >
          Categories ({trashedCategories.length})
        </Button>
      </div>

      {totalTrashCount === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Trash2 className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Trash Bin is Empty</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            When you delete menu items or categories, they will appear here so you can easily
            restore them if needed.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Trashed Categories */}
          {(activeTab === "all" || activeTab === "categories") && trashedCategories.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen className="size-3.5" /> Trashed Categories ({trashedCategories.length})
              </h4>
              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card overflow-hidden">
                {trashedCategories.map((cat) => {
                  const days = getDaysRemaining(cat.deleted_at);
                  return (
                    <div
                      key={cat.id}
                      className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                          <FolderOpen className="size-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-foreground block">
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {days} days remaining
                            </span>
                            <span>•</span>
                            <span className="font-mono">slug: {cat.slug}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRestoreCategory(cat.id)}
                          className="h-7 text-xs gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        >
                          <RotateCcw className="size-3" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onPermanentDeleteCategory(cat.id)}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Delete Forever
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trashed Menu Items */}
          {(activeTab === "all" || activeTab === "items") && trashedItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UtensilsCrossed className="size-3.5" /> Trashed Dishes ({trashedItems.length})
              </h4>
              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card overflow-hidden">
                {trashedItems.map((item) => {
                  const days = getDaysRemaining(item.deleted_at);
                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/20"
                    >
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="size-10 rounded-lg object-cover border border-border shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <UtensilsCrossed className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-semibold text-foreground block">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span className="font-bold text-foreground">
                              £{Number(item.price || 0).toFixed(2)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {days} days remaining
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRestoreItem(item.id)}
                          className="h-7 text-xs gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        >
                          <RotateCcw className="size-3" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onPermanentDeleteItem(item.id)}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Delete Forever
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
