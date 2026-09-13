import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionCtor = new () => EchoSpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const IGNORABLE_ERRORS = new Set(['no-speech', 'aborted', 'audio-capture']);

type UseSpeechRecognitionOptions = {
  language?: string;
};

export function useSpeechRecognition({
  language = 'en-US',
}: UseSpeechRecognitionOptions = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<EchoSpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const shouldListenRef = useRef(false);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      setError('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }

    shouldListenRef.current = true;
    setError(null);
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.onresult = (event: EchoSpeechRecognitionEvent) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += `${result[0].transcript} `;
        } else {
          interim += result[0].transcript;
        }
      }
      const combined = `${finalText}${interim}`.trim();
      transcriptRef.current = combined;
      setTranscript(combined);
    };
    recognition.onerror = (event: EchoSpeechRecognitionErrorEvent) => {
      if (IGNORABLE_ERRORS.has(event.error)) {
        return;
      }
      setError(event.error);
      shouldListenRef.current = false;
      setListening(false);
    };
    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          shouldListenRef.current = false;
        }
      }
      setListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [language]);

  const stop = useCallback((): string => {
    shouldListenRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
    recognitionRef.current = null;
    setListening(false);
    return transcriptRef.current.trim();
  }, []);

  const reset = useCallback(() => {
    stop();
    transcriptRef.current = '';
    setTranscript('');
    setError(null);
  }, [stop]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    supported,
    listening,
    transcript,
    error,
    start,
    stop,
    reset,
  };
}
