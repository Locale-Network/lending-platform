'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface HoldConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
  loading?: boolean;
  details?: React.ReactNode;
}

const variantConfig = {
  default: {
    icon: CheckCircle,
    iconColor: 'text-primary',
    buttonBg: 'bg-primary',
    buttonHover: 'hover:bg-primary/90',
    progressColor: 'stroke-primary',
    ringBg: 'stroke-primary/20',
  },
  destructive: {
    icon: XCircle,
    iconColor: 'text-destructive',
    buttonBg: 'bg-destructive',
    buttonHover: 'hover:bg-destructive/90',
    progressColor: 'stroke-destructive',
    ringBg: 'stroke-destructive/20',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    buttonBg: 'bg-green-600',
    buttonHover: 'hover:bg-green-700',
    progressColor: 'stroke-green-600',
    ringBg: 'stroke-green-600/20',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-orange-600',
    buttonBg: 'bg-orange-600',
    buttonHover: 'hover:bg-orange-700',
    progressColor: 'stroke-orange-600',
    ringBg: 'stroke-orange-600/20',
  },
};

export function HoldConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  variant = 'default',
  duration = 2000,
  loading = false,
  details,
}: HoldConfirmModalProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);

  const config = variantConfig[variant];
  const Icon = config.icon;

  // SVG dimensions
  const size = 180;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const resetState = useCallback(() => {
    setProgress(0);
    setIsHolding(false);
    setIsCompleted(false);
    isHoldingRef.current = false;
    startTimeRef.current = null;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  // Reset after loading completes
  useEffect(() => {
    if (!loading && isCompleted) {
      const timer = setTimeout(() => {
        resetState();
        onOpenChange(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, isCompleted, resetState, onOpenChange]);

  const animate = useCallback(() => {
    if (!startTimeRef.current || !isHoldingRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min(elapsed / duration, 1);
    setProgress(newProgress);

    if (newProgress >= 1) {
      // Verify user is still holding before confirming
      if (!isHoldingRef.current) {
        resetState();
        return;
      }
      setIsCompleted(true);
      setIsHolding(false);
      isHoldingRef.current = false;
      // Await async onConfirm to prevent double-triggers and ensure proper completion
      Promise.resolve(onConfirm()).catch((error) => {
        console.error('[HoldConfirmModal] onConfirm error:', error);
      });
    } else {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [duration, onConfirm, resetState]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (loading || isCompleted) return;

      setIsHolding(true);
      isHoldingRef.current = true;
      startTimeRef.current = Date.now();
      animationRef.current = requestAnimationFrame(animate);
    },
    [loading, isCompleted, animate]
  );

  const handleMouseUp = useCallback(() => {
    isHoldingRef.current = false;
    if (!isCompleted) {
      resetState();
    }
  }, [isCompleted, resetState]);

  const handleMouseLeave = useCallback(() => {
    isHoldingRef.current = false;
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

  // Stable ref for global mouseup handler to prevent memory leaks
  const handleGlobalMouseUpRef = useRef<() => void>(() => {});

  // Update the ref when dependencies change
  useEffect(() => {
    handleGlobalMouseUpRef.current = () => {
      isHoldingRef.current = false;
      if (!isCompleted) {
        resetState();
      }
    };
  }, [isCompleted, resetState]);

  // Add global mouseup listener to catch releases outside the button
  useEffect(() => {
    if (!isHolding) return;

    const handleGlobalMouseUp = () => {
      handleGlobalMouseUpRef.current();
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isHolding]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4">
            <Icon className={cn('h-12 w-12', config.iconColor)} />
          </div>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        {details && <div className="py-4 border-t border-b">{details}</div>}

        <div className="flex flex-col items-center py-6">
          {/* Circular progress button */}
          <div className="relative">
            {/* SVG Progress Ring */}
            <svg
              width={size}
              height={size}
              className="transform -rotate-90"
            >
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                className={config.ringBg}
              />
              {/* Progress ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className={cn(config.progressColor, 'transition-all duration-75')}
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset,
                }}
              />
            </svg>

            {/* Center button */}
            <button
              type="button"
              disabled={loading}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              className={cn(
                'absolute inset-0 m-auto rounded-full font-semibold text-white',
                'flex items-center justify-center select-none cursor-pointer',
                'transition-transform duration-100',
                config.buttonBg,
                loading ? 'opacity-70 cursor-not-allowed' : '',
                isHolding ? 'scale-95' : 'scale-100'
              )}
              style={{
                width: size - strokeWidth * 4,
                height: size - strokeWidth * 4,
              }}
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isHolding ? (
                <span className="text-sm">Hold...</span>
              ) : (
                <span className="text-sm px-2 text-center leading-tight">
                  {confirmText}
                </span>
              )}
            </button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground text-center">
            {loading
              ? 'Processing...'
              : isHolding
                ? `${Math.round(progress * 100)}% - Keep holding...`
                : 'Press and hold the button to confirm'}
          </p>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HoldConfirmModal;
