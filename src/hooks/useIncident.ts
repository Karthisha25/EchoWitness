import { useCallback, useEffect, useState } from 'react';
import { getIncident } from '@/services/incidents';
import type { Incident } from '@/types';

export function useIncident(incidentId: string | undefined) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!incidentId) {
        setIncident(null);
        setLoading(false);
        return;
      }
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await getIncident(incidentId);
        setIncident(data);
        if (!data) {
          setError('Incident not found.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incident.');
      } finally {
        setLoading(false);
      }
    },
    [incidentId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { incident, loading, error, refresh };
}
