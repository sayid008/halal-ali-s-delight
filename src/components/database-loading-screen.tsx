import { useState, useEffect } from "react";
import { UtensilsCrossed, Sparkles, CheckCircle2 } from "lucide-react";

interface DatabaseLoadingScreenProps {
  status?: string;
  isReady?: boolean;
}

export function DatabaseLoadingScreen({
  status = "Fetching live menu and special offers from database...",
  isReady = false,
}: DatabaseLoadingScreenProps) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(2), 600);
    const t2 = setTimeout(() => setStep(3), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 text-foreground">
      {/* Background Decorative Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col items-center text-center">
        {/* Animated Brand Emblem */}
        <div className="relative mb-6 flex size-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-gold/20 duration-1000" />
          <div className="relative flex size-16 items-center justify-center rounded-full border border-gold/40 bg-card shadow-xl shadow-gold/10">
            <UtensilsCrossed className="size-7 text-gold animate-pulse" />
          </div>
        </div>

        {/* Restaurant Title */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gold">
            Authentic Halal Cuisine
          </span>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Halal Ali
          </h2>
          <p className="text-xs text-muted-foreground">Dine Inn & Take Away</p>
        </div>

        {/* Progress Bar */}
        <div className="mt-8 w-full max-w-xs space-y-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-linear-to-r from-gold/60 to-gold transition-all duration-500 ease-out"
              style={{
                width: isReady ? "100%" : step === 1 ? "35%" : step === 2 ? "70%" : "90%",
              }}
            />
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 text-xs font-medium text-muted-foreground">
            {isReady ? (
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            ) : (
              <Sparkles className="size-3.5 text-gold animate-spin" />
            )}
            <span className="truncate">
              {isReady
                ? "Database connected & loaded"
                : step === 1
                  ? "Connecting to database..."
                  : step === 2
                    ? "Fetching categories & menu dishes..."
                    : status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
