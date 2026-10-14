"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateHouseholdForm({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const { createHousehold } = useAppData();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) return setError("Give your household a name.");
    setSaving(true);
    setError(null);
    try {
      await createHousehold(name);
      toast.success(`Created ${name.trim()}`, { description: "Invite your roommates from Settings." });
      setName("");
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the household.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="household-name">Household name</Label>
        <Input
          id="household-name"
          autoFocus={autoFocus}
          placeholder="e.g. UCSB Apartment"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10"
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <Button type="submit" disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="animate-spin" /> : null}
        Create household
      </Button>
    </form>
  );
}