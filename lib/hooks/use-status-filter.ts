'use client';

import { useSearchParams } from 'next/navigation';

/** Keep list filters shareable and restore them when navigating back. */
export function useStatusFilter<T extends string>(allowed: readonly T[], fallback: T) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('status');
  const status = allowed.find(value => value === requested) ?? fallback;

  function setStatus(value: T) {
    const url = new URL(window.location.href);
    if (value === fallback) url.searchParams.delete('status');
    else url.searchParams.set('status', value);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return [status, setStatus] as const;
}
