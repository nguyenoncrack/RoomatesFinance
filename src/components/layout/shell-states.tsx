"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateHouseholdForm } from "./create-household-dialog";

export function ShellLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading household">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
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
        <span className="flex size-11 items-center justify-center rounded-full bg-negative-soft text-negative">
          <AlertTriangle className="size-5" />
        </span>
        <h2 className="text-base font-semibold">We couldn&apos;t load your household</h2>
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
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-5 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Home className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">Set up your household</h2>
          <p className="text-sm text-muted-foreground">
            Create one for your place, then share the invite link with your roommates. Got a link already? Just open it.
          </p>
        </div>
        <CreateHouseholdForm autoFocus />
      </CardContent>
    </Card>
  );
}
