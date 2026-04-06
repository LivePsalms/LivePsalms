"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface Ripple {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

interface WaterRippleProps {
  rippleColor?: string;
  rippleDuration?: number;
  maxRipples?: number;
  className?: string;
  children?: React.ReactNode;
}

export function WaterRipple({
  rippleColor = "rgba(40, 35, 30, 0.15)",
  rippleDuration = 1500,
  maxRipples = 8,
  className = "",
  children,
}: WaterRippleProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHoverTime = useRef(0);
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
    }, 50);

    return () => clearInterval(cleanup);
  }, [rippleDuration]);

  const createRipple = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

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
  }, [maxRipples]);

  // Hover effect - creates ripples as mouse moves (throttled)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice.current) return;
    
    const now = Date.now();
    // Throttle hover ripples to every 200ms
    if (now - lastHoverTime.current < 200) return;
    lastHoverTime.current = now;

    createRipple(e.clientX, e.clientY);
  }, [createRipple]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    createRipple(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    createRipple(touch.clientX, touch.clientY);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
    >
      <style>{`
        @keyframes water-ripple-ring-1 {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        @keyframes water-ripple-ring-2 {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
          }
          20% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        @keyframes water-ripple-ring-3 {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.4;
          }
          40% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        .water-ripple-ring-1 {
          animation: water-ripple-ring-1 var(--ripple-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        .water-ripple-ring-2 {
          animation: water-ripple-ring-2 var(--ripple-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        .water-ripple-ring-3 {
          animation: water-ripple-ring-3 var(--ripple-duration) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>

      {/* Ripple container - behind content but visible */}
      <div className="pointer-events-none fixed inset-0 z-[5]">
        {ripples.map((ripple) => (
          <React.Fragment key={ripple.id}>
            {/* Outer ring */}
            <div
              className="water-ripple-ring-1 absolute rounded-full"
              style={{
                left: `${ripple.x}px`,
                top: `${ripple.y}px`,
                width: "300px",
                height: "300px",
                background: `radial-gradient(circle, transparent 30%, ${rippleColor} 50%, transparent 70%)`,
                ['--ripple-duration' as string]: `${rippleDuration}ms`,
              }}
            />
            {/* Middle ring */}
            <div
              className="water-ripple-ring-2 absolute rounded-full"
              style={{
                left: `${ripple.x}px`,
                top: `${ripple.y}px`,
                width: "200px",
                height: "200px",
                background: `radial-gradient(circle, transparent 30%, ${rippleColor} 50%, transparent 70%)`,
                ['--ripple-duration' as string]: `${rippleDuration}ms`,
              }}
            />
            {/* Inner ring */}
            <div
              className="water-ripple-ring-3 absolute rounded-full"
              style={{
                left: `${ripple.x}px`,
                top: `${ripple.y}px`,
                width: "100px",
                height: "100px",
                background: `radial-gradient(circle, transparent 30%, ${rippleColor} 50%, transparent 70%)`,
                ['--ripple-duration' as string]: `${rippleDuration}ms`,
              }}
            />
          </React.Fragment>
        ))}
      </div>

      {children}
    </div>
  );
}
