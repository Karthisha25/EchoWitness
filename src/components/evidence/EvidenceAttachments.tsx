import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import {
  createEvidenceRefId,
  deleteEvidenceFile,
  downloadEvidenceFile,
  getEvidenceBlob,
  listEvidenceFiles,
  saveEvidenceFile,
  type EvidenceMeta,
} from '@/services/indexedDb';

type EvidenceAttachmentsProps = {
  incidentId: string;
  evidenceRefs: string[];
  onChange: (refs: string[]) => void;
};

export function EvidenceAttachments({
  incidentId,
  evidenceRefs,
  onChange,
}: EvidenceAttachmentsProps) {
  const [files, setFiles] = useState<EvidenceMeta[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const refreshFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextFiles = await listEvidenceFiles(incidentId);
      setFiles(nextFiles);
      onChange(nextFiles.map((file) => createEvidenceRefId(file.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshFiles();
  }, [incidentId]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    void (async () => {
      const nextThumbnails: Record<string, string> = {};
      for (const file of files) {
        if (!file.mimeType.startsWith('image/')) {
          continue;
        }
        const blob = await getEvidenceBlob(file.id);
        if (!blob || cancelled) {
          continue;
        }
        const url = URL.createObjectURL(blob);
        urls.push(url);
        nextThumbnails[file.id] = url;
      }
      if (!cancelled) {
        setThumbnails(nextThumbnails);
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected?.length) {
      return;
    }

    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(selected)) {
        await saveEvidenceFile(incidentId, file);
      }
      await refreshFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach evidence.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemove = async (file: EvidenceMeta) => {
    setError(null);
    try {
      await deleteEvidenceFile(file.id);
      await refreshFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove evidence.');
    }
  };

  return (
    <div className="evidence-section stack">
      <div>
        <p className="eyebrow">Attached evidence</p>
        <p className="muted small">
          Screenshots and PDFs stay on this device in IndexedDB — not uploaded to Firebase.
        </p>
      </div>

      <label className="file-upload-button">
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          disabled={uploading}
          onChange={(event) => void handleUpload(event)}
        />
        {uploading ? 'Uploading…' : 'Attach proof (images or PDF)'}
      </label>

      {loading && <p className="muted">Loading attachments…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && files.length === 0 && (
        <p className="muted">No files attached yet.</p>
      )}

      <ul className="evidence-list">
        {files.map((file) => (
          <li key={file.id} className="evidence-item">
            {thumbnails[file.id] ? (
              <img src={thumbnails[file.id]} alt={file.fileName} className="evidence-thumb" />
            ) : (
              <div className="evidence-thumb evidence-thumb--file">
                {file.mimeType.includes('pdf') ? 'PDF' : 'FILE'}
              </div>
            )}
            <div className="evidence-meta">
              <strong>{file.fileName}</strong>
              <p className="muted small">
                {(file.size / 1024).toFixed(1)} KB · stored locally
              </p>
              {evidenceRefs.includes(createEvidenceRefId(file.id)) && (
                <p className="muted small">Linked to this report</p>
              )}
            </div>
            <div className="evidence-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => void downloadEvidenceFile(file.id, file.fileName)}
              >
                Download
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => void handleRemove(file)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
