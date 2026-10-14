import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { DOODLES, type DoodleName } from "@/components/shared/doodles"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-mono text-[11px] font-medium tracking-[0.08em] whitespace-nowrap uppercase transition-[color,background-color,border-color,box-shadow] duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px motion-reduce:active:translate-y-0 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-']):not([data-pencil])]:size-3.5 [&_svg:not([data-pencil])]:stroke-[1.75]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),white_12%)]",
        outline:
          "border-foreground/30 bg-transparent text-foreground hover:border-foreground/60 hover:bg-foreground/[0.03] aria-expanded:border-foreground/60 aria-expanded:bg-foreground/[0.03]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground aria-expanded:bg-foreground/[0.05] aria-expanded:text-foreground",
        destructive:
          "border-destructive/35 bg-destructive/[0.06] text-destructive hover:border-destructive/60 hover:bg-destructive/10 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground",
        /** Cartoon sticker buttons: pencil outline, hard shadow that grows on hover and flattens on press. */
        pop: "bg-pop-yellow text-foreground sticker-sm transition-[translate,box-shadow,background-color] hover:-translate-y-0.5 hover:shadow-[3px_4px_0_0_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        lilac: "bg-lilac text-foreground sticker-sm transition-[translate,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-pop-purple hover:shadow-[3px_4px_0_0_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        mint: "bg-mint text-foreground sticker-sm transition-[translate,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-pop-green hover:shadow-[3px_4px_0_0_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
      },
      size: {
        default:
          "h-9 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1.5 px-2.5 text-[10px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-']):not([data-pencil])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-[10.5px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-']):not([data-pencil])]:size-3",
        lg: "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-']):not([data-pencil])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** Typographic marks borrowed from editorial nav labels ("• HOME", "✳ STAY UPDATED", "✕ LET'S TALK"). */
const MARKS = { dot: "•", star: "✳", cross: "✕", square: "■" } as const

const SKETCHED = new Set(["default", "outline", "secondary", "destructive"])

/**
 * A loose hand-drawn loop around the button. It overshoots its own start like a quick pencil
 * circle, and draws itself in on hover. Outline buttons also keep a faint retrace at rest.
 */
function PencilLoop({ resting }: { resting: boolean }) {
  return (
    <svg
      data-pencil
      aria-hidden
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -inset-x-[7px] -inset-y-[5px] h-[calc(100%+10px)] w-[calc(100%+14px)] overflow-visible text-foreground"
    >
      {resting ? (
        <path
          className="pencil-stroke opacity-25 transition-opacity duration-300 group-hover/button:opacity-0"
          strokeWidth={0.75}
          d="M 30 6 C 90 2, 170 3, 193 22 C 200 40, 160 57, 100 56 C 40 56, 4 50, 6 30 C 8 14, 22 8, 44 6"
        />
      ) : null}
      <path
        pathLength={1}
        className="pencil-stroke opacity-0 [stroke-dasharray:1_2] [stroke-dashoffset:1] transition-[stroke-dashoffset,opacity] duration-500 group-hover/button:opacity-100 group-focus-visible/button:opacity-100 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover/button:[stroke-dashoffset:0] group-focus-visible/button:[stroke-dashoffset:0] motion-reduce:transition-none"
        strokeWidth={1}
        d="M 20 36 C 12 16, 64 4, 108 4 C 158 4, 197 14, 195 31 C 193 49, 142 57, 96 56 C 46 55, 4 48, 7 29 C 9 15, 42 7, 74 6"
      />
    </svg>
  )
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  mark,
  doodle,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Optional typographic mark shown before the label. */
    mark?: keyof typeof MARKS
    /** Optional mini doodle before the label; it wiggles on hover. */
    doodle?: DoodleName
  }) {
  const Doodle = doodle ? DOODLES[doodle] : null
  const Comp = asChild ? Slot.Root : "button"
  const sketched = SKETCHED.has(variant ?? "default") && !String(size).startsWith("icon")

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {Doodle ? (
        <span
          aria-hidden
          data-pencil
          className="-my-1 -ml-1 grid size-6 shrink-0 place-items-center transition-transform group-hover/button:animate-wiggle group-hover/button:[--wiggle-amount:14deg] group-hover/button:[--wiggle-duration:0.5s]"
        >
          <Doodle className="size-6" />
        </span>
      ) : null}
      {mark ? (
        <span aria-hidden className="text-[0.95em] leading-none opacity-70">
          {MARKS[mark]}
        </span>
      ) : null}
      <Slot.Slottable>{children}</Slot.Slottable>
      {sketched ? <PencilLoop resting={variant === "outline"} /> : null}
    </Comp>
  )
}

export { Button, buttonVariants }
