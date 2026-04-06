"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function PinnedImageSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const verseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    const frame = frameRef.current;
    const verse = verseRef.current;
    if (!section || !image || !frame || !verse) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=150%",
        pin: true,
        scrub: 1,
        snap: {
          snapTo: (progress) => {
            if (progress < 0.5) return 0;
            return 1;
          },
          duration: { min: 0.2, max: 0.5 },
          delay: 0,
          ease: "power1.inOut",
        },
      },
    });

    // Verse fades out as user scrolls
    tl.fromTo(
      verse,
      { opacity: 1, y: 0 },
      { opacity: 0, y: -30, ease: "power2.inOut" },
      0
    );

    // Frame expands organically
    tl.fromTo(
      frame,
      { scale: 1 },
      { scale: 1.12, ease: "power2.inOut" },
      0
    );

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden"
    >
      {/* Organic decorative elements - soft circles */}
      <div 
        className="absolute pointer-events-none"
        style={{
          width: "60vw",
          height: "60vw",
          maxWidth: "800px",
          maxHeight: "800px",
          background: "radial-gradient(circle, rgba(188,179,163,0.08) 0%, transparent 70%)",
          borderRadius: "50%",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      {/* Verse - centered */}
      <div
        ref={verseRef}
        className="absolute inset-x-0 top-[12vh] md:top-[15vh] flex flex-col items-center justify-start z-20 px-6"
      >
        <div className="text-center max-w-4xl">
          <p className="quote-text">
            "He leads me beside still waters.
          </p>
          <p className="quote-text mt-2 md:mt-3">
            He restores my soul."
          </p>
          <p className="quote-attr mt-6 md:mt-8">
            Psalm 23:2-3
          </p>
        </div>
      </div>

      {/* Framed image - ornate frame in the style of frame_9s */}
      <div
        ref={frameRef}
        className="absolute z-10"
        style={{
          width: "clamp(320px, 42vw, 560px)",
          left: "50%",
          top: "55%",
          transform: "translateX(-50%)",
          perspective: "1200px",
        }}
      >
        <div
          style={{
            padding: "3px",
            background:
              "linear-gradient(135deg, rgba(200,185,165,0.6) 0%, rgba(220,210,195,0.9) 30%, rgba(245,240,230,1) 50%, rgba(220,210,195,0.9) 70%, rgba(200,185,165,0.6) 100%)",
            borderRadius: "4px",
            boxShadow:
              "0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 20px 60px rgba(0,0,0,0.08), 0 40px 80px rgba(80,60,40,0.06), inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(180deg, #ece8e2 0%, #e6e2dc 40%, #e2ded8 100%)",
              padding: "30px 40px",
              borderRadius: "3px",
              position: "relative",
              boxShadow:
                "inset 0 1px 3px rgba(0,0,0,0.06), inset 0 0 20px rgba(0,0,0,0.02)",
            }}
          >
            <div
              aria-hidden
              style={{
                content: '""',
                position: "absolute",
                inset: "6px",
                border: "1px solid rgba(255,255,255,0.35)",
                borderBottomColor: "rgba(0,0,0,0.04)",
                borderRightColor: "rgba(0,0,0,0.04)",
                borderRadius: "2px",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "relative",
                borderRadius: "3px",
                overflow: "hidden",
                boxShadow:
                  "inset 0 2px 6px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1), 0 -1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <img
                ref={imageRef}
                src="/pinned-image.jpg"
                alt="Featured"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  aspectRatio: "16 / 9",
                  objectFit: "cover",
                  filter: "contrast(1.02) saturate(0.95)",
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
