export type IncidentSource = 'live_capture' | 'guided_interview' | 'manual';

export type IncidentStatus = 'draft' | 'structuring' | 'structured' | 'reported';

export type InterviewLogEntry = {
  question: string;
  answer: string;
  timestamp: string;
};

export type LocationInfo = {
  description: string | null;
  lat: number | null;
  lng: number | null;
};

export type StructuredEntry = {
  date: string | null;
  time: string | null;
  location: LocationInfo;
  description: string | null;
  personsInvolved: string[];
  witnesses: string[];
  evidenceRefs: string[];
};

export type LegalMapping = {
  poshSection: string;
  justification: string;
  confidenceNote: string;
};

export type PatternAnalysis = {
  linkedIncidentIds: string[];
  escalationSummary: string | null;
};

export type IntegrityRecord = {
  contentHash: string | null;
  transcriptHash: string | null;
  audioHash: string | null;
  audioCapturedAt: string | null;
  localAudioId: string | null;
  hashedAt: string | null;
};

export type RawInput = {
  transcript: string | null;
  transcriptHash: string | null;
  interviewLog: InterviewLogEntry[];
};

export type Incident = {
  incidentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  source: IncidentSource;
  status: IncidentStatus;
  rawInput: RawInput;
  structuredEntry: StructuredEntry;
  legalMapping: LegalMapping | null;
  patternAnalysis: PatternAnalysis | null;
  integrity: IntegrityRecord;
};

export type UserSettings = {
  disguiseMode: boolean;
  language: string;
};

export type UserProfile = {
  uid: string;
  createdAt: string;
  displayName: string | null;
  settings: UserSettings;
};

export const emptyStructuredEntry = (): StructuredEntry => ({
  date: null,
  time: null,
  location: { description: null, lat: null, lng: null },
  description: null,
  personsInvolved: [],
  witnesses: [],
  evidenceRefs: [],
});

export function normalizeIncident(raw: Partial<Incident> & { incidentId: string }): Incident {
  const base = emptyIncident(raw.incidentId, raw.userId ?? '', raw.source ?? 'manual');
  return {
    ...base,
    ...raw,
    rawInput: {
      ...base.rawInput,
      ...raw.rawInput,
      interviewLog: raw.rawInput?.interviewLog ?? [],
    },
    structuredEntry: {
      ...base.structuredEntry,
      ...raw.structuredEntry,
      location: {
        ...base.structuredEntry.location,
        ...raw.structuredEntry?.location,
      },
      personsInvolved: raw.structuredEntry?.personsInvolved ?? [],
      witnesses: raw.structuredEntry?.witnesses ?? [],
      evidenceRefs: raw.structuredEntry?.evidenceRefs ?? [],
    },
    integrity: {
      ...base.integrity,
      ...raw.integrity,
    },
  };
}

export const emptyIncident = (
  incidentId: string,
  userId: string,
  source: IncidentSource,
): Incident => ({
  incidentId,
  userId,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  source,
  status: 'draft',
  rawInput: {
    transcript: null,
    transcriptHash: null,
    interviewLog: [],
  },
  structuredEntry: emptyStructuredEntry(),
  legalMapping: null,
  patternAnalysis: null,
  integrity: {
    contentHash: null,
    transcriptHash: null,
    audioHash: null,
    audioCapturedAt: null,
    localAudioId: null,
    hashedAt: null,
  },
});
