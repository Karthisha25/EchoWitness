import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { ProcessingBanner } from '@/components/ui/Spinner';
import { useIncident } from '@/hooks/useIncident';
import { ROUTES } from '@/routes/paths';
import {
  generateInterviewQuestion,
  isInterviewComplete,
  structureFromInterviewLog,
} from '@/services/gemini';
import { appendInterviewAnswer, saveStructuredEntry } from '@/services/incidents';
import type { InterviewLogEntry } from '@/types';

const MAX_QUESTIONS = 8;

export function GuidedInterviewScreen() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const { incident, loading, error } = useIncident(incidentId);
  const [log, setLog] = useState<InterviewLogEntry[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (incident) {
      setLog(incident.rawInput.interviewLog);
    }
  }, [incident]);

  if (loading) {
    return <LoadingState title="Guided Interview" message="Loading incident…" />;
  }

  if (error || !incident) {
    return <ErrorState title="Guided Interview" message={error ?? 'Incident not found.'} />;
  }

  const progress = Math.min(log.length, MAX_QUESTIONS);

  const finishInterview = async (interviewLog: InterviewLogEntry[]) => {
    const structuredEntry = await structureFromInterviewLog(interviewLog);
    await saveStructuredEntry(incident.incidentId, structuredEntry);
    navigate(ROUTES.review(incident.incidentId));
  };

  const askNextQuestion = async (interviewLog: InterviewLogEntry[]) => {
    if (interviewLog.length >= MAX_QUESTIONS) {
      await finishInterview(interviewLog);
      return;
    }

    const question = await generateInterviewQuestion(
      incident.structuredEntry,
      interviewLog,
    );
    if (isInterviewComplete(question)) {
      await finishInterview(interviewLog);
      return;
    }
    setCurrentQuestion(question.trim());
    setStarted(true);
  };

  const begin = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      await askNextQuestion(log);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to get question.');
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion || !answer.trim()) {
      return;
    }
    setBusy(true);
    setStatusMessage(null);
    try {
      const updatedLog: InterviewLogEntry[] = [
        ...log,
        {
          question: currentQuestion,
          answer: answer.trim(),
          timestamp: new Date().toISOString(),
        },
      ];
      await appendInterviewAnswer(
        incident.incidentId,
        currentQuestion,
        answer.trim(),
        log,
      );
      setLog(updatedLog);
      setAnswer('');
      setCurrentQuestion(null);
      await askNextQuestion(updatedLog);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to save answer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen-card stack fade-in">
      <div>
        <h2>Guided Interview</h2>
        <p className="muted">
          One gentle question at a time. You can stop whenever you need to.
        </p>
      </div>

      <div className="progress-bar" aria-label={`Progress ${progress} of ${MAX_QUESTIONS}`}>
        <span style={{ width: `${(progress / MAX_QUESTIONS) * 100}%` }} />
      </div>

      <div className="chat-log">
        {log.map((entry) => (
          <div key={`${entry.timestamp}-${entry.question}`} className="chat-thread">
            <div className="chat-bubble assistant">{entry.question}</div>
            <div className="chat-bubble user">{entry.answer}</div>
          </div>
        ))}
        {currentQuestion && (
          <div className="chat-bubble assistant">{currentQuestion}</div>
        )}
      </div>

      {busy && (
        <ProcessingBanner
          title={currentQuestion ? 'Saving your answer…' : 'Preparing the next question…'}
        />
      )}

      {!started ? (
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void begin()}
        >
          {busy ? 'Starting…' : 'Begin interview'}
        </button>
      ) : (
        <div className="stack">
          <textarea
            className="text-input"
            rows={4}
            value={answer}
            placeholder="Type your answer here…"
            onChange={(event) => setAnswer(event.target.value)}
          />
          <button
            type="button"
            className="primary-button"
            disabled={busy || !answer.trim()}
            onClick={() => void submitAnswer()}
          >
            {busy ? 'Saving…' : 'Send answer'}
          </button>
        </div>
      )}

      {statusMessage && <p className="error-text">{statusMessage}</p>}
    </section>
  );
}
