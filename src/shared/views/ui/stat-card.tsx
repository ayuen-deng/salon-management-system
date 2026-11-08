import * as React from "react";
import { cn } from "./utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  comparison?: string;
  badge?: string;
}

/**
 * Plain minimal stat tile:
 * - White card, 1px border (#E4E1DA), 8px radius, almost no shadow.
 * - Small label (sentence case, no all-caps micro-labels).
 * - Large number, tabular numerals.
 * - Optional small comparison or quiet subtitle.
 * - Zero bright colored backgrounds or glow.
 */
export function StatCard({
  title,
  value,
  subtitle,
  comparison,
  badge,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        {badge && (
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>

      <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </div>

      {(subtitle || comparison) && (
        <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
          {comparison && <span className="font-medium text-foreground">{comparison}</span>}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
