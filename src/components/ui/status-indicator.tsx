import { cn } from '@/lib/utils';

export type StatusType = 'active' | 'pending' | 'inactive' | 'success' | 'warning' | 'error';

interface StatusIndicatorProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const statusColors: Record<StatusType, string> = {
  active: 'bg-green-500',
  success: 'bg-green-500',
  pending: 'bg-yellow-500',
  warning: 'bg-yellow-500',
  inactive: 'bg-gray-400',
  error: 'bg-red-500',
};

const sizeClasses = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
};

/**
 * A pulsing status indicator dot (MoonPay/Robinhood-inspired)
 * Used to show active states, processing, or status indicators
 */
export function StatusIndicator({
  status,
  size = 'md',
  pulse = true,
  className,
}: StatusIndicatorProps) {
  const shouldPulse = pulse && (status === 'active' || status === 'pending');

  return (
    <span className={cn('relative inline-flex', sizeClasses[size], className)}>
      {shouldPulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            statusColors[status]
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full h-full w-full',
          statusColors[status]
        )}
      />
    </span>
  );
}
