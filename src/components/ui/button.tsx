import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from "@/components/ui/text-stagger-hover"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
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

const ICON_SIZES = new Set(["icon", "icon-sm", "icon-lg"])

function staggerizeChildren(children: React.ReactNode): React.ReactNode {
  // Wrap pure-string text in TextStaggerHover dual-text overlay.
  // Mixed children (icon + text) get their string segments individually wrapped
  // so icons keep their layout slot and gap.
  if (typeof children === "string") {
    return (
      <TextStaggerHover as="span">
        <TextStaggerHoverActive animation="blur">{children}</TextStaggerHoverActive>
        <TextStaggerHoverHidden animation="blur">{children}</TextStaggerHoverHidden>
      </TextStaggerHover>
    )
  }
  if (Array.isArray(children)) {
    return children.map((c, i) =>
      typeof c === "string" && c.trim().length > 0 ? (
        <TextStaggerHover key={i} as="span">
          <TextStaggerHoverActive animation="blur">{c}</TextStaggerHoverActive>
          <TextStaggerHoverHidden animation="blur">{c}</TextStaggerHoverHidden>
        </TextStaggerHover>
      ) : (
        <React.Fragment key={i}>{c}</React.Fragment>
      )
    )
  }
  return children
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const sizeKey = (size ?? "default") as string
  const shouldStaggerize = !asChild && !ICON_SIZES.has(sizeKey)

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {shouldStaggerize ? staggerizeChildren(children) : children}
    </Comp>
  )
}

export { Button, buttonVariants }
