import { useCallback, useEffect, useRef, useState } from 'react';

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useMediaRecorder() {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSupported(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined',
    );
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setError('Audio recording is not supported in this browser.');
      return false;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      return true;
    }

    setError(null);
    setDurationSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setDurationSeconds((value) => value + 1);
      }, 1000);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission denied.');
      releaseStream();
      return false;
    }
  }, [supported, releaseStream]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      clearTimer();
      setRecording(false);
      releaseStream();
      return chunksRef.current.length
        ? new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' })
        : null;
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        releaseStream();
        recorderRef.current = null;
        clearTimer();
        setRecording(false);
        resolve(blob.size > 0 ? blob : null);
      };
      recorder.stop();
    });
  }, [clearTimer, releaseStream]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      releaseStream();
    };
  }, [clearTimer, releaseStream]);

  return {
    supported,
    recording,
    durationSeconds,
    error,
    start,
    stop,
  };
}
