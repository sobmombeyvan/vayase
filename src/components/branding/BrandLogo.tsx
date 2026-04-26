import { cn } from '@/lib/utils';

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textClassName?: string;
  subtitleClassName?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

export function BrandLogo({
  className,
  imageClassName,
  showText = true,
  textClassName,
  subtitleClassName,
  size = 'md',
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src="/vayase-logo.png"
        alt="Vayase Consulting"
        className={cn(sizeMap[size], 'shrink-0 rounded-full object-cover', imageClassName)}
      />
      {showText && (
        <div className="overflow-hidden">
          <div className={cn('font-display font-bold text-base tracking-tight leading-tight', textClassName)}>
            VAYASE
          </div>
          <div className={cn('text-[10px] uppercase tracking-widest leading-tight', subtitleClassName)}>
            Consulting
          </div>
        </div>
      )}
    </div>
  );
}
