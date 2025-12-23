'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { startProgress } from '@/lib/nprogress';

export function useProgressRouter() {
  const router = useRouter();

  const push = useCallback((href: string, options?: { scroll?: boolean }) => {
    startProgress();
    router.push(href, options);
  }, [router]);

  const replace = useCallback((href: string, options?: { scroll?: boolean }) => {
    startProgress();
    router.replace(href, options);
  }, [router]);

  return {
    ...router,
    push,
    replace,
  };
}
