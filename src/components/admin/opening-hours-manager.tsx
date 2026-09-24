import { useState, useEffect } from "react";
import {
  type DaySchedule,
  WEEKLY_SCHEDULE,
  getOpeningScheduleFromStorage,
  saveOpeningScheduleToStorage,
  getEmergencyOverrideFromStorage,
  saveEmergencyOverrideToStorage,
  getSpecialAnnouncementFromStorage,
  saveSpecialAnnouncementToStorage,
} from "@/lib/opening-hours";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Save,
  AlertTriangle,
  Megaphone,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export function OpeningHoursManager() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => {
    return getOpeningScheduleFromStorage() || WEEKLY_SCHEDULE;
  });

  const [emergencyClose, setEmergencyClose] = useState<boolean>(() => {
    return getEmergencyOverrideFromStorage();
  });

  const [announcement, setAnnouncement] = useState<string>(() => {
    return getSpecialAnnouncementFromStorage();
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadServerConfig() {
      try {
        const res = await fetch("/api/opening-hours");
        if (res.ok) {
          const data = await res.json();
          if (data.schedule && Array.isArray(data.schedule)) {
            setSchedule(data.schedule);
          }
          if (typeof data.emergencyClose === "boolean") {
            setEmergencyClose(data.emergencyClose);
          }
          if (typeof data.announcement === "string") {
            setAnnouncement(data.announcement);
          }
        }
      } catch (e) {
        console.warn("Could not fetch server opening hours:", e);
      }
    }
    loadServerConfig();
  }, []);

  function handleUpdateDay(index: number, updates: Partial<DaySchedule>) {
    const updated = [...schedule];
    updated[index] = { ...updated[index], ...updates };
    setSchedule(updated);
  }

  async function handleSave() {
    setSaving(true);
    setSavedSuccess(false);

    try {
      // 1. Save to local storage
      saveOpeningScheduleToStorage(schedule);
      saveEmergencyOverrideToStorage(emergencyClose);
      saveSpecialAnnouncementToStorage(announcement);

      // 2. Persist to API
      const res = await fetch("/api/opening-hours", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schedule,
          emergencyClose,
          announcement,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to save to server");

      setSavedSuccess(true);
      toast.success("Restaurant Hours & Status Updated!", {
        description: "Opening times and announcement banner are now active.",
      });
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error("Failed to save hours", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="size-5 text-primary" />
                Restaurant Operating Hours & Status
              </CardTitle>
              <CardDescription className="text-xs">
                Configure weekly opening schedules, temporary holiday closures, and customer
                announcements.
              </CardDescription>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-primary text-primary-foreground font-medium text-xs h-9"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-300" />
                  Saved Live!
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  {saving ? "Saving..." : "Save Status & Hours"}
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Emergency & Special Announcement Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Emergency Override */}
            <div
              className={`p-4 rounded-xl border transition-colors ${
                emergencyClose
                  ? "bg-destructive/10 border-destructive/30"
                  : "bg-muted/30 border-border/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg ${
                      emergencyClose
                        ? "bg-destructive/20 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold block">
                      Emergency / Temporary Closure
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Mark restaurant as closed across entire website
                    </span>
                  </div>
                </div>
                <Switch checked={emergencyClose} onCheckedChange={setEmergencyClose} />
              </div>
              {emergencyClose && (
                <div className="mt-2.5 pt-2.5 border-t border-destructive/20 text-[11px] text-destructive font-medium">
                  ⚠️ The restaurant status banner will show "Temporarily Closed" to all visitors.
                </div>
              )}
            </div>

            {/* Special Announcement Banner */}
            <div className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-amber-500" />
                <Label htmlFor="announcement-input" className="text-xs font-semibold">
                  Customer Announcement Banner
                </Label>
              </div>
              <Input
                id="announcement-input"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="e.g., Authentic Charcoal Grill • 100% Halal Certified • Fresh Daily"
                className="h-8 text-xs bg-background"
              />
              <span className="text-[10px] text-muted-foreground block">
                Displayed in the top navigation ticker and footer for customer notices.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            Weekly Opening & Closing Hours
          </CardTitle>
          <CardDescription className="text-xs">
            Customers will see live "Open Now" or "Closed" badges based on these operating hours.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden bg-card">
            {schedule.map((day, idx) => (
              <div
                key={day.day || idx}
                className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 sm:w-36">
                  <Badge
                    variant={day.isOpen ? "default" : "secondary"}
                    className="w-14 justify-center text-[11px] font-medium"
                  >
                    {day.shortDay}
                  </Badge>
                  <span className="text-xs font-medium">{day.day}</span>
                </div>

                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={day.openTime}
                      disabled={!day.isOpen}
                      onChange={(e) => handleUpdateDay(idx, { openTime: e.target.value })}
                      placeholder="12:00 PM"
                      className="h-8 text-xs font-medium w-28 bg-background"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      value={day.closeTime}
                      disabled={!day.isOpen}
                      onChange={(e) => handleUpdateDay(idx, { closeTime: e.target.value })}
                      placeholder="11:00 PM"
                      className="h-8 text-xs font-medium w-28 bg-background"
                    />
                  </div>

                  <div className="flex items-center gap-2 pl-2 border-l border-border/60">
                    <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
                      {day.isOpen ? "Open" : "Closed"}
                    </span>
                    <Switch
                      checked={day.isOpen}
                      onCheckedChange={(val) => handleUpdateDay(idx, { isOpen: val })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
