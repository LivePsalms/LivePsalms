import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollToPurposeGrid } from './two-path-interlude-actions';

gsap.registerPlugin(ScrollTrigger);

export function TwoPathInterlude() {
  const sectionRef = useRef<HTMLElement>(null);
  const hairlineRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  const handleReadBelow = () => {
    scrollToPurposeGrid({
      findElementById: (id) => document.getElementById(id),
    });
  };

  useEffect(() => {
    const section = sectionRef.current;
    const hairline = hairlineRef.current;
    const left = leftColRef.current;
    const right = rightColRef.current;
    if (!section || !hairline || !left || !right) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              section.dataset.entered = 'true';
            }
          }
        },
        { threshold: 0.4 },
      );
      observer.observe(section);
      return () => observer.disconnect();
    }

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        section.dataset.entered = 'true';
      },
    });

    // Hairline radiates from center outward, 0.9s.
    tl.to(hairline, {
      scaleY: 1,
      duration: 0.9,
      ease: 'power2.out',
    }, 0);

    // Columns fade in and drift inward, starting at 0.6s, 1.2s duration.
    // Tween both x and y because the desktop initial state is translateX(±20px)
    // but the mobile media query (in index.css) overrides it to translateY(20px).
    // Tweening both lets the same useEffect cover both layouts.
    tl.to([left, right], {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 1.2,
      ease: 'power3.out',
    }, 0.6);

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      st.kill();
      tl.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="two-path-interlude"
      data-entered="false"
      aria-label="Two ways to continue"
    >
      <div ref={hairlineRef} className="two-path-hairline" aria-hidden="true" />

      <div ref={leftColRef} className="two-path-col two-path-col-left">
        <p className="two-path-statement">
          Let's take a journey through God's word and find the peace that returns your joy. Let restoration guide you to serenity.
        </p>
        <button
          type="button"
          onClick={handleReadBelow}
          className="two-path-cta two-path-cta-read"
          aria-label="Read below — scroll to the purpose grid"
        >
          <span className="two-path-cta-label">Read Below</span>
          <span className="two-path-arrow" aria-hidden="true" />
        </button>
      </div>

      <div ref={rightColRef} className="two-path-col two-path-col-right">
        <p className="two-path-statement">
          Take a moment to write about where you're at and see how God meets you there.
        </p>
        <Link
          to="/notepad"
          className="two-path-cta two-path-cta-notepad"
          aria-label="Go to Notepad"
        >
          <span className="two-path-cta-label">Go to Notepad</span>
          <span className="two-path-underline" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
