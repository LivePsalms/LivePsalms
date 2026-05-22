import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollToPurposeGrid } from './two-path-interlude-actions';
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from '@/components/ui/text-stagger-hover';

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
              observer.unobserve(section);
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

    // Sequential 1·2·3 reveal — Cathedral pacing, ~4.2s total.
    // Each beat 1.8s; gap of 1.0s between beat starts so they overlap slightly
    // but the sequence is clearly readable (hairline → left rises → right falls).

    // 1 — Hairline radiates from center outward.
    tl.to(hairline, {
      scaleY: 1,
      duration: 1.8,
      ease: 'power2.out',
    }, 0.1);

    // 2 — Left column rises from below (translateY(+60px) → 0, opacity 0 → 1).
    tl.to(left, {
      opacity: 1,
      y: 0,
      duration: 1.8,
      ease: 'power3.out',
    }, 1.4);

    // 3 — Right column falls from above (translateY(-60px) → 0, opacity 0 → 1).
    tl.to(right, {
      opacity: 1,
      y: 0,
      duration: 1.8,
      ease: 'power3.out',
    }, 2.4);

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
          <TextStaggerHover as="span" className="two-path-cta-label">
            <TextStaggerHoverActive animation="blur">Read Below</TextStaggerHoverActive>
            <TextStaggerHoverHidden animation="blur">Read Below</TextStaggerHoverHidden>
          </TextStaggerHover>
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
          <TextStaggerHover as="span" className="two-path-cta-label">
            <TextStaggerHoverActive animation="blur">Go to Notepad</TextStaggerHoverActive>
            <TextStaggerHoverHidden animation="blur">Go to Notepad</TextStaggerHoverHidden>
          </TextStaggerHover>
          <span className="two-path-underline" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
