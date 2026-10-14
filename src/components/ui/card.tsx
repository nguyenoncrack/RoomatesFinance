import * as React from "react"
import { cn } from "cn"
import { DOODLES, type DoodleName } from "@/components/shared/doodles"

/** Pastel sticker backgrounds. "paper" is the plain card. */
const TONES = {
  paper: "bg-card",
  butter: "bg-butter",
  blush: "bg-blush",
  mint: "bg-mint",
  sky: "bg-sky",
  lilac: "bg-lilac",
  tangerine: "bg-tangerine",
} as const

export type CardTone = keyof typeof TONES

function Card({
  className,
  size = "default",
  lift = false,
  tone = "paper",
  doodle,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  lift?: boolean
  tone?: CardTone
  /** A cartoon tucked into the top-right corner, slightly tilted. */
  doodle?: DoodleName
}) {
  const Doodle = doodle ? DOODLES[doodle] : null
  return (
    <div
      data-slot="card"
      data-size={size}
      data-tone={tone}
      className={cn(
        "group/card relative flex flex-col gap-(--card-spacing) overflow-hidden rounded-[22px] sticker py-(--card-spacing) text-sm text-card-foreground",
        TONES[tone],
        " [--card-spacing:--spacing(5)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        lift && "transition-[translate,box-shadow] duration-200 ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--foreground)] motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0",
        className
      )}
      {...props}
    >
      {Doodle ? (
        <span
          aria-hidden
          data-doodle
          className="pointer-events-none absolute -top-1 right-3 z-0 rotate-[8deg] transition-transform duration-300 group-hover/card:rotate-[-4deg] group-hover/card:scale-110 motion-reduce:transition-none"
        >
          <Doodle className="size-[4.5rem] drop-shadow-[2px_2px_0_var(--foreground)]" />
        </span>
      ) : null}
      {children}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header relative z-[1] grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) group-has-[>[data-doodle]]/card:pr-24 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-[1.6rem] leading-none tracking-[-0.01em] group-data-[size=sm]/card:text-xl",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("relative z-[1] px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
