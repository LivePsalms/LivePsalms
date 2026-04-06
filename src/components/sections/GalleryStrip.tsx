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
      {/* Soft gradient fade at top and bottom for seamless transition */}
      <div 
        className="absolute top-0 left-0 right-0 h-24 pointer-events-none z-10"
        style={{ background: 'linear-gradient(180deg, var(--plaster) 0%, transparent 100%)' }}
      />
      <div 
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-10"
        style={{ background: 'linear-gradient(0deg, var(--plaster) 0%, transparent 100%)' }}
      />
      
      <div
        className={`flex gap-6 animate-marquee transition-opacity duration-700 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ width: 'fit-content' }}
      >
        {allImages.map((image, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-56 md:w-72 h-40 md:h-52 overflow-hidden"
            style={{ borderRadius: '8px' }}
          >
            <img
              src={image}
              alt={`Gallery image ${index + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
