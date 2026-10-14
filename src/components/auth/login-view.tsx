"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, ArrowRight, House, Loader2, Scale, ShoppingCart, Smartphone, Wifi, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/shared/logo";
import { CodeComment, Cursor, StatTile, TerminalPanel } from "@/components/shared/terminal-panel";
import { TabPill } from "@/components/shared/tab-pill";
import { Ticker, type TickerItem } from "@/components/shared/ticker";
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
        <Card className="glow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
              You&apos;re in demo mode
            </CardTitle>
            <CardDescription>
              Supabase isn&apos;t configured, so there are no accounts — you&apos;re using a seeded household stored in this browser.
              Add your Supabase keys to <code>.env.local</code> to enable sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="group h-11 w-full text-sm" size="lg">
              <Link href="/dashboard">
                Open the demo household <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
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
      <Card className="glow-soft">
        <CardHeader>
          <CardTitle className="text-lg">{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
          <CardDescription>Split rent, groceries and bills without the spreadsheet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="w-full rounded-xl bg-black/30">
              <TabsTrigger value="signin" className="relative isolate data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent">
                {mode === "signin" ? <TabPill group="auth-mode" /> : null}
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="relative isolate data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent">
                {mode === "signup" ? <TabPill group="auth-mode" /> : null}
                Sign up
              </TabsTrigger>
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
                className="h-11 rounded-xl"
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
            <Button type="submit" className="h-11 w-full text-sm" size="lg" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {isGoogleAuthEnabled ? (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1" /> or <Separator className="flex-1" />
              </div>
              <Button variant="outline" className="h-11 w-full" size="lg" onClick={google} disabled={busy}>
                Continue with Google
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </Shell>
  );
}

const SAMPLE_TICKER: TickerItem[] = [
  { id: "1", label: <><b className="font-semibold">Chris</b> paid <b className="font-semibold">Alex</b></>, value: "$50.00", trend: "up" },
  { id: "2", icon: <ShoppingCart className="size-3.5 text-muted-foreground" />, label: <><b className="font-semibold">Alex</b> · Trader Joe&apos;s</>, value: "+$80.00", trend: "up" },
  { id: "3", icon: <Zap className="size-3.5 text-muted-foreground" />, label: <><b className="font-semibold">Ben</b> · PG&amp;E bill</>, value: "-$30.00", trend: "down" },
  { id: "4", label: <><b className="font-semibold">Chris</b> paid <b className="font-semibold">Ben</b></>, value: "$20.00", trend: "up" },
  { id: "5", icon: <House className="size-3.5 text-muted-foreground" />, label: <><b className="font-semibold">Maya</b> · October rent</>, value: "+$2,400.00", trend: "up" },
  { id: "6", icon: <Wifi className="size-3.5 text-muted-foreground" />, label: <><b className="font-semibold">You</b> · Cox Internet</>, value: "-$18.75", trend: "down" },
  { id: "7", label: <>Household balance check</>, value: "$0.00", trend: "flat" },
];

const FEATURES = [
  { icon: Scale, title: "Net balances, not IOUs", body: "Every expense rolls into one number per roommate, in exact cents." },
  { icon: ArrowLeftRight, title: "Fewer transfers", body: "We match who owes with who's owed so the house settles in a few payments." },
  { icon: Smartphone, title: "Built for the checkout line", body: "Log a split in seconds on your phone, any way you want to divide it." },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-terminal">
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Logo href="/login" />
        <span className="hidden text-xs text-muted-foreground sm:inline">Splitwise math, banking-app calm.</span>
      </header>

      <main className="relative mx-auto grid grid-cols-1 w-full max-w-6xl flex-1 items-center gap-10 px-5 pt-4 pb-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
            Shared expenses × debt simplification × zero spreadsheets
          </span>
          <h1 className="font-display text-[2.6rem] leading-[1.02] font-normal tracking-[-0.035em] sm:text-6xl">
            Split rent,
            <br />
            not <span className="text-gradient">friendships</span>.
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Track groceries, bills and rent with your roommates. Roommate AI nets everything out and tells each of you exactly who
            to pay — and how much.
          </p>
          <div className="w-full max-w-md">{children}</div>
          <p className="text-[11px] text-muted-foreground/80">We only keep score. No real money ever moves through Roommate AI.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
          <TerminalPanel
            status="Live sync"
            command="household.balance()"
            footer={
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Transfers" value="2" hint="instead of 4" />
                <StatTile label="Alex" value="+$50" tone="positive" />
                <StatTile label="Chris" value="-$70" tone="negative" />
              </div>
            }
          >
            <CodeComment>balancing UCSB Apartment…</CodeComment>
            <div>
              alex.<span className="text-emerald-300">paid</span>({"  "}<span className="text-amber-200">&quot;Groceries&quot;</span>, $120.00);
            </div>
            <div>
              ben.<span className="text-emerald-300">paid</span>({"   "}<span className="text-amber-200">&quot;Electric&quot;</span>,{"  "}$90.00);
            </div>
            <div>
              <span className="text-teal-300">const</span> net = <span className="text-emerald-300">ledger.net</span>();{" "}
              <span className="hidden text-muted-foreground/80 sm:inline">{"// sums to $0.00"}</span>
            </div>
            <div>
              chris.<span className="text-emerald-300">pay</span>(alex, <span className="text-positive">$50.00</span>); <span className="text-positive">▲</span>
            </div>
            <div>
              chris.<span className="text-emerald-300">pay</span>(ben,{"  "}<span className="text-positive">$20.00</span>); <span className="text-positive">▲</span>
              <Cursor />
            </div>
          </TerminalPanel>
        </motion.div>
      </main>

      <Ticker items={SAMPLE_TICKER} label="Example household activity" className="relative" />

      <section className="relative mx-auto grid w-full max-w-6xl gap-3 px-5 py-10 sm:grid-cols-3 md:px-8">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.03]"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-accent-foreground ring-1 ring-primary/20 transition-shadow group-hover:shadow-[0_0_20px_-4px] group-hover:shadow-primary/60">
              <Icon className="size-4" />
            </span>
            <p className="mt-4 font-display text-base font-medium">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
