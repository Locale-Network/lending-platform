'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface HoldToConfirmButtonProps {
  onConfirm: () => void | Promise<void>;
  duration?: number; // Hold duration in ms
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: {
    base: 'bg-primary text-primary-foreground',
    fill: 'bg-primary/80',
    ring: 'stroke-primary',
  },
  destructive: {
    base: 'bg-destructive text-destructive-foreground',
    fill: 'bg-destructive/80',
    ring: 'stroke-destructive',
  },
  success: {
    base: 'bg-green-600 text-white',
    fill: 'bg-green-500',
    ring: 'stroke-green-500',
  },
  warning: {
    base: 'bg-orange-600 text-white',
    fill: 'bg-orange-500',
    ring: 'stroke-orange-500',
  },
};

const sizeStyles = {
  sm: {
    button: 'px-4 py-2 text-sm',
    ring: 'w-[160px] h-[160px]',
    radius: 60,
    strokeWidth: 12,
  },
  md: {
    button: 'px-5 py-2.5 text-base',
    ring: 'w-[200px] h-[200px]',
    radius: 75,
    strokeWidth: 16,
  },
  lg: {
    button: 'px-6 py-3 text-lg',
    ring: 'w-[240px] h-[240px]',
    radius: 90,
    strokeWidth: 20,
  },
};

export function HoldToConfirmButton({
  onConfirm,
  duration = 2000,
  disabled = false,
  loading = false,
  variant = 'default',
  size = 'md',
  children,
  className,
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const styles = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  const circumference = 2 * Math.PI * sizeStyle.radius;

  const resetState = useCallback(() => {
    setProgress(0);
    setIsHolding(false);
    setIsCompleted(false);
    startTimeRef.current = null;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const animate = useCallback(() => {
    if (!startTimeRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min(elapsed / duration, 1);
    setProgress(newProgress);

    if (newProgress >= 1) {
      setIsCompleted(true);
      setIsHolding(false);
      onConfirm();
    } else if (isHolding) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [duration, isHolding, onConfirm]);

  const handlePointerDown = useCallback(() => {
    if (disabled || loading || isCompleted) return;

    setIsHolding(true);
    startTimeRef.current = Date.now();
    animationRef.current = requestAnimationFrame(animate);
  }, [disabled, loading, isCompleted, animate]);

  const handlePointerUp = useCallback(() => {
    if (!isCompleted) {
      resetState();
    }
  }, [isCompleted, resetState]);

  const handlePointerLeave = useCallback(() => {
    if (!isCompleted) {
      resetState();
    }
  }, [isCompleted, resetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Reset completed state when loading changes
  useEffect(() => {
    if (!loading && isCompleted) {
      // Allow reset after action completes
      const timer = setTimeout(() => {
        resetState();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, isCompleted, resetState]);

  const scale = 1 - progress * 0.15; // Scale down to 0.85 at 100%
  const strokeDashoffset = circumference * (1 - progress);
  const ringOpacity = progress > 0 ? 1 : 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Progress Ring */}
      <svg
        className={cn(
          'absolute pointer-events-none transition-opacity duration-150',
          sizeStyle.ring
        )}
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: ringOpacity,
        }}
        viewBox={`0 0 ${sizeStyle.radius * 2 + sizeStyle.strokeWidth} ${sizeStyle.radius * 2 + sizeStyle.strokeWidth}`}
      >
        {/* Background circle */}
        <circle
          cx={sizeStyle.radius + sizeStyle.strokeWidth / 2}
          cy={sizeStyle.radius + sizeStyle.strokeWidth / 2}
          r={sizeStyle.radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={sizeStyle.strokeWidth}
          className="text-muted/20"
          strokeLinecap="round"
        />
        {/* Progress circle */}
        <circle
          cx={sizeStyle.radius + sizeStyle.strokeWidth / 2}
          cy={sizeStyle.radius + sizeStyle.strokeWidth / 2}
          r={sizeStyle.radius}
          fill="none"
          strokeWidth={progress > 0 ? sizeStyle.strokeWidth - 4 : 0}
          strokeLinecap="round"
          className={cn(styles.ring, 'transition-all duration-75')}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            filter: 'blur(1px)',
          }}
        />
      </svg>

      {/* Button */}
      <button
        type="button"
        disabled={disabled || loading}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        className={cn(
          'relative rounded-full font-medium overflow-hidden isolate select-none touch-none',
          'transition-all duration-75 ease-out',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          styles.base,
          sizeStyle.button,
          className
        )}
        style={{
          transform: `scale(${scale})`,
          willChange: 'transform',
        }}
      >
        {/* Background fill animation */}
        <div
          className={cn(
            'absolute inset-0 -z-10 rounded-full',
            styles.fill
          )}
          style={{
            transform: `translateX(${-200 + progress * 200}%) scale(2)`,
            filter: 'blur(20px)',
            willChange: 'transform',
          }}
        />

        {/* Content */}
        <span className="relative z-10 whitespace-nowrap">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : isHolding ? (
            'Hold...'
          ) : (
            children
          )}
        </span>
      </button>
    </div>
  );
}

export default HoldToConfirmButton;
