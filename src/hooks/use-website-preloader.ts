import { useState, useEffect, useRef } from "react";
import { usePublicMenu } from "@/hooks/use-public-menu";
import { fetchSpecialOffer, type SpecialOffer, getLocalSpecialOffer } from "@/lib/special-offer";

export function useWebsitePreloader(options?: { minDurationMs?: number; maxTimeoutMs?: number }) {
  // Lowest possible loading time: 0ms artificial delay (renders immediately as soon as data arrives)
  const minDurationMs = options?.minDurationMs ?? 0;
  const maxTimeoutMs = options?.maxTimeoutMs ?? 1500; // 1.5s max cap

  const { sections, loading: menuLoading } = usePublicMenu();
  const [specialOffer, setSpecialOffer] = useState<SpecialOffer | null>(null);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(
    "Loading live menu & special offers from database...",
  );

  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    let isCancelled = false;
    startTimeRef.current = Date.now();

    async function loadAllFromDatabase() {
      try {
        setLoadingStatus("Fetching live categories & dishes from database...");

        // Fetch special offer and database in parallel
        const offerPromise = fetchSpecialOffer().catch(() => getLocalSpecialOffer());

        const fetchedOffer = await offerPromise;
        if (!isCancelled && fetchedOffer) {
          setSpecialOffer(fetchedOffer);
        }

        // If minDurationMs > 0, wait for that threshold; otherwise resolve immediately
        if (minDurationMs > 0) {
          const elapsed = Date.now() - startTimeRef.current;
          const remainingWait = Math.max(0, minDurationMs - elapsed);
          if (remainingWait > 0) {
            await new Promise((resolve) => setTimeout(resolve, remainingWait));
          }
        }

        if (!isCancelled) {
          setIsDatabaseReady(true);
        }
      } catch (err) {
        console.warn("Preloader database fetch warning:", err);
        if (!isCancelled) {
          setIsDatabaseReady(true);
        }
      }
    }

    loadAllFromDatabase();

    // Fast safety fallback timeout
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) {
        setIsDatabaseReady(true);
      }
    }, maxTimeoutMs);

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [minDurationMs, maxTimeoutMs]);

  // Open instantly when database has returned data or ready
  const isReady = isDatabaseReady || (!menuLoading && sections.length > 0);

  return {
    isReady,
    sections,
    specialOffer,
    loadingStatus,
  };
}
