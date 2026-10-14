"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateHouseholdForm } from "./create-household-dialog";

export function ShellLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading household">
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        <div className="space-y-4">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-12 w-3/4 rounded-xl" />
          <Skeleton className="h-12 w-2/3 rounded-xl" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-11 w-36 rounded-xl" />
            <Skeleton className="h-11 w-32 rounded-xl" />
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-white/[0.07] p-4">
          <Skeleton className="h-36 rounded-xl" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export function ShellError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-negative-soft text-negative ring-1 ring-negative/25">
          <AlertTriangle className="size-5" />
        </span>
        <h2 className="font-display text-lg font-semibold">We couldn&apos;t load your household</h2>
        <p className="text-sm text-muted-foreground">{message ?? "Something went wrong."}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw /> Try again
        </Button>
      </CardContent>
    </Card>
  );
}

export function NoHouseholds() {
  return (
    <Card className="mx-auto max-w-md glow-soft">
      <CardContent className="space-y-5 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-accent-foreground ring-1 ring-primary/25 shadow-[0_0_24px_-6px] shadow-primary/60">
            <Home className="size-5" />
          </span>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Set up your household</h2>
          <p className="text-sm text-muted-foreground">
            Create one for your place, then share the invite link with your roommates. Got a link already? Just open it.
          </p>
        </div>
        <CreateHouseholdForm autoFocus />
      </CardContent>
    </Card>
  );
}
