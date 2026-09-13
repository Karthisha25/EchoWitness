import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ProcessingBanner } from '@/components/ui/Spinner';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { useIncident } from '@/hooks/useIncident';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { ROUTES } from '@/routes/paths';
import { formatDuration } from '@/services/crypto';
import { structureFromTranscript } from '@/services/gemini';
import { downloadAudioRecording, getAudioRecording } from '@/services/indexedDb';
import { saveLiveCapture, saveStructuredEntry } from '@/services/incidents';

type CaptureLocationState = {
  autoStart?: boolean;
};

export function LiveCaptureScreen() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const autoStart = (location.state as CaptureLocationState | null)?.autoStart ?? false;
  const autoStartedRef = useRef(false);
  const { incident, loading, error } = useIncident(incidentId);
  const geo = useGeolocation();
  const media = useMediaRecorder();
  const speech = useSpeechRecognition({ language: 'en-US' });
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('Saving capture…');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) {
      return;
    }

    let objectUrl: string | null = null;
    void getAudioRecording(incidentId).then((record) => {
      if (record?.blob) {
        objectUrl = URL.createObjectURL(record.blob);
        setPreviewUrl(objectUrl);
      }
    });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [incidentId]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || loading || !incident || processing) {
      return;
    }
    if (!media.supported) {
      return;
    }
    autoStartedRef.current = true;
    void (async () => {
      const started = await media.start();
      if (started && speech.supported) {
        speech.start();
      }
    })();
  }, [autoStart, loading, incident, processing, media.supported, speech.supported]);

  if (loading) {
    return <LoadingState title="Live Capture" message="Loading incident…" />;
  }

  if (error || !incident) {
    return <ErrorState title="Live Capture" message={error ?? 'Incident not found.'} />;
  }

  const startRecording = async () => {
    setStatusMessage(null);
    const started = await media.start();
    if (started && speech.supported) {
      speech.start();
    }
  };

  const stopAndProcess = async () => {
    setProcessing(true);
    setProcessStep('Stopping recording…');
    setStatusMessage(null);

    try {
      const transcript = speech.stop();
      const audioBlob = await media.stop();

      if (!audioBlob) {
        throw new Error('No audio was captured. Check microphone permissions and try again.');
      }

      setProcessStep('Saving audio locally and hashing…');
      await saveLiveCapture(
        incident.incidentId,
        transcript || '[No speech detected — audio recorded locally]',
        audioBlob,
        {
          lat: geo.lat,
          lng: geo.lng,
          description: geo.description,
        },
      );

      const structuredEntry = transcript
        ? await (async () => {
            setProcessStep('Structuring the incident with Gemini…');
            return structureFromTranscript(transcript);
          })()
        : incident.structuredEntry;

      structuredEntry.location = {
        description: geo.description ?? structuredEntry.location.description,
        lat: geo.lat,
        lng: geo.lng,
      };

      await saveStructuredEntry(incident.incidentId, structuredEntry);
      navigate(ROUTES.review(incident.incidentId));
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to process recording.');
    } finally {
      setProcessing(false);
    }
  };

  const isActive = media.recording || speech.listening;

  return (
    <section className={`screen-card stack fade-in ${isActive ? 'is-recording' : ''}`}>
      <div>
        <h2>Live Capture</h2>
        <p className="muted">
          Audio stays on this device. Speech is transcribed live in the browser, then structured
          for your report.
        </p>
      </div>

      {!media.supported && (
        <p className="error-text">
          MediaRecorder is not available. Use a recent Chrome or Edge browser.
        </p>
      )}
      {media.supported && !speech.supported && (
        <p className="muted">
          Live transcription needs Chrome. You can still record audio and add details on the next
          screen.
        </p>
      )}

      <div className={`capture-panel capture-panel--recording ${isActive ? 'is-live' : ''}`}>
        <div className={`pulse-indicator ${isActive ? 'active' : ''}`} />
        <div>
          <p className="recording-timer">{formatDuration(media.durationSeconds)}</p>
          <p>{isActive ? 'Recording in progress…' : 'Ready to record'}</p>
        </div>
      </div>

      <div className="transcript-box">
        <p className="eyebrow">Live transcript</p>
        <p>{speech.transcript || 'Speak clearly while recording.'}</p>
      </div>

      <div className="meta-grid">
        <div>
          <p className="eyebrow">Location</p>
          <p>{geo.description ?? geo.error ?? 'Locating…'}</p>
        </div>
        <div>
          <p className="eyebrow">Audio storage</p>
          <p>IndexedDB on this device</p>
        </div>
      </div>

      {(media.error || speech.error) && (
        <p className="error-text">{media.error ?? speech.error}</p>
      )}
      {statusMessage && <p className="error-text">{statusMessage}</p>}
      {processing && (
        <ProcessingBanner
          title={processStep}
          detail="Keep this tab open until structuring finishes."
        />
      )}

      {previewUrl && !isActive && (
        <div className="audio-preview">
          <p className="eyebrow">Previous local recording</p>
          <audio controls src={previewUrl} />
          <button
            type="button"
            className="text-button"
            onClick={() => void downloadAudioRecording(incident.incidentId)}
          >
            Download audio
          </button>
        </div>
      )}

      <div className="action-grid">
        {!isActive ? (
          <button
            type="button"
            className="record-button"
            disabled={!media.supported || processing}
            onClick={() => void startRecording()}
          >
            Record incident
          </button>
        ) : (
          <button
            type="button"
            className="stop-button"
            disabled={processing}
            onClick={() => void stopAndProcess()}
          >
            {processing ? 'Processing…' : 'Stop & save'}
          </button>
        )}
      </div>
    </section>
  );
}
