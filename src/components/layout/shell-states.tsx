"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "./household-setup";

export function ShellLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading household">
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
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
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry} variant="outline">
            <RefreshCw /> Try again
          </Button>
          <SignOutButton />
        </div>
      </CardContent>
    </Card>
  );
}
