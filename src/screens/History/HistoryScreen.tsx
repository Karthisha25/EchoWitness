import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatternAnalysisCard } from '@/components/ui/PatternAnalysisCard';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/routes/paths';
import { listIncidents } from '@/services/incidents';
import type { Incident } from '@/types';

export function HistoryScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void listIncidents(user.uid)
      .then(setIncidents)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load history.'),
      )
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <section className="screen-card stack">
      <div>
        <h2>History</h2>
        <p className="muted">Your past incident entries, newest first.</p>
      </div>

      {loading && <p className="muted">Loading history…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && incidents.length === 0 && (
        <p className="muted">No entries yet.</p>
      )}

      <ul className="incident-list">
        {incidents.map((incident) => (
          <li key={incident.incidentId} className="history-item">
            <button
              type="button"
              className="list-button history-button"
              onClick={() => navigate(ROUTES.review(incident.incidentId))}
            >
              <div>
                <strong>{incident.structuredEntry.date ?? 'Undated entry'}</strong>
                <p className="muted small">
                  {incident.structuredEntry.description?.slice(0, 100) ??
                    'No description yet'}
                </p>
                {incident.structuredEntry.personsInvolved.length > 0 && (
                  <p className="muted small">
                    Persons: {incident.structuredEntry.personsInvolved.join(', ')}
                  </p>
                )}
              </div>
              <div className="badge-row">
                <span className="badge">{incident.status}</span>
                {incident.patternAnalysis?.escalationSummary && (
                  <span className="badge warning">Pattern detected</span>
                )}
              </div>
            </button>
            {incident.patternAnalysis && (
              <PatternAnalysisCard
                analysis={incident.patternAnalysis}
                personsInvolved={incident.structuredEntry.personsInvolved}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
