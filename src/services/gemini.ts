import type { InterviewLogEntry, LegalMapping, LocationInfo, StructuredEntry } from '@/types';
import { LEGAL_DISCLAIMER, POSH_ACT_REFERENCE } from '@/constants/poshAct';

/** Change this one value to switch Gemini models project-wide. */
export const GEMINI_MODEL = 'gemini-2.5-flash-lite';

/** Fallback models tried in order if the primary model is unavailable. */
export const GEMINI_MODEL_FALLBACKS: string[] = ['gemini-3.6-flash'];

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function geminiModelsToTry(): string[] {
  return [...new Set([GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS])];
}

function isModelUnavailable(status: number, errorText: string): boolean {
  if (status === 404) {
    return true;
  }
  const lower = errorText.toLowerCase();
  return (
    lower.includes('not found') ||
    lower.includes('no longer available') ||
    (status !== 401 &&
      status !== 403 &&
      (lower.includes('is not supported') || lower.includes('not available for')))
  );
}

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key || key.startsWith('your-')) {
    throw new Error(
      'Set VITE_GEMINI_API_KEY in your .env file with a valid Gemini API key.',
    );
  }
  return key;
}

async function callGeminiWithModel(
  model: string,
  prompt: string,
  jsonMode: boolean,
): Promise<string> {
  const url = `${API_BASE}/${model}:generateContent?key=${getApiKey()}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(jsonMode
        ? { generationConfig: { responseMimeType: 'application/json' } }
        : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Gemini API error (${response.status}): ${errorText}`);
    (error as Error & { status?: number; model?: string }).status = response.status;
    (error as Error & { status?: number; model?: string }).model = model;
    throw error;
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  const blocked = data.promptFeedback?.blockReason;
  if (blocked) {
    throw new Error(`Gemini blocked this request (${blocked}). Try rephrasing the input.`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(
      reason
        ? `Gemini returned no text (finishReason: ${reason}).`
        : 'Gemini returned an empty response.',
    );
  }
  return text;
}

async function callGemini(prompt: string, jsonMode = false): Promise<string> {
  const models = geminiModelsToTry();
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await callGeminiWithModel(model, prompt, jsonMode);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const status = (error as Error & { status?: number }).status ?? 0;
      const isLastModel = model === models[models.length - 1];

      if (!isLastModel && isModelUnavailable(status, error.message)) {
        console.warn(`[EchoWitness] Gemini model "${model}" unavailable, trying fallback…`);
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error('No Gemini models configured.');
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error('Gemini returned invalid JSON.');
  }
}

export function isInterviewComplete(response: string): boolean {
  const normalized = response.trim().replace(/["'.]/g, '').toUpperCase();
  return normalized === 'COMPLETE' || normalized.startsWith('COMPLETE\n');
}

type StructurePromptResult = {
  date: string | null;
  time: string | null;
  location: string | LocationInfo | null;
  description: string | null;
  personsInvolved: string[];
  witnesses: string[];
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
    .filter(Boolean);
}

function toStructuredEntry(result: StructurePromptResult): StructuredEntry {
  const locationValue = result.location;
  let location: LocationInfo = { description: null, lat: null, lng: null };
  if (typeof locationValue === 'string' && locationValue.trim()) {
    location = { description: locationValue.trim(), lat: null, lng: null };
  } else if (locationValue && typeof locationValue === 'object') {
    const desc =
      typeof locationValue.description === 'string' ? locationValue.description : null;
    location = {
      description: desc,
      lat: typeof locationValue.lat === 'number' ? locationValue.lat : null,
      lng: typeof locationValue.lng === 'number' ? locationValue.lng : null,
    };
  }

  return {
    date: result.date || null,
    time: result.time || null,
    location,
    description: result.description || null,
    personsInvolved: asStringList(result.personsInvolved),
    witnesses: asStringList(result.witnesses),
    evidenceRefs: [],
  };
}

export async function structureFromTranscript(
  transcript: string,
): Promise<StructuredEntry> {
  const prompt = `You are structuring a factual incident report from a survivor's account.
Do not add, infer, or embellish any fact not explicitly stated.
Preserve the survivor's own words where possible for direct quotes,
but organize into neutral, chronological, third-person-observable language.

Input: ${transcript}

Output strictly as JSON:
{
  "date": "",
  "time": "",
  "location": "",
  "description": "",
  "personsInvolved": [],
  "witnesses": []
}
If a field cannot be determined, use null. Do not guess.`;

  const text = await callGemini(prompt, true);
  return toStructuredEntry(parseJson<StructurePromptResult>(text));
}

export async function structureFromInterviewLog(
  interviewLog: InterviewLogEntry[],
): Promise<StructuredEntry> {
  const qaText = interviewLog
    .map(
      (entry) =>
        `Q: ${entry.question}\nA: ${entry.answer}`,
    )
    .join('\n\n');

  const prompt = `You are structuring a factual incident report from a survivor's account.
Do not add, infer, or embellish any fact not explicitly stated.
Preserve the survivor's own words where possible for direct quotes,
but organize into neutral, chronological, third-person-observable language.

Input: ${qaText}

Output strictly as JSON:
{
  "date": "",
  "time": "",
  "location": "",
  "description": "",
  "personsInvolved": [],
  "witnesses": []
}
If a field cannot be determined, use null. Do not guess.`;

  const text = await callGemini(prompt, true);
  return toStructuredEntry(parseJson<StructurePromptResult>(text));
}

export async function generateInterviewQuestion(
  structuredEntry: StructuredEntry,
  interviewLog: InterviewLogEntry[],
): Promise<string> {
  const prompt = `You are a trauma-informed interviewer helping a harassment survivor document
an incident. Ask exactly ONE short, gentle, non-leading follow-up question
to fill the most important missing detail (date, location, persons involved,
what happened, witnesses). Do not ask about feelings or make assumptions
about intent. If all key fields are filled, respond with "COMPLETE".

Current entry state: ${JSON.stringify(structuredEntry)}
Prior Q&A: ${JSON.stringify(interviewLog)}`;

  return callGemini(prompt, false);
}

export async function mapToPoshAct(
  structuredEntry: StructuredEntry,
): Promise<LegalMapping> {
  const prompt = `You are assisting in drafting a POSH Act complaint. Given the incident details
and the POSH Act reference text below, identify the most relevant section(s)
and explain briefly why, in plain language. This is drafting assistance only,
not legal advice — state this in your response.

Incident: ${JSON.stringify(structuredEntry)}
POSH Act reference sections: ${POSH_ACT_REFERENCE}

Output as JSON:
{
  "poshSection": "",
  "justification": "",
  "confidenceNote": ""
}

Do not infer or fabricate facts not present in the incident details.`;

  const text = await callGemini(prompt, true);
  const mapping = parseJson<LegalMapping>(text);
  return {
    ...mapping,
    confidenceNote: mapping.confidenceNote?.includes('legal advice')
      ? mapping.confidenceNote
      : `${mapping.confidenceNote ?? ''} ${LEGAL_DISCLAIMER}`.trim(),
  };
}

export async function checkPatterns(
  newEntry: StructuredEntry,
  priorEntries: Array<{ incidentId: string; structuredEntry: StructuredEntry }>,
): Promise<{ escalationSummary: string | null; linkedIncidentIds: string[] }> {
  if (priorEntries.length === 0) {
    return { escalationSummary: null, linkedIncidentIds: [] };
  }

  const prompt = `Compare this new incident to the prior incidents listed below, all involving
the same person(s). If there is a pattern or escalation (frequency increasing,
severity increasing, same type of behavior repeating), summarize it in 2
sentences. If no clear pattern, respond with "NO_PATTERN".

New incident: ${JSON.stringify(newEntry)}
Prior incidents: ${JSON.stringify(priorEntries.map((item) => item.structuredEntry))}`;

  const text = await callGemini(prompt, false);
  if (text.toUpperCase().includes('NO_PATTERN')) {
    return {
      escalationSummary: null,
      linkedIncidentIds: priorEntries.map((item) => item.incidentId),
    };
  }

  return {
    escalationSummary: text,
    linkedIncidentIds: priorEntries.map((item) => item.incidentId),
  };
}
