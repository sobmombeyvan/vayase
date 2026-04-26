import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  accent?: 'default' | 'success' | 'warning' | 'destructive';
  prefix?: string;
  suffix?: string;
}

const accentMap = {
  default: 'bg-vayase-accent/10 text-vayase-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export function KPICard({ label, value, icon: Icon, trend, trendLabel, accent = 'default', prefix, suffix }: KPICardProps) {
  const positive = trend !== undefined && trend >= 0;
  return (
    <div className="vayase-card vayase-card-hover p-5 group">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110', accentMap[accent])}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        {prefix && <span className="text-base font-medium text-muted-foreground">{prefix}</span>}
        <span className="font-display font-bold text-2xl lg:text-3xl text-foreground tracking-tight">{value}</span>
        {suffix && <span className="text-base font-medium text-muted-foreground">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1.5 mt-3">
          <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md',
            positive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function SectionCard({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('vayase-card p-5 lg:p-6', className)}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-semibold text-base text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
