import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-pop-pink text-foreground",
  "bg-pop-green text-foreground",
  "bg-pop-yellow text-foreground",
  "bg-pop-blue text-foreground",
  "bg-pop-orange text-foreground",
  "bg-pop-purple text-foreground",
  "bg-mint text-foreground",
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
    <Avatar className={cn(sizeClass, "sketch-line", className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={cn("font-hand text-[1.2em] leading-none", PALETTE[hash(id) % PALETTE.length])}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
