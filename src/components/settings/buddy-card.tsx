"use client";

import { BuddySprite } from "@/components/shared/roaming-buddy";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setBuddyEnabled, useBuddyEnabled } from "@/lib/buddy-pref";

/** Show or hide the little wandering helper. The choice is remembered in this browser. */
export function BuddyCard() {
  const enabled = useBuddyEnabled();
  return (
    <Card tone="butter">
      <CardContent className="flex items-center gap-4">
        <div className="buddy buddy-static shrink-0" data-pose={enabled ? "idle" : "sit"} data-facing="right" aria-hidden>
          <div className="buddy-flip">
            <div className="buddy-body">
              <BuddySprite />
            </div>
          </div>
        </div>
        <Label htmlFor="buddy-switch" className="flex-1 font-display text-2xl leading-none">
          Little buddy
        </Label>
        <Switch id="buddy-switch" checked={enabled} onCheckedChange={setBuddyEnabled} aria-label="Show the little buddy" />
      </CardContent>
    </Card>
  );
}
