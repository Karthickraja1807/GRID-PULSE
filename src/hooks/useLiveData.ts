import { useState, useEffect, useRef } from 'react';
import { fetchLiveTelemetry, type LiveTelemetry, type ThingerCredentials } from '../services/api';

interface UseLiveDataResult {
  data: LiveTelemetry | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useLiveData(
  creds: ThingerCredentials,
  enabled: boolean = true
): UseLiveDataResult {
  const [data, setData] = useState<LiveTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const credsRef = useRef<ThingerCredentials>(creds);

  // Sync credentials changes without restarting the interval
  useEffect(() => {
    credsRef.current = creds;
  }, [creds]);

  const fetchData = async () => {
    try {
      const result = await fetchLiveTelemetry(credsRef.current);
      setData(result);
      setError(null);
    } catch (err: any) {
      console.error('Telemetry polling error:', err);
      setError(err.message || 'An error occurred while fetching live telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Initial fetch
    fetchData();

    // Setup polling every 1000ms
    const timer = setInterval(() => {
      fetchData();
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [enabled]);

  return {
    data,
    error,
    isLoading,
    refetch: fetchData
  };
}
