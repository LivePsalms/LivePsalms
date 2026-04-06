"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface UnderwaterEffectProps {
  className?: string;
  children?: React.ReactNode;
  intensity?: number;
}

export function UnderwaterEffect({
  className = "",
  children,
  intensity = 1,
}: UnderwaterEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, translateZ: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });
  const isTouchDevice = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Detect touch device
  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  // Smooth animation loop
  const animate = useCallback(() => {
    if (!contentRef.current) return;

    const targetX = mouseRef.current.y * 3 * intensity; // RotateX based on Y position
    const targetY = mouseRef.current.x * 3 * intensity; // RotateY based on X position
    const targetZ = Math.abs(mouseRef.current.x * mouseRef.current.y) * 10 * intensity;

    setTransform(prev => ({
      rotateX: prev.rotateX + (targetX - prev.rotateX) * 0.08,
      rotateY: prev.rotateY + (targetY - prev.rotateY) * 0.08,
      translateZ: prev.translateZ + (targetZ - prev.translateZ) * 0.08,
    }));

    rafRef.current = requestAnimationFrame(animate);
  }, [intensity]);

  useEffect(() => {
    if (!isTouchDevice.current) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [animate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || isTouchDevice.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Normalize mouse position from -1 to 1
    mouseRef.current = {
      x: (e.clientX - rect.left - centerX) / centerX,
      y: (e.clientY - rect.top - centerY) / centerY,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: 0, y: 0 };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: "1200px",
        perspectiveOrigin: "center center",
      }}
    >
      <style>{`
        @keyframes underwater-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes underwater-sway {
          0%, 100% {
            transform: translateX(0px) rotate(0deg);
          }
          25% {
            transform: translateX(3px) rotate(0.5deg);
          }
          75% {
            transform: translateX(-3px) rotate(-0.5deg);
          }
        }

        .underwater-content {
          transform-style: preserve-3d;
          transition: transform 0.1s ease-out;
          will-change: transform;
        }

        .underwater-layer-1 {
          animation: underwater-float 6s ease-in-out infinite;
        }

        .underwater-layer-2 {
          animation: underwater-sway 8s ease-in-out infinite;
        }
      `}</style>

      {/* Background water gradient overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-[3] opacity-30"
        style={{
          background: `radial-gradient(ellipse at ${50 + transform.rotateY * 2}% ${50 + transform.rotateX * 2}%, 
            rgba(200, 195, 185, 0.3) 0%, 
            transparent 60%)`,
          transition: 'background 0.3s ease-out',
        }}
      />

      {/* Main content with 3D transform */}
      <div
        ref={contentRef}
        className="underwater-content relative z-10"
        style={{
          transform: `
            rotateX(${-transform.rotateX}deg) 
            rotateY(${transform.rotateY}deg) 
            translateZ(${transform.translateZ}px)
          `,
        }}
      >
        {children}
      </div>

      {/* Floating particles/bubbles layer */}
      <div className="pointer-events-none fixed inset-0 z-[4] overflow-hidden">
        <div 
          className="absolute w-2 h-2 rounded-full bg-mersi-dark/10"
          style={{
            left: '20%',
            top: '30%',
            animation: 'underwater-float 5s ease-in-out infinite',
            animationDelay: '0s',
          }}
        />
        <div 
          className="absolute w-3 h-3 rounded-full bg-mersi-dark/8"
          style={{
            left: '70%',
            top: '60%',
            animation: 'underwater-float 7s ease-in-out infinite',
            animationDelay: '1s',
          }}
        />
        <div 
          className="absolute w-1.5 h-1.5 rounded-full bg-mersi-dark/12"
          style={{
            left: '40%',
            top: '80%',
            animation: 'underwater-float 6s ease-in-out infinite',
            animationDelay: '2s',
          }}
        />
        <div 
          className="absolute w-2.5 h-2.5 rounded-full bg-mersi-dark/6"
          style={{
            left: '85%',
            top: '20%',
            animation: 'underwater-float 8s ease-in-out infinite',
            animationDelay: '0.5s',
          }}
        />
      </div>
    </div>
  );
}
