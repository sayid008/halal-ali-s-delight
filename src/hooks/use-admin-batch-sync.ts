import { useState, useRef, useEffect, useCallback } from "react";
import type { DatabaseCategory, DatabaseMenuItem } from "@/lib/supabase";
import { saveLocalMenuSnapshot } from "@/lib/menu-order";
import { syncToSupabaseAsync } from "@/lib/database-menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";

export type SyncStatus = "saved" | "pending" | "syncing" | "error";

interface BatchSyncOptions {
  immediate?: boolean;
  description?: string;
}

interface UseAdminBatchSyncProps {
  initialCategories: DatabaseCategory[];
  initialItems: DatabaseMenuItem[];
  onRollback?: (categories: DatabaseCategory[], items: DatabaseMenuItem[]) => void;
  debounceMs?: number;
}

export function useAdminBatchSync({
  initialCategories,
  initialItems,
  onRollback,
  debounceMs = 350,
}: UseAdminBatchSyncProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // References to track state without triggering re-renders
  const latestCategoriesRef = useRef<DatabaseCategory[]>(initialCategories);
  const latestItemsRef = useRef<DatabaseMenuItem[]>(initialItems);

  // Last confirmed server snapshot for rollback on catastrophic failure
  const lastConfirmedCategoriesRef = useRef<DatabaseCategory[]>(initialCategories);
  const lastConfirmedItemsRef = useRef<DatabaseMenuItem[]>(initialItems);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWritingRef = useRef<boolean>(false);
  const hasQueuedNextWriteRef = useRef<boolean>(false);
  const pendingCountRef = useRef<number>(0);

  // Keep refs in sync when initial values load
  useEffect(() => {
    if (initialCategories.length > 0 || initialItems.length > 0) {
      latestCategoriesRef.current = initialCategories;
      latestItemsRef.current = initialItems;
      lastConfirmedCategoriesRef.current = initialCategories;
      lastConfirmedItemsRef.current = initialItems;
    }
  }, [initialCategories, initialItems]);

  /**
   * Internal function to execute the HTTP batch write to /api/menu/store-all
   */
  const performBatchWrite = useCallback(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    if (isWritingRef.current) {
      hasQueuedNextWriteRef.current = true;
      return { success: true, message: "Queued behind active write" };
    }

    const payloadCategories = [...latestCategoriesRef.current];
    const payloadItems = [...latestItemsRef.current];

    isWritingRef.current = true;
    setSyncStatus("syncing");

    try {
      const response = await fetch("/api/menu/store-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categories: payloadCategories,
          items: payloadItems,
          last_updated: new Date().toISOString(),
          version: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: Failed to write to database`);
      }

      const resData = await response.json();

      // Confirmed saved!
      lastConfirmedCategoriesRef.current = payloadCategories;
      lastConfirmedItemsRef.current = payloadItems;
      pendingCountRef.current = 0;
      setPendingCount(0);
      setLastError(null);
      setSyncStatus("saved");
      const timeStr = new Date().toLocaleTimeString();
      setLastSavedAt(timeStr);

      // Trigger background non-blocking Supabase cloud sync if configured
      if (isSupabaseConfigured) {
        syncToSupabaseAsync(payloadCategories, payloadItems).catch((err) => {
          console.warn("Background Supabase sync notice:", err);
        });
      }

      return {
        success: true,
        message: resData.message || "Batch write committed to database",
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Database write failed";
      console.error("Batch update error:", errMsg);
      setLastError(errMsg);
      setSyncStatus("error");

      return { success: false, message: errMsg };
    } finally {
      isWritingRef.current = false;

      // If changes arrived while this write was in flight, immediately run the next batch
      if (hasQueuedNextWriteRef.current) {
        hasQueuedNextWriteRef.current = false;
        performBatchWrite();
      }
    }
  }, []);

  /**
   * Queue an optimistic update with debounced batch writing
   */
  const queueBatchUpdate = useCallback(
    (
      newCategories: DatabaseCategory[],
      newItems: DatabaseMenuItem[],
      options: BatchSyncOptions = {},
    ) => {
      // 1. Optimistic Update: Instantly update memory refs and local storage snapshot (0ms latency)
      latestCategoriesRef.current = newCategories;
      latestItemsRef.current = newItems;

      // Update local storage and broadcast to customer tabs immediately without firing redundant unbatched network requests
      saveLocalMenuSnapshot(newCategories, newItems, "admin-panel", { skipServerFetch: true });

      // 2. Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // 3. Immediate flush (e.g. modal save, manual Store All click, or explicit immediate flush)
      if (options.immediate) {
        return performBatchWrite();
      }

      // 4. Batch debounced write: Wait debounceMs to consolidate rapid consecutive actions
      pendingCountRef.current += 1;
      setPendingCount(pendingCountRef.current);
      setSyncStatus("pending");

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        performBatchWrite();
      }, debounceMs);

      return Promise.resolve({ success: true, message: "Optimistically queued" });
    },
    [debounceMs, performBatchWrite],
  );

  /**
   * Force an immediate flush of all pending batch changes
   */
  const flushPending = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return performBatchWrite();
  }, [performBatchWrite]);

  /**
   * Rollback optimistically applied changes to the last confirmed server snapshot
   */
  const rollbackToConfirmed = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const confirmedCats = [...lastConfirmedCategoriesRef.current];
    const confirmedItems = [...lastConfirmedItemsRef.current];

    latestCategoriesRef.current = confirmedCats;
    latestItemsRef.current = confirmedItems;
    pendingCountRef.current = 0;
    setPendingCount(0);
    setSyncStatus("saved");
    setLastError(null);

    // Save restored snapshot locally
    saveLocalMenuSnapshot(confirmedCats, confirmedItems, "admin-panel", { skipServerFetch: true });

    if (onRollback) {
      onRollback(confirmedCats, confirmedItems);
    }

    toast.info("Changes rolled back to last confirmed database snapshot");
  }, [onRollback]);

  /**
   * Automatically flush pending batch writes when leaving the page
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceTimerRef.current || pendingCountRef.current > 0) {
        // Send final batch using sendBeacon for guaranteed delivery on unload
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          try {
            const blob = new Blob(
              [
                JSON.stringify({
                  categories: latestCategoriesRef.current,
                  items: latestItemsRef.current,
                  last_updated: new Date().toISOString(),
                  version: 1,
                }),
              ],
              { type: "application/json" },
            );
            navigator.sendBeacon("/api/menu/store-all", blob);
          } catch {
            // fallback
          }
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    syncStatus,
    lastSavedAt,
    pendingCount,
    lastError,
    queueBatchUpdate,
    flushPending,
    rollbackToConfirmed,
    isSaving: syncStatus === "syncing",
    isPending: syncStatus === "pending",
  };
}
