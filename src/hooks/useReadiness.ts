import { useEffect, useState } from 'react';
import { parseReadiness } from '../simulation/presentation';
import type { DatasetStatus, Readiness } from '../simulation/presentation';

// Startup is blocking in the existing backend. A failed connection cannot distinguish
// an absent server from one still loading; never label either as ready.
export function useReadiness() {
  const [state, setState] = useState<Readiness>('loading');
  const [data, setData] = useState<DatasetStatus | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let abort: AbortController;
    const poll = async () => {
      abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 4000);
      try {
        const response = await fetch('http://127.0.0.1:8000/connectome/status', { signal: abort.signal });
        const status = response.ok ? parseReadiness(await response.json()) : null;
        if (!stopped) { setData(status); setState(status ? 'ready' : 'unavailable'); }
      } catch { if (!stopped) { setData(null); setState('unavailable'); } }
      finally { clearTimeout(timeout); if (!stopped) timer = setTimeout(poll, 5000); }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); abort?.abort(); };
  }, []);
  return { state, data };
}
