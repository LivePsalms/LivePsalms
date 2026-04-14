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

  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  useEffect(() => {
    const cleanup = setInterval(() => {
      setRipples((prev) => {
        if (prev.length === 0) return prev;
        const now = Date.now();
        const next = prev.filter((ripple) => now - ripple.timestamp < rippleDuration);
        return next.length === prev.length ? prev : next;
      });
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
