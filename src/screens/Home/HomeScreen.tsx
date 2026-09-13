import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/routes/paths';
import { createIncident, listIncidents, updateUserSettings } from '@/services/incidents';
import type { Incident } from '@/types';

export function HomeScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const disguiseMode = profile?.settings.disguiseMode ?? true;

  useEffect(() => {
    if (!user) {
      return;
    }
    void listIncidents(user.uid)
      .then(setIncidents)
      .finally(() => setLoading(false));
  }, [user]);

  const recordIncident = async () => {
    if (!user) {
      return;
    }
    setCreating(true);
    try {
      const incident = await createIncident(user.uid, 'live_capture');
      navigate(ROUTES.capture(incident.incidentId), { state: { autoStart: true } });
    } finally {
      setCreating(false);
    }
  };

  const startInterview = async () => {
    if (!user) {
      return;
    }
    setCreating(true);
    try {
      const incident = await createIncident(user.uid, 'guided_interview');
      navigate(ROUTES.interview(incident.incidentId));
    } finally {
      setCreating(false);
    }
  };

  const toggleDisguise = async () => {
    if (!user) {
      return;
    }
    await updateUserSettings(user.uid, { disguiseMode: !disguiseMode });
    await refreshProfile();
  };

  return (
    <div className="stack">
      <section className="screen-card hero-record-card">
        <p className="eyebrow">During an incident</p>
        <h2>Record now</h2>
        <p className="muted">
          One tap starts audio capture, live transcription, and local tamper-evident hashing.
        </p>
        <button
          type="button"
          className={disguiseMode ? 'disguised-record-button' : 'record-button record-button--hero'}
          disabled={creating}
          onClick={() => void recordIncident()}
        >
          {disguiseMode ? '🧮 Calculator' : '● Record Incident'}
        </button>
      </section>

      <section className="screen-card">
        <div className="row-between">
          <div>
            <h2>Settings</h2>
            <p className="muted">Control how capture appears on this device.</p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={disguiseMode}
              onChange={() => void toggleDisguise()}
            />
            <span>Disguise capture button</span>
          </label>
        </div>
        <div className="action-grid">
          <button
            type="button"
            className="secondary-button"
            disabled={creating}
            onClick={() => void startInterview()}
          >
            Guided interview instead
          </button>
        </div>
      </section>

      <section className="screen-card">
        <div className="row-between">
          <h2>Recent entries</h2>
          <button
            type="button"
            className="text-button"
            onClick={() => navigate(ROUTES.history)}
          >
            View all
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading entries…</p>
        ) : incidents.length === 0 ? (
          <p className="muted">No incidents yet. Tap Record Incident above.</p>
        ) : (
          <ul className="incident-list">
            {incidents.slice(0, 3).map((incident) => (
              <li key={incident.incidentId}>
                <button
                  type="button"
                  className="list-button"
                  onClick={() => navigate(ROUTES.review(incident.incidentId))}
                >
                  <span>{incident.structuredEntry.date ?? 'Undated entry'}</span>
                  <span className="badge">{incident.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
