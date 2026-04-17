import * as React from "react";
import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[132px] w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:bg-white/[0.07] placeholder:text-muted-foreground/80",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
