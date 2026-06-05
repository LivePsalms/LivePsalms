import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

type AnimationName = 'blur' | 'fade' | 'slide-up' | 'slide-down';

interface CtxValue {
  isHovered: boolean;
  reduced: boolean;
}

const TextStaggerHoverCtx = createContext<CtxValue | null>(null);

function useStaggerCtx(): CtxValue {
  const v = useContext(TextStaggerHoverCtx);
  if (!v) {
    throw new Error(
      'TextStaggerHoverActive/Hidden must be rendered inside <TextStaggerHover>',
    );
  }
  return v;
}

const STAGGER = 0.025;
const DURATION = 0.42;
const EASE = [0.4, 0, 0.2, 1] as const;

function buildVariants(
  animation: AnimationName,
  role: 'active' | 'hidden',
): { container: Variants; letter: Variants } {
  const container: Variants = {
    rest: { transition: { staggerChildren: STAGGER, staggerDirection: -1 } },
    hover: { transition: { staggerChildren: STAGGER } },
  };

  // For "active" role: visible at rest, hidden on hover.
  // For "hidden" role: hidden at rest, visible on hover.
  const restState = (rest: Record<string, unknown>, hover: Record<string, unknown>) =>
    role === 'active' ? rest : hover;
  const hoverState = (rest: Record<string, unknown>, hover: Record<string, unknown>) =>
    role === 'active' ? hover : rest;

  const make = (visible: Record<string, unknown>, gone: Record<string, unknown>) => ({
    rest: { ...restState(visible, gone), transition: { duration: DURATION, ease: EASE } },
    hover: { ...hoverState(visible, gone), transition: { duration: DURATION, ease: EASE } },
  });

  switch (animation) {
    case 'blur':
      return {
        container,
        letter: make(
          { opacity: 1, filter: 'blur(0px)' },
          { opacity: 0, filter: 'blur(10px)' },
        ) as Variants,
      };
    case 'fade':
      return {
        container,
        letter: make({ opacity: 1 }, { opacity: 0 }) as Variants,
      };
    case 'slide-up':
      return {
        container,
        letter: make(
          { opacity: 1, y: '0%' },
          { opacity: 0, y: '-100%' },
        ) as Variants,
      };
    case 'slide-down':
      return {
        container,
        letter: make(
          { opacity: 1, y: '0%' },
          { opacity: 0, y: '100%' },
        ) as Variants,
      };
  }
}

type TextStaggerHoverProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function TextStaggerHover<T extends ElementType = 'span'>({
  as,
  children,
  className,
  ...rest
}: TextStaggerHoverProps<T>) {
  const Tag = (as ?? 'span') as ElementType;
  const reduced = useReducedMotion() ?? false;
  const [isHovered, setIsHovered] = useState(false);
  const value = useMemo<CtxValue>(
    () => ({ isHovered, reduced }),
    [isHovered, reduced],
  );

  const composedClassName = [
    'relative inline-block align-baseline',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <TextStaggerHoverCtx.Provider value={value}>
      <Tag
        {...(rest as Record<string, unknown>)}
        className={composedClassName}
        onMouseEnter={(e: React.MouseEvent) => {
          setIsHovered(true);
          (rest as { onMouseEnter?: (e: React.MouseEvent) => void }).onMouseEnter?.(e);
        }}
        onMouseLeave={(e: React.MouseEvent) => {
          setIsHovered(false);
          (rest as { onMouseLeave?: (e: React.MouseEvent) => void }).onMouseLeave?.(e);
        }}
        onFocus={(e: React.FocusEvent) => {
          setIsHovered(true);
          (rest as { onFocus?: (e: React.FocusEvent) => void }).onFocus?.(e);
        }}
        onBlur={(e: React.FocusEvent) => {
          setIsHovered(false);
          (rest as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(e);
        }}
      >
        {children}
      </Tag>
    </TextStaggerHoverCtx.Provider>
  );
}

interface TextStaggerHoverChildProps {
  children: string;
  animation?: AnimationName;
  className?: string;
}

export function TextStaggerHoverActive({
  children,
  animation = 'blur',
  className,
}: TextStaggerHoverChildProps) {
  const { isHovered, reduced } = useStaggerCtx();
  const { container, letter } = useMemo(
    () => buildVariants(animation, 'active'),
    [animation],
  );
  const composed = ['inline-block whitespace-pre', className].filter(Boolean).join(' ');
  const target = isHovered ? 'hover' : 'rest';

  if (reduced) {
    return (
      <span
        className={composed}
        style={{ opacity: isHovered ? 0 : 1, transition: 'opacity 200ms ease' }}
      >
        {children}
      </span>
    );
  }

  return (
    <motion.span
      className={composed}
      variants={container}
      initial="rest"
      animate={target}
    >
      {Array.from(children).map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          variants={letter}
          className="inline-block"
          style={{ willChange: 'filter, opacity, transform' }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

export function TextStaggerHoverHidden({
  children,
  animation = 'blur',
  className,
}: TextStaggerHoverChildProps) {
  const { isHovered, reduced } = useStaggerCtx();
  const { container, letter } = useMemo(
    () => buildVariants(animation, 'hidden'),
    [animation],
  );
  const composed = [
    'pointer-events-none absolute left-0 top-0 inline-block whitespace-pre',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const target = isHovered ? 'hover' : 'rest';

  if (reduced) {
    return (
      <span
        aria-hidden
        className={composed}
        style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 200ms ease' }}
      >
        {children}
      </span>
    );
  }

  return (
    <motion.span
      aria-hidden
      className={composed}
      variants={container}
      initial="rest"
      animate={target}
    >
      {Array.from(children).map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          variants={letter}
          className="inline-block"
          style={{ willChange: 'filter, opacity, transform' }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}
