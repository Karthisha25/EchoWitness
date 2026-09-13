import { jsPDF } from 'jspdf';
import type { Incident } from '@/types';
import { LEGAL_DISCLAIMER } from '@/constants/poshAct';

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let cursor = y;

  lines.forEach((line) => {
    if (cursor + lineHeight > pageHeight - 48) {
      doc.addPage();
      cursor = 48;
    }
    doc.text(line, x, cursor);
    cursor += lineHeight;
  });

  return cursor;
}

export function generateIncidentReport(incident: Incident): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const lineHeight = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('EchoWitness Incident Report', margin, y);
  y += 28;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const summary = [
    `Incident ID: ${incident.incidentId}`,
    `Date: ${incident.structuredEntry.date ?? 'Not specified'}`,
    `Time: ${incident.structuredEntry.time ?? 'Not specified'}`,
    `Location: ${incident.structuredEntry.location.description ?? 'Not specified'}`,
    `Source: ${incident.source.replaceAll('_', ' ')}`,
    `Status: ${incident.status}`,
  ].join('\n');
  y = addWrappedText(doc, summary, margin, y, width, lineHeight) + 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Structured Narrative', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  y =
    addWrappedText(
      doc,
      incident.structuredEntry.description ?? 'No description recorded.',
      margin,
      y,
      width,
      lineHeight,
    ) + 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Persons Involved', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  y = addWrappedText(
    doc,
    incident.structuredEntry.personsInvolved.join(', ') || 'None listed',
    margin,
    y,
    width,
    lineHeight,
  );
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Witnesses', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  y = addWrappedText(
    doc,
    incident.structuredEntry.witnesses.join(', ') || 'None listed',
    margin,
    y,
    width,
    lineHeight,
  );
  y += 12;

  if (incident.structuredEntry.evidenceRefs.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Attached Evidence', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    y =
      addWrappedText(
        doc,
        `${incident.structuredEntry.evidenceRefs.length} file(s) stored locally on the device that generated this report.`,
        margin,
        y,
        width,
        lineHeight,
      ) + 12;
  }

  if (incident.legalMapping) {
    doc.setFont('helvetica', 'bold');
    doc.text('POSH Act Mapping', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(
      doc,
      `Section: ${incident.legalMapping.poshSection}`,
      margin,
      y,
      width,
      lineHeight,
    );
    y = addWrappedText(
      doc,
      `Justification: ${incident.legalMapping.justification}`,
      margin,
      y,
      width,
      lineHeight,
    );
    y = addWrappedText(
      doc,
      `Note: ${incident.legalMapping.confidenceNote}`,
      margin,
      y,
      width,
      lineHeight,
    );
    y = addWrappedText(doc, LEGAL_DISCLAIMER, margin, y, width, lineHeight);
    y += 12;
  }

  if (incident.patternAnalysis?.escalationSummary) {
    doc.setFont('helvetica', 'bold');
    doc.text('Pattern Analysis', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(
      doc,
      incident.patternAnalysis.escalationSummary,
      margin,
      y,
      width,
      lineHeight,
    );
    y += 12;
  }

  if (incident.rawInput.transcript) {
    doc.setFont('helvetica', 'bold');
    doc.text('Original Transcript', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(doc, incident.rawInput.transcript, margin, y, width, lineHeight);
    y += 12;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Integrity Hashes', margin, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  const hashLines = [
    incident.integrity.audioHash
      ? `Audio SHA-256: ${incident.integrity.audioHash}`
      : null,
    incident.integrity.transcriptHash
      ? `Transcript SHA-256: ${incident.integrity.transcriptHash}`
      : null,
    incident.integrity.contentHash
      ? `Structured Entry SHA-256: ${incident.integrity.contentHash}`
      : null,
    incident.integrity.audioCapturedAt
      ? `Audio captured at: ${incident.integrity.audioCapturedAt}`
      : null,
    incident.integrity.hashedAt
      ? `Finalized at: ${incident.integrity.hashedAt}`
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
  addWrappedText(doc, hashLines || 'Not yet finalized', margin, y, width, lineHeight);

  return doc;
}

export function downloadIncidentReport(incident: Incident): void {
  const doc = generateIncidentReport(incident);
  doc.save(`echowitness-report-${incident.incidentId}.pdf`);
}

export function reportToObjectUrl(incident: Incident): string {
  const blob = generateIncidentReport(incident).output('blob');
  return URL.createObjectURL(blob);
}
