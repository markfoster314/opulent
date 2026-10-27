import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: ReactNode;
  /** How far the block travels up, in pixels. A larger number snaps harder. */
  distance?: number;
  /** Delay before the motion starts, in milliseconds. */
  delay?: number;
}

/**
 * Fades a block in and lifts it the last few pixels as it enters the window.
 *
 * The block keeps its place in the page, so nothing jumps and no height changes:
 * only `opacity` and `transform` move, which the browser can animate without a
 * new layout. The observer disconnects after the first trip, so scrolling back up
 * does not replay it. A reader who asked for less motion gets the finished block
 * straight away, with no transition at all.
 */
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
      // Wait until the block is a little way into the window, so the motion is
      // seen rather than already finished at the edge. A threshold of zero keeps
      // a tall block from waiting for a share of itself that never fits.
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
