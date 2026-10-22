'use client';

export type WebSpeechSnapshot = {
  finalText: string;
  interimText: string;
};

type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionErrorEvent = {
  error: string;
};

export type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type WebSpeechConstructor = new () => WebSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: WebSpeechConstructor;
    webkitSpeechRecognition?: WebSpeechConstructor;
  }
}

export function webSpeechConstructor(): WebSpeechConstructor | null {
  if (typeof window === 'undefined') return null;
  // macOS TCC terminates the raw WKWebView process started by `tauri dev`
  // before Web Speech can report an error. Packaged Tauri apps carry the
  // required Info.plist permissions, and normal browsers are unaffected.
  if (process.env.NODE_ENV === 'development' && '__TAURI_INTERNALS__' in window) return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function webSpeechAvailable(): boolean {
  return webSpeechConstructor() !== null;
}

export function readWebSpeechResults(results: ArrayLike<RecognitionResult>): WebSpeechSnapshot {
  const final: string[] = [];
  const interim: string[] = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const transcript = result?.[0]?.transcript?.trim();
    if (!transcript) continue;
    (result.isFinal ? final : interim).push(transcript);
  }
  return { finalText: final.join(' ').trim(), interimText: interim.join(' ').trim() };
}

export function webSpeechErrorMessage(code: string): string {
  if (code === 'not-allowed') {
    return '마이크 권한이 꺼져 있습니다. macOS 시스템 설정 > 개인정보 보호 및 보안 > 마이크에서 Bulkup Raptor를 허용한 뒤 앱을 다시 실행해 주세요.';
  }
  if (code === 'service-not-allowed') {
    return '음성 인식 권한이 꺼져 있습니다. macOS 시스템 설정 > 개인정보 보호 및 보안 > 음성 인식에서 Bulkup Raptor를 허용한 뒤 앱을 다시 실행해 주세요.';
  }
  if (code === 'audio-capture') return '브라우저가 마이크 입력을 찾지 못했습니다.';
  if (code === 'network') return '브라우저 음성 인식 서버에 연결하지 못했습니다.';
  if (code === 'no-speech') return '말소리를 인식하지 못했습니다.';
  return '브라우저 음성 인식이 중단됐습니다.';
}
