import { TrendingUp } from "lucide-react";
import Link from "next/link";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
        <TrendingUp className="size-4" strokeWidth={2.5} />
      </span>
      <span className="font-display text-[17px] font-medium tracking-tight">
        Roommate<span className="text-gradient"> AI</span>
      </span>
    </Link>
  );
}
