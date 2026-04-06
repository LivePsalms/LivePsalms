"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface Ripple {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

interface RaindropEffectProps {
  rippleColor?: string;
  rippleDuration?: number;
  maxRipples?: number;
  className?: string;
  children?: React.ReactNode;
}

export function RaindropEffect({
  rippleColor = "rgba(40, 35, 30, 0.3)",
  rippleDuration = 2000,
  maxRipples = 5,
  className = "",
  children,
}: RaindropEffectProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRippleTime = useRef(0);
  const isTouchDevice = useRef(false);

  // Detect touch device
  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  // Cleanup expired ripples
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setRipples((prev) =>
        prev.filter((ripple) => now - ripple.timestamp < rippleDuration)
      );
    }, 100);

    return () => clearInterval(cleanup);
  }, [rippleDuration]);

  const createRipple = useCallback((x: number, y: number) => {
    const now = Date.now();
    // Throttle ripples on mouse move (desktop)
    if (now - lastRippleTime.current < 150) return;
    lastRippleTime.current = now;

    const newRipple: Ripple = {
      id: now + Math.random(),
      x,
      y,
      timestamp: now,
    };

    setRipples((prev) => {
      const updated = [...prev, newRipple];
      return updated.slice(-maxRipples);
    });
  }, [maxRipples]);

  // Desktop: Mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isTouchDevice.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    createRipple(x, y);
  };

  // Mobile: Click/Touch
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Don't throttle clicks
    const newRipple: Ripple = {
      id: Date.now() + Math.random(),
      x,
      y,
      timestamp: Date.now(),
    };

    setRipples((prev) => {
      const updated = [...prev, newRipple];
      return updated.slice(-maxRipples);
    });
  };

  // Mobile: Touch
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const newRipple: Ripple = {
      id: Date.now() + Math.random(),
      x,
      y,
      timestamp: Date.now(),
    };

    setRipples((prev) => {
      const updated = [...prev, newRipple];
      return updated.slice(-maxRipples);
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
    >
      <style>{`
        @keyframes raindrop-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        .raindrop-ripple-ring {
          animation: raindrop-ripple var(--ripple-duration) ease-out forwards;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-[100]">
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            className="raindrop-ripple-ring absolute rounded-full border-2"
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              width: "150px",
              height: "150px",
              borderColor: rippleColor,
              boxShadow: `0 0 8px ${rippleColor}`,
              ['--ripple-duration' as string]: `${rippleDuration}ms`,
            }}
          />
        ))}
      </div>

      {children}
    </div>
  );
}
