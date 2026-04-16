import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { navItems } from '@/data/projects';
import { X, Menu } from 'lucide-react';

function WaterText({ children, className, style, as: Tag = 'a', ...props }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties; as?: React.ElementType; [key: string]: unknown }) {
  const [isHovered, setIsHovered] = useState(false);
  const text = typeof children === 'string' ? children : '';

  return (
    <Tag
      className={className}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {text.split('').map((char: string, i: number) => (
        <span
          key={i}
          className="inline-block"
          style={{
            animation: isHovered ? `water-letter 2.4s ease-in-out ${i * 100}ms infinite` : 'none',
            transition: 'transform 0.3s ease',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </Tag>
  );
}

interface HeaderProps {
  showNav?: boolean;
  darkText?: boolean;
}

export function Header({ showNav = true, darkText = false }: HeaderProps) {
  const navigate = useNavigate();
  const textColor = darkText ? 'rgba(255, 255, 255, 0.75)' : 'var(--deep-umber)';
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
        background: isScrolled
          ? (darkText ? 'rgba(0, 0, 0, 0.15)' : 'rgba(240, 236, 232, 0.95)')
          : 'transparent',
      }}
    >
      <div className="w-full px-4 md:px-6 lg:px-10 flex items-center justify-between">
        {/* Logo - 3D emergence effect */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="flex items-center z-50 cursor-pointer"
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
            alt="LivePsalms"
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
            <WaterText
              key={item.label}
              href={item.href}
              as="a"
              className="text-[10px] lg:text-[11px] font-medium tracking-widest transition-opacity duration-300"
              style={{
                color: textColor,
                opacity: showNav ? 1 : 0,
                transform: showNav
                  ? 'translateY(0)'
                  : 'translateY(20px)',
                transition: `all 2.5s cubic-bezier(0.16, 1, 0.3, 1)`,
                transitionDelay: `${800 + index * 150}ms`,
              }}
              onClick={(e: React.MouseEvent) => {
                if (item.href.startsWith('/')) {
                  e.preventDefault();
                  navigate(item.href);
                }
              }}
            >
              {item.label}
            </WaterText>
          ))}
          <span 
            style={{
              color: textColor,
              opacity: showNav ? 0.3 : 0,
              transition: 'opacity 2s ease',
              transitionDelay: '1400ms',
            }}
          >—</span>
          <div
            className="relative group"
            style={{
              opacity: showNav ? 1 : 0,
              transform: showNav
                ? 'translateY(0)'
                : 'translateY(20px)',
              transition: 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: '1500ms',
            }}
          >
            <WaterText
              as="button"
              type="button"
              className="text-[10px] lg:text-[11px] font-medium tracking-widest transition-opacity duration-300 cursor-pointer"
              style={{ color: textColor }}
            >
              SOCIAL
            </WaterText>
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300"
            >
              <div
                className="px-5 py-3 backdrop-blur-md rounded-sm shadow-sm"
                style={{ background: 'rgba(240, 236, 232, 0.95)' }}
              >
                <WaterText
                  as="a"
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] lg:text-[11px] font-medium tracking-widest transition-opacity duration-300 whitespace-nowrap"
                  style={{ color: textColor }}
                >
                  INSTAGRAM
                </WaterText>
              </div>
            </div>
          </div>
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
            <X className="w-6 h-6" style={{ color: textColor }} />
          ) : (
            <Menu className="w-6 h-6" style={{ color: textColor }} />
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
              onClick={(e) => {
                if (item.href.startsWith('/')) {
                  e.preventDefault();
                  navigate(item.href);
                }
                setIsMobileMenuOpen(false);
              }}
              className="text-lg font-medium tracking-widest hover:opacity-60 transition-opacity duration-300"
              style={{ color: textColor }}
            >
              {item.label}
            </a>
          ))}
          <div 
            className="w-8 h-px my-2" 
            style={{ background: 'var(--deep-umber)', opacity: 0.2 }}
          />
          <a
            href="#social"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-lg font-medium tracking-widest hover:opacity-60 transition-opacity duration-300"
            style={{ color: textColor }}
          >
            SOCIAL
          </a>
        </nav>
      </div>
    </header>
  );
}
