import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface LineMaskRevealProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  stagger?: number;
  easing?: string;
  threshold?: number;
  /** When false, text stays hidden until enabled becomes true. Defaults to true. */
  enabled?: boolean;
}

export function LineMaskReveal({
  children,
  className,
  duration = 1000,
  stagger = 100,
  easing = 'cubic-bezier(0.22, 1, 0.36, 1)',
  threshold = 0.15,
  enabled = true,
}: LineMaskRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<HTMLElement[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasAnimatedRef = useRef(false);
  const resizeTimeoutRef = useRef<number | undefined>(undefined);
  const originalHTMLRef = useRef<string>('');

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const splitIntoLines = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Restore original content before re-measuring
    if (originalHTMLRef.current) {
      container.innerHTML = originalHTMLRef.current;
    } else {
      originalHTMLRef.current = container.innerHTML;
    }

    const temp = document.createElement('div');
    temp.style.cssText = window.getComputedStyle(container).cssText;
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.width = container.offsetWidth + 'px';
    temp.innerHTML = originalHTMLRef.current;
    document.body.appendChild(temp);

    const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.trim()) {
        textNodes.push(node as Text);
      }
    }

    const lineGroups: { rects: DOMRect[]; nodes: Text[] }[] = [];

    textNodes.forEach((textNode) => {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rects = Array.from(range.getClientRects());

      rects.forEach((rect) => {
        const existingLine = lineGroups.find(
          (group) =>
            Math.abs(group.rects[0].top - rect.top) < 5 &&
            Math.abs(group.rects[0].bottom - rect.bottom) < 5,
        );

        if (existingLine) {
          existingLine.rects.push(rect);
          existingLine.nodes.push(textNode);
        } else {
          lineGroups.push({ rects: [rect], nodes: [textNode] });
        }
      });
    });

    document.body.removeChild(temp);

    container.innerHTML = '';
    const lineElements: HTMLElement[] = [];

    lineGroups.forEach((group, index) => {
      const lineWrapper = document.createElement('span');
      lineWrapper.style.display = 'block';
      lineWrapper.style.overflow = 'hidden';
      lineWrapper.style.position = 'relative';

      const lineInner = document.createElement('span');
      lineInner.style.display = 'block';
      lineInner.style.transform = prefersReducedMotion
        ? 'translateY(0)'
        : 'translateY(110%)';
      lineInner.style.transition = prefersReducedMotion
        ? 'none'
        : `transform ${duration}ms ${easing} ${index * stagger}ms`;

      const lineText = group.nodes
        .map((n) => n.textContent)
        .join('')
        .trim();
      lineInner.textContent = lineText;

      lineWrapper.appendChild(lineInner);
      container.appendChild(lineWrapper);
      lineElements.push(lineInner);
    });

    setLines(lineElements);
  };

  const animateLines = () => {
    if (hasAnimatedRef.current || prefersReducedMotion) return;

    lines.forEach((line) => {
      line.style.transform = 'translateY(0)';
    });

    hasAnimatedRef.current = true;
  };

  useEffect(() => {
    if (!enabled || !containerRef.current || prefersReducedMotion || lines.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            animateLines();
          }
        });
      },
      { threshold, rootMargin: '0px' },
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, lines, threshold, prefersReducedMotion]);

  useEffect(() => {
    splitIntoLines();

    const handleResize = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        hasAnimatedRef.current = false;
        splitIntoLines();
      }, 250);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion && containerRef.current) {
      containerRef.current.style.opacity = '1';
    }
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className={cn('line-mask-reveal', className)}
      style={{ opacity: prefersReducedMotion ? 1 : undefined }}
    >
      {children}
    </div>
  );
}
