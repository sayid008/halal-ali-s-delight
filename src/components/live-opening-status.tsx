import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { getRestaurantStatus, type RestaurantStatus } from "@/lib/opening-hours";
import { Clock, ChevronRight } from "lucide-react";

export function LiveOpeningStatus() {
  const [status, setStatus] = useState<RestaurantStatus | null>(null);

  useEffect(() => {
    setStatus(getRestaurantStatus());
    const interval = setInterval(() => {
      setStatus(getRestaurantStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = status ? status.isOpen : true;
  const statusText = status ? status.statusText : "Open Daily";
  const openTime = status ? status.todaySchedule.openTime : "12:00 PM";
  const closeTime = status ? status.todaySchedule.closeTime : "11:00 PM";

  return (
    <div className="flex items-start gap-3.5 border-t border-border pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-0">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
        <Clock className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Opening Hours
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isOpen
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
              }`}
            />
            {statusText}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          Today: {openTime} – {closeTime}
        </p>
        <Link
          to="/contact"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
        >
          <span>View weekly schedule</span>
          <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
