import { useState } from "react";
import { formatPrice, type DatabaseMenuItem, type DatabaseCategory } from "@/lib/supabase";
import { getDaysRemaining } from "@/lib/trash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RotateCcw,
  Trash2,
  Clock,
  ShieldCheck,
  ImageIcon,
  UtensilsCrossed,
  Layers,
} from "lucide-react";

interface TrashManagerProps {
  trashedItems: DatabaseMenuItem[];
  trashedCategories: DatabaseCategory[];
  categoryMap: Map<string, string>;
  onRestoreItem: (item: DatabaseMenuItem) => Promise<void>;
  onRestoreCategory: (cat: DatabaseCategory) => Promise<void>;
  onPermanentDeleteItem: (item: DatabaseMenuItem) => Promise<void>;
  onPermanentDeleteCategory: (cat: DatabaseCategory) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

export function TrashManager({
  trashedItems,
  trashedCategories,
  categoryMap,
  onRestoreItem,
  onRestoreCategory,
  onPermanentDeleteItem,
  onPermanentDeleteCategory,
  onEmptyTrash,
}: TrashManagerProps) {
  const [filterType, setFilterType] = useState<"all" | "items" | "categories">("all");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const totalTrashedCount = trashedItems.length + trashedCategories.length;

  const showItems = filterType === "all" || filterType === "items";
  const showCategories = filterType === "all" || filterType === "categories";

  async function handleEmptyTrashConfirm() {
    if (totalTrashedCount === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete all ${totalTrashedCount} items in the trash? This cannot be undone.`,
      )
    ) {
      return;
    }

    setActionInProgress("empty_all");
    try {
      await onEmptyTrash();
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Informational Banner */}
      <div className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                Admin Trash Category
                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                  Hidden from Visitors
                </Badge>
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Deleted dishes and categories are safely stored here for 30 days before permanent
                removal. Website visitors cannot see any items in trash.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {totalTrashedCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmptyTrashConfirm}
                disabled={actionInProgress === "empty_all"}
                className="h-7 px-2.5 text-xs gap-1.5"
                title="Permanently remove all items in trash"
              >
                <Trash2 className="size-3" />
                <span>Empty Trash ({totalTrashedCount})</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50 text-xs">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${
              filterType === "all"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Trash ({totalTrashedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("items")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${
              filterType === "items"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dishes ({trashedItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("categories")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium ${
              filterType === "categories"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Categories ({trashedCategories.length})
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground hidden sm:inline flex items-center gap-1">
          <Clock className="size-3 text-muted-foreground/70" />
          Auto-purges after 30 days
        </span>
      </div>

      {/* Empty Trash State */}
      {totalTrashedCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-10 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-muted/80 text-muted-foreground/60 mb-2">
            <Trash2 className="size-5" />
          </div>
          <p className="text-xs font-medium text-foreground">Trash is empty</p>
          <p className="mt-1 text-[11px] text-muted-foreground max-w-sm mx-auto">
            When you delete menu items or categories, they will be preserved here for 30 days with
            full restore options.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TRASHED CATEGORIES SECTION */}
          {showCategories && trashedCategories.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 px-0.5">
                <Layers className="size-3.5 text-primary" />
                Trashed Categories ({trashedCategories.length})
              </h4>

              <div className="space-y-2">
                {trashedCategories.map((cat) => {
                  const daysLeft = getDaysRemaining(cat.deleted_at);
                  const isUrgent = daysLeft <= 5;
                  const isProcessing = actionInProgress === `cat-${cat.id}`;

                  return (
                    <div
                      key={cat.id}
                      className="rounded-lg border border-border/60 bg-card p-2.5 sm:p-3 transition-colors hover:border-amber-500/30"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs text-foreground truncate">
                              {cat.name}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground truncate">
                              /{cat.slug}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 font-normal shrink-0 ${
                                isUrgent
                                  ? "border-destructive/40 text-destructive bg-destructive/5"
                                  : "border-amber-500/40 text-amber-500 bg-amber-500/5"
                              }`}
                            >
                              <Clock className="size-2.5 mr-1" />
                              Auto-deletes in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Deleted on:{" "}
                            {cat.deleted_at
                              ? new Date(cat.deleted_at).toLocaleDateString()
                              : "Recently"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={async () => {
                              setActionInProgress(`cat-${cat.id}`);
                              try {
                                await onRestoreCategory(cat);
                              } finally {
                                setActionInProgress(null);
                              }
                            }}
                            className="h-7 px-2.5 text-xs gap-1 text-primary hover:bg-primary/10 border-primary/30"
                            title="Restore category to active menu"
                          >
                            <RotateCcw className="size-3" />
                            <span>Restore</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isProcessing}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Permanently delete category "${cat.name}"? This cannot be undone.`,
                                )
                              )
                                return;
                              setActionInProgress(`cat-${cat.id}`);
                              try {
                                await onPermanentDeleteCategory(cat);
                              } finally {
                                setActionInProgress(null);
                              }
                            }}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete permanently right now"
                          >
                            <Trash2 className="size-3" />
                            <span className="hidden xs:inline ml-1">Delete Forever</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TRASHED DISHES SECTION */}
          {showItems && trashedItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 px-0.5 pt-1">
                <UtensilsCrossed className="size-3.5 text-primary" />
                Trashed Dishes ({trashedItems.length})
              </h4>

              <div className="space-y-2">
                {trashedItems.map((item) => {
                  const daysLeft = getDaysRemaining(item.deleted_at);
                  const isUrgent = daysLeft <= 5;
                  const isProcessing = actionInProgress === `item-${item.id}`;

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border/60 bg-card p-2.5 sm:p-3 transition-colors hover:border-amber-500/30"
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="size-full object-cover opacity-80"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-muted-foreground">
                              <ImageIcon className="size-3.5 opacity-40" />
                            </div>
                          )}
                        </div>

                        {/* Item Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h5 className="font-medium text-xs text-foreground truncate">
                              {item.name}
                            </h5>
                            <span className="font-semibold text-xs text-gold">
                              {formatPrice(item.price)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 font-normal shrink-0 ${
                                isUrgent
                                  ? "border-destructive/40 text-destructive bg-destructive/5"
                                  : "border-amber-500/40 text-amber-500 bg-amber-500/5"
                              }`}
                            >
                              <Clock className="size-2.5 mr-1" />
                              Auto-deletes in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                            </Badge>
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>
                              {item.category_id
                                ? categoryMap.get(item.category_id) || "Category"
                                : "Uncategorized"}
                            </span>
                            <span>•</span>
                            <span>
                              Deleted on:{" "}
                              {item.deleted_at
                                ? new Date(item.deleted_at).toLocaleDateString()
                                : "Recently"}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={async () => {
                              setActionInProgress(`item-${item.id}`);
                              try {
                                await onRestoreItem(item);
                              } finally {
                                setActionInProgress(null);
                              }
                            }}
                            className="h-7 px-2.5 text-xs gap-1 text-primary hover:bg-primary/10 border-primary/30"
                            title="Restore dish to active menu"
                          >
                            <RotateCcw className="size-3" />
                            <span className="hidden xs:inline">Restore</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isProcessing}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Permanently delete "${item.name}"? This cannot be undone.`,
                                )
                              )
                                return;
                              setActionInProgress(`item-${item.id}`);
                              try {
                                await onPermanentDeleteItem(item);
                              } finally {
                                setActionInProgress(null);
                              }
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete dish permanently"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
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
