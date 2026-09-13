# EchoWitness — Full Project Specification

## 1. Project Overview

**Name:** EchoWitness
**Domain:** AI / Social Impact
**One-line description:** An AI-powered platform that lets harassment survivors capture real-time evidence during an incident and turns it into a legally structured, POSH Act-compliant report through a trauma-informed AI interview.

**Core problem being solved:**
- Survivors rarely capture evidence in the moment (fear, panic, no discreet tool).
- When documentation happens later from memory, it's fragmented and legally weak.
- Existing apps (DocuSAFE, Confidy, VictimsVoice, Resolvr) only store evidence — none convert it into a legally usable, POSH Act-mapped report.

**Core solution:**
1. Live Capture — one-tap, discreetly disguised trigger that records audio + timestamp + GPS.
2. Guided Reconstruction — an AI-led, trauma-informed interview that fills gaps in memory.
3. Automated structuring — raw voice/text turned into a clean, factual, chronological incident record.
4. Legal mapping — AI matches the incident to the relevant POSH Act section.
5. Report generation — one-click PDF, formatted for HR / Internal Committee / police.
6. Tamper-evident storage — each capture is hashed on creation for integrity proof.

---

## 2. User Flow

```
[Login/Signup, anonymous-friendly] 
      → [Home: "New Incident" or "View Past Entries"]
      → New Incident:
            → Option A: Live Capture (one-tap disguised button → records audio+GPS+time)
            → Option B: Guided Reconstruction (chat-style AI interview)
      → [Both paths converge into the same structured Entry object]
      → [Entry Review screen: user can edit AI-structured text before saving]
      → [Generate Report → POSH mapping → PDF preview → Download/Save]
      → [Entry saved to History, cross-checked against past entries for patterns]
```

---

## 3. Data Model (Firestore)

### Collection: `users`
```json
{
  "uid": "string (Firebase Auth UID)",
  "createdAt": "timestamp",
  "displayName": "string (optional, can be anonymous)",
  "settings": {
    "disguiseMode": "boolean",
    "language": "string"
  }
}
```

### Collection: `incidents` (top-level, filtered by `userId`)
```json
{
  "incidentId": "auto-generated string",
  "userId": "string (foreign key to users.uid)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "source": "enum ['live_capture', 'guided_interview', 'manual']",
  "status": "enum ['draft', 'structuring', 'structured', 'reported']",

  "rawInput": {
    "audioFileUrl": "string (Firebase Storage path, nullable)",
    "audioHash": "string (SHA-256 hash of audio file, nullable)",
    "transcript": "string (nullable)",
    "interviewLog": [
      { "question": "string", "answer": "string", "timestamp": "timestamp" }
    ]
  },

  "structuredEntry": {
    "date": "string (ISO date)",
    "time": "string (nullable, ISO time)",
    "location": {
      "description": "string (nullable)",
      "lat": "number (nullable)",
      "lng": "number (nullable)"
    },
    "description": "string (neutral, factual, AI-structured narrative)",
    "personsInvolved": ["string"],
    "witnesses": ["string"],
    "evidenceRefs": ["string (Storage URLs)"]
  },

  "legalMapping": {
    "poshSection": "string (e.g. 'Section 2(n) - Sexual Harassment')",
    "justification": "string (AI-generated reasoning)",
    "confidenceNote": "string (AI's own caveat on completeness of evidence)"
  },

  "patternAnalysis": {
    "linkedIncidentIds": ["string"],
    "escalationSummary": "string (nullable, only if 2+ entries reference same person)"
  },

  "integrity": {
    "contentHash": "string (SHA-256 of structuredEntry at time of finalization)",
    "hashedAt": "timestamp"
  }
}
```

### Firebase Storage structure
```
/users/{uid}/incidents/{incidentId}/audio.webm
/users/{uid}/incidents/{incidentId}/evidence/{fileName}
/users/{uid}/incidents/{incidentId}/report.pdf
```

---

## 4. Backend Pipeline (Cloud Functions)

All Gemini calls happen server-side (Cloud Functions), never directly from the client, to protect API keys and keep prompts consistent.

### Function 1: `onAudioUploaded` (Storage trigger)
- Triggered when an audio file is uploaded to `/incidents/{incidentId}/audio.webm`
- Steps:
  1. Compute SHA-256 hash of the file → save to `rawInput.audioHash`
  2. Call Gemini API with the audio file → get transcript
  3. Save transcript to `rawInput.transcript`
  4. Set `status = 'structuring'`
  5. Trigger `structureEntry` function

### Function 2: `structureEntry` (Firestore trigger or callable)
- Input: `rawInput.transcript` OR `rawInput.interviewLog`
- Gemini prompt (system-style):
```
You are structuring a factual incident report from a survivor's account. 
Do not add, infer, or embellish any fact not explicitly stated. 
Preserve the survivor's own words where possible for direct quotes, 
but organize into neutral, chronological, third-person-observable language.

Input: {transcript or interview Q&A pairs}

Output strictly as JSON:
{
  "date": "",
  "time": "",
  "location": "",
  "description": "",
  "personsInvolved": [],
  "witnesses": []
}
If a field cannot be determined, use null. Do not guess.
```
  - Save result to `structuredEntry`
  - Set `status = 'structured'`

### Function 3: `generateInterviewQuestion` (callable, used in Guided Reconstruction loop)
- Input: current `structuredEntry` (partial) + prior Q&A log
- Gemini prompt:
```
You are a trauma-informed interviewer helping a harassment survivor document 
an incident. Ask exactly ONE short, gentle, non-leading follow-up question 
to fill the most important missing detail (date, location, persons involved, 
what happened, witnesses). Do not ask about feelings or make assumptions 
about intent. If all key fields are filled, respond with "COMPLETE".

Current entry state: {structuredEntry JSON}
Prior Q&A: {interviewLog}
```
  - Returns either a question string or "COMPLETE"
  - Client displays question, appends answer to `interviewLog`, re-calls this function until "COMPLETE"

### Function 4: `mapToPoshAct` (callable, triggered after structuring)
- Input: `structuredEntry`
- Context injected into prompt: full text of relevant POSH Act sections (paste as static reference text in the function, not fetched live)
- Gemini prompt:
```
You are assisting in drafting a POSH Act complaint. Given the incident details 
and the POSH Act reference text below, identify the most relevant section(s) 
and explain briefly why, in plain language. This is drafting assistance only, 
not legal advice — state this in your response.

Incident: {structuredEntry JSON}
POSH Act reference sections: {static reference text}

Output as JSON:
{
  "poshSection": "",
  "justification": "",
  "confidenceNote": ""
}
```
  - Save to `legalMapping`

### Function 5: `checkPatterns` (callable, triggered after a new incident is structured)
- Input: new `structuredEntry` + all prior entries for same `userId` where `personsInvolved` overlaps
- Gemini prompt:
```
Compare this new incident to the prior incidents listed below, all involving 
the same person(s). If there is a pattern or escalation (frequency increasing, 
severity increasing, same type of behavior repeating), summarize it in 2 
sentences. If no clear pattern, respond with "NO_PATTERN".

New incident: {structuredEntry JSON}
Prior incidents: {array of structuredEntry JSON}
```
  - Save result to `patternAnalysis.escalationSummary` (or null)
  - Save `patternAnalysis.linkedIncidentIds` = matched incident IDs

### Function 6: `finalizeAndHash` (callable, triggered on "Generate Report")
- Compute SHA-256 hash of the final `structuredEntry` JSON (stringified, sorted keys)
- Save to `integrity.contentHash` + `integrity.hashedAt`
- Set `status = 'reported'`

### Report generation (client-side, no Gemini call needed)
- Use `jsPDF` to render a formatted document pulling from:
  `structuredEntry`, `legalMapping`, `patternAnalysis`, `integrity.contentHash`
- Layout: header (incident summary) → structured narrative → POSH section + justification → witness/evidence list → integrity hash footer

---

## 5. API Endpoints (if using callable Cloud Functions, these are function names, not REST — but REST equivalents below for clarity)

| Endpoint | Method | Purpose |
|---|---|---|
| `/incidents` | POST | Create new incident (draft) |
| `/incidents/{id}/audio` | POST | Upload audio, triggers transcription pipeline |
| `/incidents/{id}/interview/next-question` | POST | Get next AI interview question |
| `/incidents/{id}/interview/answer` | POST | Submit answer, append to log |
| `/incidents/{id}/structure` | POST | Force re-run structuring (manual entries) |
| `/incidents/{id}/legal-mapping` | POST | Run POSH mapping |
| `/incidents/{id}/patterns` | GET | Get pattern/escalation analysis |
| `/incidents/{id}/finalize` | POST | Hash and lock entry, mark as reported |
| `/incidents/{id}/report` | GET | Generate/download PDF |
| `/incidents` | GET | List all incidents for logged-in user |

---

## 6. Security Rules (Firestore, summary)

- Users can only read/write their own `incidents` documents (`request.auth.uid == resource.data.userId`)
- Audio/evidence files in Storage scoped to `/users/{uid}/...` with matching auth check
- No incident data is ever readable by another user, including anonymized/aggregate views (out of scope for MVP)

---

## 7. Frontend Screens (React + TypeScript)

1. **Login/Signup** — Firebase Auth, anonymous sign-in supported
2. **Home** — "New Incident" (disguised icon) + "Past Entries" list
3. **Live Capture** — record button, shows recording indicator, stop → uploads
4. **Guided Interview** — chat UI, one question at a time, progress indicator
5. **Entry Review** — shows AI-structured entry, editable fields before finalizing
6. **Legal Mapping View** — shows POSH section + justification
7. **Report Preview** — PDF preview + download button
8. **History** — list of past incidents, pattern/escalation flags shown as badges

---

## 8. Tech Stack Summary

```
Frontend: React + TypeScript (Vite), PWA
Hosting: Netlify or Vercel
Backend: Firebase (Firestore, Auth, Storage, Cloud Functions)
AI: Gemini API (transcription, structuring, interview generation, legal mapping, pattern detection)
PDF: jsPDF (client-side)
Hashing: Web Crypto API (SHA-256, client or Cloud Function)
```

---

## 9. Key Constraints for the AI Coding Tool to Respect

- All Gemini calls must go through Cloud Functions, never expose API key client-side.
- Every Gemini prompt must instruct the model not to infer or fabricate facts not present in input.
- The `structuredEntry` JSON schema must stay consistent across all functions — it is the single source of truth passed between steps.
- POSH Act mapping output must always include a disclaimer that it is drafting assistance, not legal advice.
- Firestore security rules must strictly scope all reads/writes to the authenticated user's own data.
- Live Capture UI must support a "disguised" mode (icon swap) as a settings toggle, defaulting to on.
