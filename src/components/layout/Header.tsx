import { useState, useEffect } from 'react';
import { navItems } from '@/data/projects';
import { X, Menu } from 'lucide-react';

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = true }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isMobileMenuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'backdrop-blur-md py-3'
          : 'bg-transparent py-4 md:py-6'
      }`}
      style={{ 
        perspective: '1000px',
        background: isScrolled ? 'rgba(240, 236, 232, 0.95)' : 'transparent',
      }}
    >
      <div className="w-full px-4 md:px-6 lg:px-10 flex items-center justify-between">
        {/* Logo - 3D emergence effect */}
        <a 
          href="#" 
          className="flex items-center z-50"
          style={{
            opacity: showNav ? 1 : 0,
            transform: showNav 
              ? 'translateZ(0) rotateX(0deg) scale(1)' 
              : 'translateZ(-100px) rotateX(-25deg) scale(0.85)',
            filter: showNav ? 'blur(0px)' : 'blur(8px)',
            transition: 'all 3.5s cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '0ms',
            transformOrigin: 'center top',
          }}
        >
          <img 
            src="/logo-icon.png" 
            alt="PSALMS" 
            className="h-8 md:h-10 w-auto object-contain"
          />
        </a>

        {/* Desktop Navigation - 3D emergence effect */}
        <nav 
          className="hidden md:flex items-center gap-6 lg:gap-8"
          style={{
            opacity: showNav ? 1 : 0,
            transform: showNav 
              ? 'translateZ(0) rotateX(0deg) scale(1)' 
              : 'translateZ(-150px) rotateX(-35deg) scale(0.8)',
            filter: showNav ? 'blur(0px)' : 'blur(12px)',
            transition: 'all 3.5s cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '600ms',
            transformOrigin: 'center top',
          }}
        >
          {navItems.map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className="text-[10px] lg:text-[11px] font-medium tracking-widest hover:opacity-60 transition-opacity duration-300"
              style={{
                color: 'var(--deep-umber)',
                opacity: showNav ? 1 : 0,
                transform: showNav 
                  ? 'translateY(0)' 
                  : 'translateY(20px)',
                transition: `all 2.5s cubic-bezier(0.16, 1, 0.3, 1)`,
                transitionDelay: `${800 + index * 150}ms`,
              }}
            >
              {item.label}
            </a>
          ))}
          <span 
            style={{
              color: 'var(--deep-umber)',
              opacity: showNav ? 0.3 : 0,
              transition: 'opacity 2s ease',
              transitionDelay: '1400ms',
            }}
          >—</span>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] lg:text-[11px] font-medium tracking-widest hover:opacity-60 transition-opacity duration-300"
            style={{
              color: 'var(--deep-umber)',
              opacity: showNav ? 1 : 0,
              transform: showNav 
                ? 'translateY(0)' 
                : 'translateY(20px)',
              transition: 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: '1500ms',
            }}
          >
            INSTAGRAM
          </a>
        </nav>

        {/* Mobile Menu Button - 3D emergence effect */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex items-center justify-center w-10 h-10 z-50"
          style={{
            opacity: showNav ? 1 : 0,
            transform: showNav 
              ? 'translateZ(0) rotateX(0deg) scale(1)' 
              : 'translateZ(-100px) rotateX(-25deg) scale(0.85)',
            filter: showNav ? 'blur(0px)' : 'blur(8px)',
            transition: 'all 3.5s cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '600ms',
            transformOrigin: 'center top',
          }}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6" style={{ color: 'var(--deep-umber)' }} />
          ) : (
            <Menu className="w-6 h-6" style={{ color: 'var(--deep-umber)' }} />
          )}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 z-40 flex flex-col items-center justify-center transition-all duration-500 md:hidden ${
          isMobileMenuOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'var(--plaster)' }}
      >
        <nav className="flex flex-col items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-lg font-medium tracking-widest hover:opacity-60 transition-opacity duration-300"
              style={{ color: 'var(--deep-umber)' }}
            >
              {item.label}
            </a>
          ))}
          <div 
            className="w-8 h-px my-2" 
            style={{ background: 'var(--deep-umber)', opacity: 0.2 }}
          />
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-lg font-medium tracking-widest hover:opacity-60 transition-opacity duration-300"
            style={{ color: 'var(--deep-umber)' }}
          >
            INSTAGRAM
          </a>
        </nav>
      </div>
    </header>
  );
}
