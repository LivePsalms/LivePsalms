import { useRef, useEffect, useState } from 'react';
import { galleryImages } from '@/data/projects';

export function GalleryStrip() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Duplicate images for seamless loop
  const allImages = [...galleryImages, ...galleryImages];

  return (
    <div
      ref={scrollRef}
      className="relative w-full overflow-hidden py-12 md:py-16"
    >
      <div
        className={`flex gap-6 items-center animate-marquee transition-opacity duration-700 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ width: 'fit-content' }}
      >
        {allImages.map((image, index) => {
          // Cycle through varied heights so the strip's top/bottom edges aren't perfect lines
          const heightCycle = [
            { w: 'w-56 md:w-72', h: 'h-40 md:h-48' },
            { w: 'w-60 md:w-80', h: 'h-44 md:h-56' },
            { w: 'w-52 md:w-64', h: 'h-36 md:h-44' },
            { w: 'w-64 md:w-80', h: 'h-48 md:h-60' },
            { w: 'w-56 md:w-72', h: 'h-40 md:h-52' },
          ];
          const { w, h } = heightCycle[index % heightCycle.length];
          return (
            <div
              key={index}
              className={`flex-shrink-0 ${w} ${h} overflow-hidden`}
              style={{ borderRadius: '2px' }}
            >
              <img
                src={image}
                alt={`Gallery image ${index + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
