'use client';

import { useRef, useCallback, ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  glareEnabled?: boolean;
  shadowEnabled?: boolean;
}

export function TiltCard({
  children,
  className,
  maxTilt = 15,
  perspective = 500, // Lower perspective = more dramatic 3D effect (matching reference)
  scale = 1.02,
  glareEnabled = true,
  shadowEnabled = true,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const isHoveringRef = useRef(false);
  const targetRef = useRef({ z: 0, rotateX: 0, rotateY: 0, scale: 1 });
  const currentRef = useRef({ z: 0, rotateX: 0, rotateY: 0, scale: 1 });
  const glarePositionRef = useRef({ x: 50, y: 50 });

  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const updateTransform = useCallback(() => {
    if (!cardRef.current) return;

    // Faster interpolation for more responsive feel
    const factor = 0.15;
    currentRef.current.z = lerp(currentRef.current.z, targetRef.current.z, factor);
    currentRef.current.rotateX = lerp(currentRef.current.rotateX, targetRef.current.rotateX, factor);
    currentRef.current.rotateY = lerp(currentRef.current.rotateY, targetRef.current.rotateY, factor);
    currentRef.current.scale = lerp(currentRef.current.scale, targetRef.current.scale, factor);

    // Apply transform with perspective on parent wrapper
    cardRef.current.style.transform = `
      rotateX(${currentRef.current.rotateX}deg)
      rotateY(${currentRef.current.rotateY}deg)
      translateZ(${currentRef.current.z}px)
      scale3d(${currentRef.current.scale}, ${currentRef.current.scale}, ${currentRef.current.scale})
    `.replace(/\s+/g, ' ').trim();

    // Dynamic shadow based on tilt - moves opposite to tilt for realistic lighting
    if (shadowEnabled) {
      const shadowX = -currentRef.current.rotateY * 1.5;
      const shadowY = currentRef.current.rotateX * 1.5;
      const shadowBlur = 20 + Math.abs(currentRef.current.z) * 0.5;
      const shadowOpacity = 0.2 + (Math.abs(currentRef.current.rotateX) + Math.abs(currentRef.current.rotateY)) * 0.005;
      cardRef.current.style.boxShadow = `
        ${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity}),
        0 10px 40px rgba(0, 0, 0, 0.15)
      `.trim();
    }

    // Update glare position - follows cursor
    if (glareRef.current && glareEnabled) {
      const glareOpacity = isHoveringRef.current ? 1 : 0;
      glareRef.current.style.opacity = String(glareOpacity);
      glareRef.current.style.background = `
        radial-gradient(
          circle at ${glarePositionRef.current.x}% ${glarePositionRef.current.y}%,
          rgba(255, 255, 255, 0.35) 0%,
          rgba(255, 255, 255, 0.15) 25%,
          transparent 50%
        )
      `.trim();
    }

    // Check if we're close enough to target
    const threshold = 0.05;
    const isClose =
      Math.abs(currentRef.current.z - targetRef.current.z) < threshold &&
      Math.abs(currentRef.current.rotateX - targetRef.current.rotateX) < threshold &&
      Math.abs(currentRef.current.rotateY - targetRef.current.rotateY) < threshold &&
      Math.abs(currentRef.current.scale - targetRef.current.scale) < threshold;

    if (!isClose) {
      animationRef.current = requestAnimationFrame(updateTransform);
    } else {
      // Snap to final values when close
      currentRef.current = { ...targetRef.current };
      // Keep animation running while hovering for continuous updates
      if (isHoveringRef.current) {
        animationRef.current = requestAnimationFrame(updateTransform);
      }
    }
  }, [shadowEnabled, glareEnabled]);

  const startAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(updateTransform);
  }, [updateTransform]);

  const calculateTilt = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert coordinates to percentages (0-1)
    const xPercent = x / rect.width;
    const yPercent = y / rect.height;

    // Calculate tilt - matching reference implementation exactly
    // rotateX: positive when cursor at top, negative at bottom (0.5 - yPercent)
    // rotateY: positive when cursor at right, negative at left (xPercent - 0.5)
    targetRef.current.z = -10; // Slight push back like reference
    targetRef.current.rotateX = maxTilt * (0.5 - yPercent);
    targetRef.current.rotateY = maxTilt * (xPercent - 0.5);
    targetRef.current.scale = scale;

    // Update glare position to follow cursor
    glarePositionRef.current.x = xPercent * 100;
    glarePositionRef.current.y = yPercent * 100;
  }, [maxTilt, scale]);

  const handlePointerEnter = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    isHoveringRef.current = true;
    calculateTilt(event);
    startAnimation();
  }, [calculateTilt, startAnimation]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    calculateTilt(event);
    // Animation loop is already running from pointerenter
  }, [calculateTilt]);

  const handlePointerLeave = useCallback(() => {
    isHoveringRef.current = false;
    targetRef.current.z = 0;
    targetRef.current.rotateX = 0;
    targetRef.current.rotateY = 0;
    targetRef.current.scale = 1;
    startAnimation();
  }, [startAnimation]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        perspective: `${perspective}px`,
        perspectiveOrigin: 'center center',
      }}
    >
      <div
        ref={cardRef}
        className={cn(
          'relative will-change-transform cursor-pointer overflow-hidden rounded-2xl',
          className
        )}
        style={{
          transformStyle: 'preserve-3d',
          transform: 'rotateX(0deg) rotateY(0deg) translateZ(0px) scale3d(1, 1, 1)',
        }}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {children}

        {/* Glare overlay */}
        {glareEnabled && (
          <div
            ref={glareRef}
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl transition-opacity duration-200"
            style={{
              opacity: 0,
              background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.35) 0%, transparent 50%)',
            }}
          />
        )}
      </div>
    </div>
  );
}
