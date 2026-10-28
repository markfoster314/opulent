import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: ReactNode;
  /** How far the block travels up in pixels; a larger number snaps harder. */
  distance?: number;
  /** Delay before the motion starts, in milliseconds. */
  delay?: number;
}

/** Moves opacity and transform only, so nothing jumps; reduced-motion readers get it at once. */
export function Reveal({ children, distance = 40, delay = 250 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShown(true);
        observer.disconnect();
      },
      // Trigger a little way into the window; threshold zero keeps a tall block from never firing.
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translateY(${distance}px)`,
        transition: 'opacity 520ms ease, transform 560ms cubic-bezier(0.22, 1, 0.36, 1)',
        ...(delay === 0 ? {} : { transitionDelay: `${delay}ms` }),
        '@media (prefers-reduced-motion: reduce)': {
          opacity: 1,
          transform: 'none',
          transition: 'none',
        },
      }}
    >
      {children}
    </Box>
  );
}
