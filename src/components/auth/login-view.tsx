"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isGoogleAuthEnabled, isSupabaseConfigured } from "@/lib/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginView() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re in demo mode</CardTitle>
            <CardDescription>
              Supabase isn&apos;t configured, so there are no accounts — you&apos;re using a seeded household stored in this browser.
              Add your Supabase keys to <code>.env.local</code> to enable sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <Link href="/dashboard">Open the demo household</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = getSupabaseBrowserClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setNotice("Check your inbox to confirm your email, then come back to sign in.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
          <CardDescription>Split rent, groceries and bills without the spreadsheet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {notice ? (
              <Alert>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {isGoogleAuthEnabled ? (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1" /> or <Separator className="flex-1" />
              </div>
              <Button variant="outline" className="w-full" size="lg" onClick={google} disabled={busy}>
                Continue with Google
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-accent/60 to-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-4" />
          </span>
          Roommate AI
        </div>
        {children}
      </div>
    </div>
  );
}
