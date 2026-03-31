// components/AIFeedbackSuggester.tsx
'use client';

import { AIFeedbackSuggesterProps } from '@/lib/types/feedback';
import { useState, useRef, useCallback } from 'react';

type PanelState = 'idle' | 'loading' | 'reviewing' | 'error';

export default function AIFeedbackSuggester({
  questionText,
  questionType,
  options,
  correctAnswer,
  quizTitle,
  questionTopic,
  currentFeedback,
  onAccept,
}: AIFeedbackSuggesterProps) {
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [suggestion, setSuggestion] = useState('');
  const [editedSuggestion, setEditedSuggestion] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const canGenerate =
    questionText.trim().length > 0 &&
    (Array.isArray(correctAnswer)
      ? correctAnswer.length > 0
      : correctAnswer.trim().length > 0);

  const generate = useCallback(async () => {
    if (!canGenerate) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPanelState('loading');
    setSuggestion('');
    setEditedSuggestion('');
    setIsEditing(false);
    setErrorMsg('');

    try {
      const res = await fetch('/api/ai-question-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          questionText,
          questionType,
          options,
          correctAnswer,
          quizTitle,
          questionTopic,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      // Stream the response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      // Switch to reviewing mode as soon as streaming starts
      setPanelState('reviewing');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setSuggestion(accumulated);
      }

      setEditedSuggestion(accumulated);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setErrorMsg(err.message || 'Failed to generate feedback.');
      setPanelState('error');
    }
  }, [canGenerate, questionText, questionType, options, correctAnswer, quizTitle, questionTopic]);

  const handleAccept = () => {
    const final = isEditing ? editedSuggestion.trim() : suggestion.trim();
    if (!final) return;
    onAccept(final);
    setPanelState('idle');
    setSuggestion('');
    setIsEditing(false);
  };

  const handleDiscard = () => {
    abortRef.current?.abort();
    setPanelState('idle');
    setSuggestion('');
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditedSuggestion(suggestion);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedSuggestion(suggestion);
  };

  // ── Idle / trigger button ──────────────────────────────────────────────────
  if (panelState === 'idle') {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={!canGenerate}
        title={
          !canGenerate
            ? 'Add a question and correct answer first'
            : 'Generate AI feedback suggestion for this question'
        }
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
          transition-all duration-150
          ${
            canGenerate
              ? 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300 cursor-pointer'
              : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
          }
        `}
      >
        <SparkleIcon />
        {currentFeedback ? 'Re-generate AI feedback' : 'Generate AI feedback'}
      </button>
    );
  }

  // ── Loading / streaming / reviewing / error panel ──────────────────────────
  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-violet-100 border-b border-violet-200">
        <div className="flex items-center gap-2">
          <SparkleIcon className="text-violet-600" />
          <span className="text-sm font-semibold text-violet-800">AI Feedback Suggestion</span>
          {panelState === 'loading' && (
            <span className="text-xs text-violet-500 animate-pulse">Generating…</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="text-violet-400 hover:text-violet-600 transition-colors"
          title="Discard suggestion"
        >
          <XIcon />
        </button>
      </div>

      {/* Error state */}
      {panelState === 'error' && (
        <div className="px-4 py-4">
          <p className="text-sm text-red-600 mb-3">{errorMsg}</p>
          <button
            type="button"
            onClick={generate}
            className="text-sm px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Suggestion content */}
      {(panelState === 'loading' || panelState === 'reviewing') && (
        <div className="px-4 py-3">
          {isEditing ? (
            <textarea
              value={editedSuggestion}
              onChange={(e) => setEditedSuggestion(e.target.value)}
              rows={4}
              className="w-full text-sm text-gray-800 bg-white border border-violet-300 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Edit the suggestion…"
            />
          ) : (
            <p className={`text-sm text-gray-800 leading-relaxed min-h-[3rem] ${panelState === 'loading' ? 'animate-pulse' : ''}`}>
              {suggestion || <span className="text-violet-300">Generating feedback…</span>}
            </p>
          )}

          {/* Verification notice */}
          <p className="mt-2 text-xs text-violet-500 italic">
            ✦ Review this suggestion carefully before accepting — AI can make mistakes.
          </p>
        </div>
      )}

      {/* Action bar — only shown when fully streamed */}
      {panelState === 'reviewing' && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-violet-200 bg-white">
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <PencilIcon /> Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-sm px-3 py-1.5 text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel edit
              </button>
            )}
            <button
              type="button"
              onClick={generate}
              className="inline-flex items-center gap-1 text-sm px-3 py-1.5 text-violet-600 border border-violet-200 rounded-md hover:bg-violet-50 transition-colors"
            >
              <RefreshIcon /> Regenerate
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="text-sm px-3 py-1.5 text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isEditing && !editedSuggestion.trim()}
              className="inline-flex items-center gap-1 text-sm px-4 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <CheckIcon /> Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tiny inline SVG icons ─────────────────────────────────────────────────────

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2m-3.3-6.7-1.4 1.4M7.7 16.3l-1.4 1.4m0-11.4 1.4 1.4m8.6 8.6 1.4 1.4" />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
