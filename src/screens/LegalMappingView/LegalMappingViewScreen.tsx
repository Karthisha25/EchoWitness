import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LEGAL_DISCLAIMER } from '@/constants/poshAct';
import { PatternAnalysisCard } from '@/components/ui/PatternAnalysisCard';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { ProcessingBanner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { useIncident } from '@/hooks/useIncident';
import { ROUTES } from '@/routes/paths';
import { mapToPoshAct } from '@/services/gemini';
import {
  analyzeIncidentPatterns,
  saveLegalMapping,
} from '@/services/incidents';
import type { PatternAnalysis } from '@/types';

export function LegalMappingViewScreen() {
  const { incidentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { incident, loading, error } = useIncident(incidentId);
  const [mapping, setMapping] = useState(incident?.legalMapping ?? null);
  const [patternAnalysis, setPatternAnalysis] = useState<PatternAnalysis | null>(
    incident?.patternAnalysis ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (incident?.legalMapping) {
      setMapping(incident.legalMapping);
    }
    if (incident?.patternAnalysis) {
      setPatternAnalysis(incident.patternAnalysis);
    }
  }, [incident?.legalMapping, incident?.patternAnalysis]);

  if (loading) {
    return <LoadingState title="Legal Mapping" message="Loading incident…" />;
  }

  if (error || !incident || !user) {
    return <ErrorState title="Legal Mapping" message={error ?? 'Incident not found.'} />;
  }

  const runMapping = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const legalMapping = await mapToPoshAct(incident.structuredEntry);
      await saveLegalMapping(incident.incidentId, legalMapping);
      setMapping(legalMapping);

      const pattern = await analyzeIncidentPatterns(
        user.uid,
        incident.incidentId,
        incident.structuredEntry,
      );
      setPatternAnalysis(pattern);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Legal mapping failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen-card stack fade-in">
      <div>
        <h2>Legal Mapping View</h2>
        <p className="muted">
          POSH Act section mapping based on your structured entry.
        </p>
      </div>

      <div className="callout">
        <strong>Important:</strong> {LEGAL_DISCLAIMER}
      </div>

      {busy && (
        <ProcessingBanner
          title="Mapping this entry to the POSH Act…"
          detail="Checking related incidents for patterns after mapping."
        />
      )}

      {!mapping ? (
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void runMapping()}
        >
          {busy ? 'Mapping…' : 'Run POSH mapping'}
        </button>
      ) : (
        <div className="stack">
          <div>
            <p className="eyebrow">POSH section</p>
            <p>{mapping.poshSection}</p>
          </div>
          <div>
            <p className="eyebrow">Justification</p>
            <p>{mapping.justification}</p>
          </div>
          <div>
            <p className="eyebrow">Confidence note</p>
            <p>{mapping.confidenceNote}</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate(ROUTES.report(incident.incidentId))}
          >
            Continue to report
          </button>
        </div>
      )}

      <PatternAnalysisCard
        analysis={patternAnalysis}
        personsInvolved={incident.structuredEntry.personsInvolved}
        pending={busy && !patternAnalysis}
      />

      {statusMessage && <p className="error-text">{statusMessage}</p>}
    </section>
  );
}
