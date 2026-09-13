interface EchoSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: EchoSpeechRecognitionEvent) => void) | null;
  onerror: ((event: EchoSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface EchoSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface EchoSpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface Window {
  SpeechRecognition?: new () => EchoSpeechRecognition;
  webkitSpeechRecognition?: new () => EchoSpeechRecognition;
}
