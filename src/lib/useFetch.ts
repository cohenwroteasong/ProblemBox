import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/**
 * Fetch JSON from the API. Keeps the previous data while refetching so views don't
 * flash empty when filters change or live events trigger a reload.
 */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === seq.current) setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
