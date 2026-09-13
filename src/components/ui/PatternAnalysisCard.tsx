import type { PatternAnalysis } from '@/types';

type PatternAnalysisCardProps = {
  analysis: PatternAnalysis | null;
  personsInvolved?: string[];
  pending?: boolean;
};

export function PatternAnalysisCard({
  analysis,
  personsInvolved = [],
  pending = false,
}: PatternAnalysisCardProps) {
  if (pending) {
    return (
      <div className="pattern-box">
        <p className="eyebrow">Pattern analysis</p>
        <p className="muted">Checking for related entries…</p>
      </div>
    );
  }

  if (!analysis) {
    if (personsInvolved.length === 0) {
      return (
        <div className="pattern-box">
          <p className="eyebrow">Pattern analysis</p>
          <p className="muted">
            Add persons involved on this entry to compare against your history.
          </p>
        </div>
      );
    }

    return (
      <div className="pattern-box">
        <p className="eyebrow">Pattern analysis</p>
        <p className="muted">
          Run POSH mapping to compare this entry with your prior incidents.
        </p>
      </div>
    );
  }

  if (analysis.escalationSummary) {
    return (
      <div className="pattern-box pattern-box--alert">
        <p className="eyebrow">Pattern / escalation detected</p>
        <p>{analysis.escalationSummary}</p>
        {analysis.linkedIncidentIds.length > 0 && (
          <p className="muted small">
            Compared with {analysis.linkedIncidentIds.length} related{' '}
            {analysis.linkedIncidentIds.length === 1 ? 'entry' : 'entries'}.
          </p>
        )}
      </div>
    );
  }

  if (analysis.linkedIncidentIds.length > 0) {
    return (
      <div className="pattern-box">
        <p className="eyebrow">Pattern analysis</p>
        <p className="muted">
          {analysis.linkedIncidentIds.length} related{' '}
          {analysis.linkedIncidentIds.length === 1 ? 'entry' : 'entries'} reviewed — no
          clear escalation pattern identified.
        </p>
      </div>
    );
  }

  return (
    <div className="pattern-box">
      <p className="eyebrow">Pattern analysis</p>
      <p className="muted">No prior entries involve the same person(s).</p>
    </div>
  );
}
