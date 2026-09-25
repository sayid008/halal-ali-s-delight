import { useState, useEffect, useRef } from "react";
import { usePublicMenu } from "@/hooks/use-public-menu";
import { fetchSpecialOffer, type SpecialOffer, getLocalSpecialOffer } from "@/lib/special-offer";

export function useWebsitePreloader(options?: { minDurationMs?: number; maxTimeoutMs?: number }) {
  const minDurationMs = options?.minDurationMs ?? 2000; // 2 seconds minimum loading for smooth database fetch
  const maxTimeoutMs = options?.maxTimeoutMs ?? 4000; // 4 seconds max timeout

  const { sections, loading: menuLoading } = usePublicMenu();
  const [specialOffer, setSpecialOffer] = useState<SpecialOffer | null>(null);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(
    "Loading dishes, categories & special offers from database...",
  );

  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    let isCancelled = false;
    startTimeRef.current = Date.now();

    async function loadAllFromDatabase() {
      try {
        setLoadingStatus("Fetching live categories & dishes from database...");

        // Fetch special offer from database in parallel
        const offerPromise = fetchSpecialOffer().catch(() => getLocalSpecialOffer());

        const fetchedOffer = await offerPromise;
        if (!isCancelled && fetchedOffer) {
          setSpecialOffer(fetchedOffer);
        }

        setLoadingStatus("Finalizing menu & special offers...");

        // Ensure smooth 2-4 second window for database sync
        const elapsed = Date.now() - startTimeRef.current;
        const remainingWait = Math.max(0, minDurationMs - elapsed);

        if (remainingWait > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingWait));
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

    // Safety fallback timeout to never leave page stuck
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

  const isReady = isDatabaseReady && (!menuLoading || sections.length > 0);

  return {
    isReady,
    sections,
    specialOffer,
    loadingStatus,
  };
}
