import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent?: "default" | "emerald" | "blue" | "amber" | "violet";
};

const accentStyles = {
  default: {
    icon: "border-border/50 bg-muted/50 text-foreground",
    bar: "bg-foreground/10",
  },
  emerald: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500/20",
  },
  blue: {
    icon: "border-blue-200 bg-blue-50 text-blue-700",
    bar: "bg-blue-500/20",
  },
  amber: {
    icon: "border-amber-200 bg-amber-50 text-amber-700",
    bar: "bg-amber-500/20",
  },
  violet: {
    icon: "border-violet-200 bg-violet-50 text-violet-700",
    bar: "bg-violet-500/20",
  },
};

export const MetricCard = ({
  label,
  value,
  hint,
  icon: Icon,
  accent = "default",
}: MetricCardProps) => {
  const styles = accentStyles[accent];

  return (
    <Card className="relative overflow-hidden border-border/60 bg-white shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${styles.bar}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <div className={`rounded-lg border p-2 shadow-sm ${styles.icon}`}>
            <Icon className="size-3.5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
};
