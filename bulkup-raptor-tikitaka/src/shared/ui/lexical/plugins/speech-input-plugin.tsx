'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getRoot, $getSelection, $isRangeSelection, $setSelection, HISTORY_PUSH_TAG, type RangeSelection } from 'lexical';
import { Mic, Square } from 'lucide-react';
import { webSpeechConstructor, webSpeechErrorMessage, type WebSpeechRecognition } from '@/shared/lib/speech/web-speech';

type Phase = 'idle' | 'listening';

/** Web Speech inserts finalized phrases directly at the selection saved before toolbar focus. */
export function SpeechInputPlugin() {
  const [editor] = useLexicalComposerContext();
  const browserSupported = useSyncExternalStore(
    () => () => undefined,
    () => webSpeechConstructor() !== null,
    () => false,
  );
  const [phase, setPhase] = useState<Phase>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const selection = useRef<RangeSelection | null>(null);
  const recognition = useRef<WebSpeechRecognition | null>(null);
  const maximumTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);

  const clearTimer = () => {
    if (maximumTimer.current) clearTimeout(maximumTimer.current);
    maximumTimer.current = null;
  };

  const release = () => {
    clearTimer();
    recognition.current?.abort(); recognition.current = null;
  };

  useEffect(() => {
    return () => {
      run.current += 1;
      if (maximumTimer.current) clearTimeout(maximumTimer.current);
      recognition.current?.abort();
      recognition.current = null;
    };
  }, []);

  const rememberSelection = () => {
    editor.getEditorState().read(() => {
      const current = $getSelection();
      selection.current = $isRangeSelection(current) ? current.clone() : null;
    });
  };

  const insertTranscript = (transcript: string) => {
    const content = transcript.trim();
    if (!content) return;
    editor.update(() => {
      const saved = selection.current;
      if (saved && $getNodeByKey(saved.anchor.key)?.isAttached() && $getNodeByKey(saved.focus.key)?.isAttached()) $setSelection(saved.clone());
      else $getRoot().selectEnd();
      const current = $getSelection();
      if (!$isRangeSelection(current)) return;
      const nodeText = current.anchor.getNode().getTextContent();
      const prefix = current.anchor.offset > 0 && !/\s$/.test(nodeText.slice(0, current.anchor.offset)) ? ' ' : '';
      current.insertText(`${prefix}${content}`);
      selection.current = current.clone();
    }, { tag: HISTORY_PUSH_TAG });
  };

  const finish = () => {
    clearTimer(); recognition.current = null;
    setInterim(''); setPhase('idle');
  };

  const start = async () => {
    const currentRun = ++run.current;
    release(); rememberSelection(); setError(''); setInterim('');
    const Recognition = webSpeechConstructor();
    try {
      if (!Recognition) throw new Error('이 브라우저는 Web Speech 음성 인식을 지원하지 않습니다.');
      const instance = new Recognition();
      instance.lang = 'ko-KR'; instance.continuous = true; instance.interimResults = true; instance.maxAlternatives = 1;
      instance.onresult = event => {
        if (currentRun !== run.current) return;
        const pending: string[] = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript?.trim();
          if (!transcript) continue;
          if (result.isFinal) insertTranscript(transcript);
          else pending.push(transcript);
        }
        setInterim(pending.join(' '));
      };
      instance.onerror = event => {
        if (currentRun !== run.current && event.error !== 'aborted') return;
        if (event.error !== 'aborted') setError(webSpeechErrorMessage(event.error));
      };
      instance.onend = () => { if (currentRun === run.current) finish(); };
      instance.start(); recognition.current = instance; setPhase('listening');
      maximumTimer.current = setTimeout(() => instance.stop(), 60_000);
    } catch (cause) {
      if (currentRun === run.current) {
        release(); setPhase('idle');
        setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? '마이크 권한을 허용해 주세요.' : cause instanceof Error ? cause.message : '음성 입력을 시작하지 못했습니다.');
      }
    }
  };

  const stop = () => {
    clearTimer();
    recognition.current?.stop();
  };

  if (!browserSupported) return null;
  const active = phase !== 'idle';
  return <div className="relative ml-1 inline-flex shrink-0">
    <button type="button" title={active ? '음성 입력 종료' : '말해서 바로 입력'} aria-label={active ? '음성 입력 종료' : '말해서 바로 입력'} aria-pressed={active} onMouseDown={event => event.preventDefault()} onClick={active ? stop : () => void start()} className={active ? 'ui-icon-button-danger relative h-8 gap-1.5 px-3 text-xs font-black shadow-sm' : 'ui-icon-button size-8 text-text-muted hover:text-brand-primary'}>
      {phase === 'listening' ? <Square className="size-3.5" /> : <Mic className="size-4" />}
      {phase === 'listening' && <>듣는 중<span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-white" /></>}
    </button>
    {(interim || error) && <div role="status" aria-live="polite" className={`absolute right-0 top-[calc(100%+8px)] z-[180] w-72 rounded-lg border bg-surface-raised p-3 text-xs shadow-xl ${error ? 'border-destructive/30 text-destructive' : 'border-brand-border text-text-primary'}`}>
      {error || interim}
      {error && <button type="button" onClick={() => setError('')} className="ml-2 font-bold underline">닫기</button>}
    </div>}
  </div>;
}
