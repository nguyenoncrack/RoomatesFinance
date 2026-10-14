import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
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
