import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-emerald-400/15 text-emerald-800",
  "bg-teal-400/15 text-teal-800",
  "bg-amber-400/15 text-amber-800",
  "bg-rose-400/15 text-rose-800",
  "bg-sky-400/15 text-sky-800",
  "bg-lime-400/15 text-lime-800",
  "bg-cyan-400/15 text-cyan-800",
];

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function MemberAvatar({
  id,
  name,
  src,
  size = "default",
  className,
}: {
  id: string;
  name: string;
  src?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-11 text-sm" : "size-8 text-xs";
  return (
    <Avatar className={cn(sizeClass, className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={cn("font-semibold", PALETTE[hash(id) % PALETTE.length])}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
