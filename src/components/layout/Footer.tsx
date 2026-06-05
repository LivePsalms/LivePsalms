import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

export function Footer() {
  const footerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const ctx = gsap.context(() => {
      // Animate footer content elements on scroll reveal — short lag so
      // users feel the "hit" at the bottom before content rises in.
      gsap.from('.footer-animate', {
        y: 40,
        opacity: 0,
        duration: 1,
        delay: 0,
        ease: 'power3.out',
        stagger: 0.2,
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      });

      // Subtle scale pulse on the logo watermark
      gsap.to('.footer-watermark', {
        scale: 1.03,
        opacity: 0.12,
        duration: 4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }, footerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={footerRef}
      className="relative h-[50vh]"
      style={{ clipPath: 'polygon(0% 0, 100% 0%, 100% 100%, 0 100%)' }}
    >
      <div className="relative h-[calc(100vh+50vh)] -top-[100vh]">
        <div className="h-[50vh] sticky top-[calc(100vh-50vh)]">
          <div
            ref={contentRef}
            className="relative h-full w-full flex flex-col items-center justify-end overflow-hidden"
          >
            {/* Background image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/Psalms footer.jpg')" }}
            />

            {/* Subtle grain overlay */}
            <div
              className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
              style={{ backgroundImage: "url('/grain-overlay.png')" }}
            />

            {/* A logo watermark overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15]">
              <img
                src="/logo-icon.png"
                alt=""
                className="w-[50vw] max-w-[500px] invert"
              />
            </div>

            {/* Main logo — centered on the A watermark */}
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="footer-animate -translate-y-2 md:-translate-y-4">
                <img
                  src="/Psalms.png"
                  alt="Live Psalms"
                  className="w-40 md:w-56"
                />
              </div>
            </div>

            {/* Footer content */}
            <div className="relative z-10 w-full px-6 md:px-12 pb-8 md:pb-12 flex flex-col items-center gap-8 mt-auto">

              {/* Bottom bar */}
              <div className="footer-animate w-full flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
                <div className="flex items-center gap-6">
                  <Link
                    to="/privacy"
                    className="text-white/50 text-xs md:text-sm font-sans tracking-wide hover:text-white/80 transition-colors duration-300"
                  >
                    Privacy
                  </Link>
                  <Link
                    to="/terms"
                    className="text-white/50 text-xs md:text-sm font-sans tracking-wide hover:text-white/80 transition-colors duration-300"
                  >
                    Terms
                  </Link>
                </div>

                <p className="text-white/40 text-xs md:text-sm font-sans tracking-wide">
                  &copy;2026 Live Psalms
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
