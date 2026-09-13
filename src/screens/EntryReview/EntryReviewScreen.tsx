import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EvidenceAttachments } from '@/components/evidence/EvidenceAttachments';
import { PatternAnalysisCard } from '@/components/ui/PatternAnalysisCard';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { useIncident } from '@/hooks/useIncident';
import { ROUTES } from '@/routes/paths';
import { downloadAudioRecording, getAudioRecording } from '@/services/indexedDb';
import { saveStructuredEntry } from '@/services/incidents';
import type { StructuredEntry } from '@/types';

export function EntryReviewScreen() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const { incident, loading, error } = useIncident(incidentId);
  const [entry, setEntry] = useState<StructuredEntry | null>(null);
  const [evidenceRefs, setEvidenceRefs] = useState<string[]>([]);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!incident) {
      return;
    }
    setEvidenceRefs(incident.structuredEntry.evidenceRefs);
  }, [incident]);

  useEffect(() => {
    if (!incidentId) {
      return;
    }

    let objectUrl: string | null = null;
    void getAudioRecording(incidentId).then((record) => {
      if (record?.blob) {
        objectUrl = URL.createObjectURL(record.blob);
        setAudioPreviewUrl(objectUrl);
      }
    });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [incidentId]);

  if (loading) {
    return <LoadingState title="Entry Review" message="Loading structured entry…" />;
  }

  if (error || !incident || !incidentId) {
    return <ErrorState title="Entry Review" message={error ?? 'Incident not found.'} />;
  }

  const currentEntry = entry ?? incident.structuredEntry;

  const updateField = <K extends keyof StructuredEntry>(
    key: K,
    value: StructuredEntry[K],
  ) => {
    setEntry({ ...currentEntry, [key]: value });
  };

  const saveAndContinue = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveStructuredEntry(incidentId, {
        ...currentEntry,
        evidenceRefs,
      });
      navigate(ROUTES.legal(incidentId));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="screen-card stack">
      <div>
        <h2>Entry Review</h2>
        <p className="muted">
          Review the AI-structured entry. Edit anything that needs correction before legal
          mapping.
        </p>
      </div>

      <label className="field">
        <span>Date</span>
        <input
          className="text-input"
          value={currentEntry.date ?? ''}
          onChange={(event) => updateField('date', event.target.value || null)}
        />
      </label>

      <label className="field">
        <span>Time</span>
        <input
          className="text-input"
          value={currentEntry.time ?? ''}
          onChange={(event) => updateField('time', event.target.value || null)}
        />
      </label>

      <label className="field">
        <span>Location</span>
        <input
          className="text-input"
          value={currentEntry.location.description ?? ''}
          onChange={(event) =>
            updateField('location', {
              ...currentEntry.location,
              description: event.target.value || null,
            })
          }
        />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          className="text-input"
          rows={6}
          value={currentEntry.description ?? ''}
          onChange={(event) => updateField('description', event.target.value || null)}
        />
      </label>

      <label className="field">
        <span>Persons involved (comma-separated)</span>
        <input
          className="text-input"
          value={currentEntry.personsInvolved.join(', ')}
          onChange={(event) =>
            updateField(
              'personsInvolved',
              event.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
      </label>

      <label className="field">
        <span>Witnesses (comma-separated)</span>
        <input
          className="text-input"
          value={currentEntry.witnesses.join(', ')}
          onChange={(event) =>
            updateField(
              'witnesses',
              event.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
      </label>

      <EvidenceAttachments
        incidentId={incidentId}
        evidenceRefs={evidenceRefs}
        onChange={setEvidenceRefs}
      />

      {audioPreviewUrl && (
        <div className="audio-preview">
          <p className="eyebrow">Local audio recording</p>
          <audio controls src={audioPreviewUrl} />
          <button
            type="button"
            className="text-button"
            onClick={() => void downloadAudioRecording(incidentId)}
          >
            Download audio
          </button>
        </div>
      )}

      {(incident.integrity.transcriptHash || incident.integrity.audioHash) && (
        <div className="hash-box">
          {incident.integrity.transcriptHash && (
            <>
              <p className="eyebrow">Transcript integrity hash</p>
              <code>{incident.integrity.transcriptHash}</code>
            </>
          )}
          {incident.integrity.audioHash && (
            <>
              <p className="eyebrow">Audio integrity hash</p>
              <code>{incident.integrity.audioHash}</code>
              {incident.integrity.audioCapturedAt && (
                <p className="muted small">Captured {incident.integrity.audioCapturedAt}</p>
              )}
            </>
          )}
        </div>
      )}

      <PatternAnalysisCard
        analysis={incident.patternAnalysis}
        personsInvolved={currentEntry.personsInvolved}
      />

      {message && <p className="error-text">{message}</p>}

      <button
        type="button"
        className="primary-button"
        disabled={saving}
        onClick={() => void saveAndContinue()}
      >
        {saving ? 'Saving…' : 'Continue to legal mapping'}
      </button>
    </section>
  );
}
