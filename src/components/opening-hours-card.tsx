import { useState, useEffect } from "react";
import {
  WEEKLY_SCHEDULE,
  getRestaurantStatus,
  DEFAULT_RESTAURANT_STATUS,
  type RestaurantStatus,
} from "@/lib/opening-hours";
import { Clock, ChevronDown, ChevronUp, CalendarDays, CheckCircle2 } from "lucide-react";

interface OpeningHoursCardProps {
  variant?: "compact" | "full" | "inline";
  className?: string;
  defaultExpanded?: boolean;
}

export function OpeningHoursCard({
  variant = "full",
  className = "",
  defaultExpanded = false,
}: OpeningHoursCardProps) {
  const [status, setStatus] = useState<RestaurantStatus>(DEFAULT_RESTAURANT_STATUS);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setStatus(getRestaurantStatus());
    // Update live status every 60 seconds
    const interval = setInterval(() => {
      setStatus(getRestaurantStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (variant === "inline") {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${
            status.isOpen
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              status.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
            }`}
          />
          {status.statusText}
        </span>
        <span className="text-muted-foreground">• {status.subText}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-gold shrink-0" />
            <span className="text-xs font-semibold">Hours Today</span>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              status.isOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                status.isOpen ? "bg-emerald-400 animate-pulse" : "bg-white/40"
              }`}
            />
            {status.statusText}
          </span>
        </div>

        <div className="pl-6">
          <p className="text-sm font-medium">
            {status.todaySchedule.openTime} – {status.todaySchedule.closeTime}
          </p>
          <p className="text-xs opacity-70 mt-0.5">{status.subText}</p>
        </div>
      </div>
    );
  }

  // "full" variant for Contact page & detailed sections
  return (
    <div className={`rounded-2xl border border-border bg-card p-6 shadow-xs ${className}`}>
      {/* Header with Live Status Beacon */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Clock className="size-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">Opening Hours</h2>
            <p className="text-xs text-muted-foreground">Serving fresh halal cuisine daily</p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-xs ${
              status.isOpen
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            <span className="relative flex size-2">
              {status.isOpen && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  status.isOpen ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
              />
            </span>
            <span>{status.statusText}</span>
          </span>
        </div>
      </div>

      {/* Today's Highlight Box */}
      <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-gold" />
            <span className="text-xs font-bold uppercase tracking-wider text-gold">
              Today's Schedule ({status.todaySchedule.day})
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">{status.subText}</span>
        </div>
        <p className="mt-1 font-serif text-lg font-bold text-foreground sm:text-xl">
          {status.todaySchedule.openTime} – {status.todaySchedule.closeTime}
        </p>
      </div>

      {/* Weekly Schedule List */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-border text-xs text-muted-foreground font-medium">
          <span>Weekly Schedule</span>
          <span>Dine In & Takeaway</span>
        </div>

        <ul className="divide-y divide-border text-sm">
          {WEEKLY_SCHEDULE.map((day) => {
            const isToday = day.dayIndex === status.currentDayIndex;
            return (
              <li
                key={day.day}
                className={`flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors ${
                  isToday
                    ? "bg-primary/5 font-semibold text-primary"
                    : "text-foreground/80 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{day.day}</span>
                  {isToday && (
                    <span className="rounded-md bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold">
                      Today
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={isToday ? "text-gold font-bold" : "text-foreground font-medium"}>
                    {day.openTime} – {day.closeTime}
                  </span>
                  {isToday && <CheckCircle2 className="size-3.5 text-gold" />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Friendly Note */}
      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
        <p>
          🕒 <strong>Kitchen notice:</strong> Dine-in and takeaways are available all day. Last food
          orders accepted 30 minutes before closing (10:30 PM).
        </p>
      </div>
    </div>
  );
}
