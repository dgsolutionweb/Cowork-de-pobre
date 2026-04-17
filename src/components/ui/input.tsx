import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:bg-white/[0.07] placeholder:text-muted-foreground/80",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
