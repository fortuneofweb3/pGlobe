'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.configure({
      showSpinner: false,
      minimum: 0.08,
      easing: 'ease',
      speed: 200,
      trickleSpeed: 200,
    });
  }, []);

  useEffect(() => {
    // When pathname changes, complete the progress
    NProgress.done();
  }, [pathname, searchParams]);

  // Add click listener to start progress on navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      // Check if it's an internal navigation link
      if (anchor && anchor.href && anchor.href.startsWith(window.location.origin)) {
        const href = anchor.getAttribute('href');
        // Skip if it's the same page or hash link
        if (href && !href.startsWith('#') && href !== pathname) {
          NProgress.start();
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  return null;
}
