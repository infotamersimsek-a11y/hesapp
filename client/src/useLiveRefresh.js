import { useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 7000;

export function useLiveRefresh(onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    const id = setInterval(() => cbRef.current(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
