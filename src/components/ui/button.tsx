import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-rubik font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active focus-double-ring",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-double-ring",
        outline: "border-2 border-primary bg-transparent text-primary-foreground hover:bg-primary/[0.08] focus-double-ring",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-double-ring",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground focus-double-ring",
        link: "text-accent underline-offset-4 hover:underline",
        hero: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active focus-double-ring text-base",
        heroOutline: "border-2 border-primary text-primary-foreground hover:bg-primary/[0.08] focus-double-ring text-base",
      },
      size: {
        default: "h-11 px-5 py-2 text-sm",
        sm: "h-9 rounded-md px-3 text-sm",
        lg: "h-13 rounded-md px-8 text-base",
        xl: "h-14 rounded-lg px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
