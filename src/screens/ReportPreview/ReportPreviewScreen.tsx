import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LEGAL_DISCLAIMER } from '@/constants/poshAct';
import { PatternAnalysisCard } from '@/components/ui/PatternAnalysisCard';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { ProcessingBanner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { useIncident } from '@/hooks/useIncident';
import {
  analyzeIncidentPatterns,
  getIncident,
  finalizeIncident,
} from '@/services/incidents';
import { downloadIncidentReport, reportToObjectUrl } from '@/services/reportPdf';

export function ReportPreviewScreen() {
  const { incidentId } = useParams();
  const { user } = useAuth();
  const { incident, loading, error, refresh } = useIncident(incidentId);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [displayIncident, setDisplayIncident] = useState<typeof incident>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (loading) {
    return <LoadingState title="Report Preview" message="Loading report data…" />;
  }

  if (error || !incident) {
    return <ErrorState title="Report Preview" message={error ?? 'Incident not found.'} />;
  }

  const reportIncident = displayIncident ?? incident;

  const finalizeAndPreview = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (user && !incident.patternAnalysis) {
        await analyzeIncidentPatterns(
          user.uid,
          incident.incidentId,
          incident.structuredEntry,
        );
      }

      await finalizeIncident(incident.incidentId, incident.structuredEntry);
      const latest = await getIncident(incident.incidentId);
      if (!latest) {
        throw new Error('Could not reload incident after finalization.');
      }
      setDisplayIncident(latest);
      await refresh({ silent: true });
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(reportToObjectUrl(latest));
      setMessage('Report finalized. Content hash saved to Firestore.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to finalize report.');
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = async () => {
    const latest = await getIncident(incident.incidentId);
    if (latest) {
      downloadIncidentReport(latest);
    }
  };

  return (
    <section className="screen-card stack fade-in">
      <div>
        <h2>Report Preview</h2>
        <p className="muted">
          Generate a PDF report with structured narrative, POSH mapping, and integrity
          hashes.
        </p>
      </div>

      <div className="callout">{LEGAL_DISCLAIMER}</div>

      <div className="report-summary">
        <p>
          <strong>Date:</strong> {reportIncident.structuredEntry.date ?? 'Not specified'}
        </p>
        <p>
          <strong>POSH section:</strong>{' '}
          {reportIncident.legalMapping?.poshSection ?? 'Not mapped yet'}
        </p>
        <p>
          <strong>Transcript hash:</strong>{' '}
          {reportIncident.integrity.transcriptHash ?? 'Not captured'}
        </p>
        <p>
          <strong>Content hash:</strong>{' '}
          {reportIncident.integrity.contentHash ?? 'Not finalized'}
        </p>
      </div>

      <PatternAnalysisCard
        analysis={reportIncident.patternAnalysis}
        personsInvolved={reportIncident.structuredEntry.personsInvolved}
      />

      {busy && (
        <ProcessingBanner
          title="Generating your report…"
          detail="Hashing the structured entry and rendering the PDF."
        />
      )}

      <div className="action-grid">
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void finalizeAndPreview()}
        >
          {busy ? 'Finalizing…' : 'Finalize & preview PDF'}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!reportIncident.integrity.contentHash || busy}
          onClick={() => void downloadReport()}
        >
          Download PDF
        </button>
      </div>

      {previewUrl && (
        <iframe title="Report preview" className="pdf-preview" src={previewUrl} />
      )}

      {message && <p className="muted">{message}</p>}
    </section>
  );
}
