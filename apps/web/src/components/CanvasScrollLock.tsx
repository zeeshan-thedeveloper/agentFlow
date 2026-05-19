'use client';

import { useEffect } from 'react';

/** Canvas is full-viewport; lock document scroll only on /canvas routes. */
export function CanvasScrollLock() {
  useEffect(() => {
    document.documentElement.classList.add('canvas-scroll-lock');
    return () => {
      document.documentElement.classList.remove('canvas-scroll-lock');
    };
  }, []);

  return null;
}
