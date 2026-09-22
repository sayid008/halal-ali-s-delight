import { useState } from "react";
import { formatPrice, type DatabaseMenuItem, type DatabaseCategory } from "@/lib/supabase";
import {
  getDaysRemaining,
  SUPABASE_TRASH_SQL,
  SUPABASE_STORAGE_SQL,
  SUPABASE_COMPLETE_BACKEND_SETUP_SQL,
} from "@/lib/trash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  RotateCcw,
  Trash2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Code,
  Copy,
  Check,
  ImageIcon,
  UtensilsCrossed,
  Layers,
  Database,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";

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
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [sqlTab, setSqlTab] = useState<"complete" | "storage" | "database">("complete");
  const [copied, setCopied] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const totalTrashedCount = trashedItems.length + trashedCategories.length;

  const showItems = filterType === "all" || filterType === "items";
  const showCategories = filterType === "all" || filterType === "categories";

  const currentSqlText =
    sqlTab === "complete"
      ? SUPABASE_COMPLETE_BACKEND_SETUP_SQL
      : sqlTab === "storage"
        ? SUPABASE_STORAGE_SQL
        : SUPABASE_TRASH_SQL;

  function handleCopySQL() {
    navigator.clipboard.writeText(currentSqlText);
    setCopied(true);
    toast.success("SQL script copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  }

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSqlModalOpen(true)}
              className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-border/80"
              title="View PostgreSQL / Supabase SQL for Database"
            >
              <Code className="size-3" />
              <span>Database SQL</span>
            </Button>

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

      {/* SQL Setup Modal */}
      <Dialog open={sqlModalOpen} onOpenChange={setSqlModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Code className="size-4 text-primary" />
              Supabase Backend & Storage SQL Scripts
            </DialogTitle>
            <DialogDescription className="text-xs">
              Run this SQL script in your Supabase SQL Editor (SQL Editor &gt; New Query &gt; Run)
              to set up database tables, soft-delete trash purging, and image storage buckets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Script Tab Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/70 p-1 text-xs border border-border/60">
              <button
                type="button"
                onClick={() => setSqlTab("complete")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all ${
                  sqlTab === "complete"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Database className="size-3 text-gold" />
                <span>Complete Setup (All-in-One)</span>
              </button>
              <button
                type="button"
                onClick={() => setSqlTab("storage")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all ${
                  sqlTab === "storage"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HardDrive className="size-3 text-emerald-500" />
                <span>Image Storage Bucket Only</span>
              </button>
              <button
                type="button"
                onClick={() => setSqlTab("database")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all ${
                  sqlTab === "database"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3 text-primary" />
                <span>Tables &amp; Trash Only</span>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
              <span className="font-medium text-foreground">
                {sqlTab === "complete"
                  ? "Full PostgreSQL Schema + Trash Purge + Storage Policies"
                  : sqlTab === "storage"
                    ? 'Storage Bucket ("menu-images") & RLS Policies'
                    : "Tables, Indexes, RLS & 30-Day Auto Purge"}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopySQL}
                className="h-6 px-2 text-[11px] gap-1"
              >
                {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                <span>{copied ? "Copied!" : "Copy SQL"}</span>
              </Button>
            </div>

            <pre className="overflow-x-auto max-h-[380px] rounded-lg bg-zinc-950 p-3 text-[11px] font-mono text-zinc-100 border border-border/40 leading-relaxed">
              <code>{currentSqlText}</code>
            </pre>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <AlertTriangle className="size-3.5 text-amber-500" />
                Supabase Setup Steps:
              </p>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                <li>
                  Open your Supabase Project Dashboard and go to the <strong>SQL Editor</strong> tab
                  on the left.
                </li>
                <li>
                  Click <strong>New query</strong>, paste the script copied above, and click{" "}
                  <strong>Run</strong>.
                </li>
                <li>
                  Your <code className="text-foreground">menu-images</code> storage bucket and
                  database tables are now ready to handle high-speed image uploads and live menu
                  sync.
                </li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
