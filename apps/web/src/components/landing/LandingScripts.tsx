'use client';

import { useEffect } from 'react';

export function LandingScripts() {
  useEffect(() => {
    const nav = document.getElementById('landing-nav');
    const onScroll = () => {
      if (window.scrollY > 8) nav?.classList.add('nav-blur');
      else nav?.classList.remove('nav-blur');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return null;
}
