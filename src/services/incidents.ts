import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type {
  Incident,
  IncidentSource,
  InterviewLogEntry,
  LegalMapping,
  PatternAnalysis,
  StructuredEntry,
  UserProfile,
  UserSettings,
} from '@/types';
import { emptyIncident, normalizeIncident } from '@/types';
import { checkPatterns } from '@/services/gemini';
import { hashBlob, hashStructuredEntry, hashTranscript } from '@/services/crypto';
import { saveAudioRecording } from '@/services/indexedDb';

function incidentsCollection() {
  return collection(db, 'incidents');
}

function usersCollection() {
  return collection(db, 'users');
}

export async function ensureUserProfile(
  uid: string,
  displayName: string | null = null,
): Promise<UserProfile> {
  const ref = doc(usersCollection(), uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const profile: UserProfile = {
    uid,
    createdAt: new Date().toISOString(),
    displayName,
    settings: {
      disguiseMode: true,
      language: 'en-US',
    },
  };
  await setDoc(ref, profile);
  return profile;
}

export async function updateUserSettings(
  uid: string,
  settings: Partial<UserSettings>,
): Promise<void> {
  const ref = doc(usersCollection(), uid);
  const snap = await getDoc(ref);
  const current = snap.data() as UserProfile | undefined;
  await updateDoc(ref, {
    settings: {
      disguiseMode: current?.settings.disguiseMode ?? true,
      language: current?.settings.language ?? 'en-US',
      ...settings,
    },
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(usersCollection(), uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function createIncident(
  userId: string,
  source: IncidentSource,
): Promise<Incident> {
  const ref = doc(incidentsCollection());
  const incident = emptyIncident(ref.id, userId, source);
  await setDoc(ref, incident);
  return incident;
}

export async function getIncident(incidentId: string): Promise<Incident | null> {
  const snap = await getDoc(doc(incidentsCollection(), incidentId));
  return snap.exists()
    ? normalizeIncident(snap.data() as Partial<Incident> & { incidentId: string })
    : null;
}

export async function listIncidents(userId: string): Promise<Incident[]> {
  const q = query(
    incidentsCollection(),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) =>
    normalizeIncident(item.data() as Partial<Incident> & { incidentId: string }),
  );
}

export async function saveLiveCapture(
  incidentId: string,
  transcript: string,
  audioBlob: Blob,
  location: { lat: number | null; lng: number | null; description: string | null },
): Promise<void> {
  const capturedAt = new Date().toISOString();
  const [transcriptHash, audioHash, localAudioId] = await Promise.all([
    hashTranscript(transcript),
    hashBlob(audioBlob),
    saveAudioRecording(incidentId, audioBlob),
  ]);

  await updateDoc(doc(incidentsCollection(), incidentId), {
    'rawInput.transcript': transcript,
    'rawInput.transcriptHash': transcriptHash,
    'integrity.transcriptHash': transcriptHash,
    'integrity.audioHash': audioHash,
    'integrity.audioCapturedAt': capturedAt,
    'integrity.localAudioId': localAudioId,
    'structuredEntry.location.lat': location.lat,
    'structuredEntry.location.lng': location.lng,
    'structuredEntry.location.description': location.description,
    status: 'structuring',
    updatedAt: capturedAt,
  });
}

export async function saveStructuredEntry(
  incidentId: string,
  structuredEntry: StructuredEntry,
): Promise<void> {
  await updateDoc(doc(incidentsCollection(), incidentId), {
    structuredEntry,
    status: 'structured',
    updatedAt: new Date().toISOString(),
  });
}

export async function appendInterviewAnswer(
  incidentId: string,
  question: string,
  answer: string,
  interviewLog: InterviewLogEntry[],
): Promise<void> {
  const nextLog: InterviewLogEntry[] = [
    ...interviewLog,
    { question, answer, timestamp: new Date().toISOString() },
  ];
  await updateDoc(doc(incidentsCollection(), incidentId), {
    'rawInput.interviewLog': nextLog,
    updatedAt: new Date().toISOString(),
  });
}

export async function saveLegalMapping(
  incidentId: string,
  legalMapping: LegalMapping,
): Promise<void> {
  await updateDoc(doc(incidentsCollection(), incidentId), {
    legalMapping,
    updatedAt: new Date().toISOString(),
  });
}

export async function savePatternAnalysis(
  incidentId: string,
  patternAnalysis: PatternAnalysis,
): Promise<void> {
  await updateDoc(doc(incidentsCollection(), incidentId), {
    patternAnalysis,
    updatedAt: new Date().toISOString(),
  });
}

export async function finalizeIncident(
  incidentId: string,
  structuredEntry: StructuredEntry,
): Promise<string> {
  const contentHash = await hashStructuredEntry(
    structuredEntry as unknown as Record<string, unknown>,
  );
  const hashedAt = new Date().toISOString();
  await updateDoc(doc(incidentsCollection(), incidentId), {
    structuredEntry,
    'integrity.contentHash': contentHash,
    'integrity.hashedAt': hashedAt,
    status: 'reported',
    updatedAt: hashedAt,
  });
  return contentHash;
}

export function findOverlappingIncidents(
  incidents: Incident[],
  currentId: string,
  personsInvolved: string[],
): Incident[] {
  const normalized = personsInvolved
    .map((name) => name.toLowerCase().trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return [];
  }

  return incidents.filter((incident) => {
    if (incident.incidentId === currentId) {
      return false;
    }

    const priorPersons = incident.structuredEntry.personsInvolved
      .map((person) => person.toLowerCase().trim())
      .filter(Boolean);

    if (priorPersons.length === 0) {
      return false;
    }

    return priorPersons.some((priorPerson) =>
      normalized.some(
        (currentPerson) =>
          priorPerson === currentPerson ||
          priorPerson.includes(currentPerson) ||
          currentPerson.includes(priorPerson),
      ),
    );
  });
}

export async function analyzeIncidentPatterns(
  userId: string,
  incidentId: string,
  structuredEntry: StructuredEntry,
): Promise<PatternAnalysis> {
  const allIncidents = await listIncidents(userId);
  const overlapping = findOverlappingIncidents(
    allIncidents,
    incidentId,
    structuredEntry.personsInvolved,
  );

  let pattern: PatternAnalysis;

  if (overlapping.length === 0) {
    pattern = {
      linkedIncidentIds: [],
      escalationSummary: null,
    };
  } else {
    pattern = await checkPatterns(
      structuredEntry,
      overlapping.map((item) => ({
        incidentId: item.incidentId,
        structuredEntry: item.structuredEntry,
      })),
    );
  }

  await savePatternAnalysis(incidentId, pattern);
  return pattern;
}
