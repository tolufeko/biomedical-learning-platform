// app/quiz/[id]/page.tsx
'use client';

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

// =============== TYPE DEFINITIONS ===============

interface HotspotAnswer { x: number; y: number; }

interface EquationEntry {
  id: string;
  expr: string;
  color: string;
}

interface FeatureAnswer {
  id: string;
  x: number | '';
  y: number | '';
}

interface GraphFeatureData {
  equations: EquationEntry[];
  xLabel?: string;
  yLabel?: string;
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  features: FeatureAnswer[];
}

interface GraphStudentAnswer {
  id: string;
  x: string;
  y: string;
}

function isHotspotAnswer(obj: any): obj is HotspotAnswer {
  return obj && typeof obj === 'object' && 'x' in obj && 'y' in obj;
}

function normaliseGraphFeatureData(raw: any): GraphFeatureData {
  if (!raw) return { equations: [{ id: 'eq0', expr: '', color: '#6366f1' }], xMin: -10, xMax: 10, yMin: -10, yMax: 10, features: [] };
  if (!raw.equations && raw.equation !== undefined) {
    const { graphType, imageUrl, equationColor, equation, ...rest } = raw;
    return { ...rest, equations: [{ id: 'eq0', expr: equation ?? '', color: equationColor ?? '#6366f1' }] } as GraphFeatureData;
  }
  if (!raw.equations) return { ...raw, equations: [{ id: 'eq0', expr: '', color: '#6366f1' }] } as GraphFeatureData;
  const { graphType, imageUrl, ...rest } = raw;
  return { ...rest } as GraphFeatureData;
}

type QuestionType = 'text' | 'multiple-choice' | 'checkbox' | 'hotspot' | 'graph_feature';

interface BaseQuizQuestion {
  id: string;
  question_type: QuestionType;
  question_text: string;
  image_path?: string;
  image_url?: string;
  question_assignment_id: string;
}

interface TextQuestion extends BaseQuizQuestion { question_type: 'text'; correct_answer: string; }
interface MultipleChoiceQuestion extends BaseQuizQuestion { question_type: 'multiple-choice'; options: string[]; correct_answer: string[]; }
interface CheckboxQuestion extends BaseQuizQuestion { question_type: 'checkbox'; options: string[]; correct_answer: string[]; }
interface HotspotQuestion extends BaseQuizQuestion { question_type: 'hotspot'; correct_answer: HotspotAnswer[]; }
interface GraphFeatureQuestion extends BaseQuizQuestion { question_type: 'graph_feature'; correct_answer: GraphFeatureData | string; }

type QuizQuestion = TextQuestion | MultipleChoiceQuestion | CheckboxQuestion | HotspotQuestion | GraphFeatureQuestion;

interface QuizData {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

interface TextAnswerState       { type: 'text';           userAnswer: string | null; }
interface ChoiceAnswerState     { type: 'multiple-choice' | 'checkbox'; userAnswer: string[] | null; }
interface HotspotAnswerState    { type: 'hotspot';        userAnswer: HotspotAnswer[] | null; }
interface GraphFeatureAnswerState { type: 'graph_feature'; userAnswer: GraphStudentAnswer[] | null; }
type AnswerState = TextAnswerState | ChoiceAnswerState | HotspotAnswerState | GraphFeatureAnswerState;

interface QuestionState {
  answerState: AnswerState;
  isSubmitted: boolean;
  isCorrect: boolean | null;
  showSolution: boolean;
  startTime: number;
  // ✅ NEW: record when each question was submitted so we can compute time spent
  endTime: number | null;
}

// =============== FEEDBACK HELPERS ===============

// Converts a question's correct_answer to a human-readable string for the AI prompt
function formatCorrectAnswerForFeedback(question: QuizQuestion): string {
  if (question.question_type === 'text') return question.correct_answer;
  if (question.question_type === 'multiple-choice' || question.question_type === 'checkbox')
    return question.correct_answer.join(', ');
  if (question.question_type === 'hotspot')
    return question.correct_answer.map(s => `(${Math.round(s.x)}%, ${Math.round(s.y)}%)`).join(' | ');
  if (question.question_type === 'graph_feature') {
    const ca = question.correct_answer;
    const gf = normaliseGraphFeatureData(typeof ca === 'string' ? (() => { try { return JSON.parse(ca); } catch { return null; } })() : ca);
    return gf ? gf.features.map(f => `(${f.x}, ${f.y})`).join(' | ') : '—';
  }
  return '—';
}

// Converts a QuestionState's answer to a human-readable string for the AI prompt
function formatAnswerForFeedback(question: QuizQuestion, state: QuestionState): string {
  const as = state.answerState;
  if (as.type === 'text') return as.userAnswer || 'No answer';
  if (as.type === 'multiple-choice' || as.type === 'checkbox')
    return as.userAnswer?.join(', ') || 'No answer';
  if (as.type === 'hotspot')
    return as.userAnswer?.map(s => `(${Math.round(s.x)}%, ${Math.round(s.y)}%)`).join(' | ') || 'No answer';
  if (as.type === 'graph_feature')
    return as.userAnswer?.map(a => `(${a.x || '?'}, ${a.y || '?'})`).join(' | ') || 'No answer';
  return 'No answer';
}

// ── Simple markdown renderer (bold, headings, line breaks — no library needed) ─
function renderMarkdown(text: string): React.ReactElement {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={key++} className="text-base font-bold text-gray-800 mt-5 mb-1 first:mt-0">
          {line.slice(3)}
        </h3>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1" />);
    } else {
      // Handle **bold** inline
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={key++} className="text-sm text-gray-700 leading-relaxed">
          {parts.map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    }
  }

  return <>{elements}</>;
}

// ── Standard feedback computation ─────────────────────────────────────────────
interface StandardFeedback {
  scoreMessage: string;
  scoreEmoji: string;
  slowQuestions: { text: string; seconds: number }[];
  byType: { type: string; correct: number; total: number }[];
  mostMissed: { text: string; attempts: number } | null;
}

function computeStandardFeedback(
  questions: QuizQuestion[],
  states: QuestionState[]
): StandardFeedback {
  const score = states.filter(s => s.isCorrect).length / questions.length * 100;

  const scoreMessage =
    score >= 90 ? 'Outstanding work!' :
    score >= 80 ? 'Great performance!' :
    score >= 70 ? 'Solid effort — a little more practice and you\'ll nail it.' :
    score >= 60 ? 'You\'re getting there — review the questions you missed.' :
    'Keep going — every attempt builds understanding.';

  const scoreEmoji =
    score >= 90 ? '🏆' : score >= 80 ? '🎉' : score >= 70 ? '👍' : score >= 60 ? '📚' : '💪';

  // Questions that took more than 45 seconds
  const slowQuestions = questions
    .map((q, i) => {
      const spent = states[i].endTime
        ? Math.round((states[i].endTime! - states[i].startTime) / 1000)
        : 0;
      return { text: q.question_text, seconds: spent };
    })
    .filter(q => q.seconds > 45)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 3);

  // Performance by question type
  const typeMap: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    if (!typeMap[q.question_type]) typeMap[q.question_type] = { correct: 0, total: 0 };
    typeMap[q.question_type].total++;
    if (states[i].isCorrect) typeMap[q.question_type].correct++;
  });
  const byType = Object.entries(typeMap).map(([type, counts]) => ({ type, ...counts }));

  // Most-missed question (wrong answer with most attempts — here just first wrong)
  const wrongOnes = questions.filter((_, i) => !states[i].isCorrect);
  const mostMissed = wrongOnes.length > 0
    ? { text: wrongOnes[0].question_text, attempts: 1 }
    : null;

  return { scoreMessage, scoreEmoji, slowQuestions, byType, mostMissed };
}

// =============== GRAPH HELPERS ===============

function parseEquationType(raw: string): { type: 'vertical'; xVal: number } | { type: 'horizontal'; yVal: number } | { type: 'function'; expr: string } {
  const s = raw.trim().replace(/\s/g, '');
  const vertMatch = s.match(/^x=(-?[\d.]+)$/);
  if (vertMatch) return { type: 'vertical', xVal: parseFloat(vertMatch[1]) };
  const horizConst = s.match(/^y=(-?[\d.]+)$/);
  if (horizConst) return { type: 'horizontal', yVal: parseFloat(horizConst[1]) };
  const expr = s.startsWith('y=') ? s.slice(2) : s;
  return { type: 'function', expr };
}

function evaluateExpr(expr: string, x: number): number | null {
  try {
    let e = expr
      .replace(/\^/g, '**')
      .replace(/(\d)(x)/g, '$1*x')
      .replace(/x(\d)/g, 'x**$1')
      .replace(/x/g, `(${x})`);
    // eslint-disable-next-line no-new-func
    const y = new Function(`return (${e})`)();
    return typeof y === 'number' && isFinite(y) ? y : null;
  } catch { return null; }
}

function drawEquation(
  ctx: CanvasRenderingContext2D,
  eq: { expr: string; color: string },
  toX: (x: number) => number,
  toY: (y: number) => number,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
  W: number, pad: number
) {
  if (!eq.expr) return;
  ctx.strokeStyle = eq.color || '#6366f1';
  ctx.lineWidth = 2.5;
  const parsed = parseEquationType(eq.expr);
  if (parsed.type === 'vertical') {
    const cx = toX(parsed.xVal);
    ctx.beginPath(); ctx.moveTo(cx, toY(yMax)); ctx.lineTo(cx, toY(yMin)); ctx.stroke();
    return;
  }
  if (parsed.type === 'horizontal') {
    ctx.beginPath(); ctx.moveTo(toX(xMin), toY(parsed.yVal)); ctx.lineTo(toX(xMax), toY(parsed.yVal)); ctx.stroke();
    return;
  }
  const steps = (W - 2 * pad) * 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + (i / steps) * (xMax - xMin);
    const y = evaluateExpr(parsed.expr, x);
    if (y === null || y < yMin - 0.5 || y > yMax + 0.5) { started = false; continue; }
    if (!started) { ctx.moveTo(toX(x), toY(y)); started = true; } else ctx.lineTo(toX(x), toY(y));
  }
  ctx.stroke();
}

function GraphCanvas({
  data,
  studentAnswers,
  submitted,
  showSolution,
}: {
  data: GraphFeatureData;
  studentAnswers: GraphStudentAnswer[];
  submitted: boolean;
  showSolution: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width, H = canvas.height, pad = 42;
    const toX = (x: number) => pad + ((x - data.xMin) / (data.xMax - data.xMin)) * (W - 2 * pad);
    const toY = (y: number) => H - pad - ((y - data.yMin) / (data.yMax - data.yMin)) * (H - 2 * pad);

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    for (let x = Math.ceil(data.xMin); x <= data.xMax; x++) {
      ctx.beginPath(); ctx.moveTo(toX(x), pad); ctx.lineTo(toX(x), H - pad); ctx.stroke();
    }
    for (let y = Math.ceil(data.yMin); y <= data.yMax; y++) {
      ctx.beginPath(); ctx.moveTo(pad, toY(y)); ctx.lineTo(W - pad, toY(y)); ctx.stroke();
    }

    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2;
    const zy = (data.yMin <= 0 && data.yMax >= 0) ? toY(0) : H - pad;
    const zx = (data.xMin <= 0 && data.xMax >= 0) ? toX(0) : pad;

    ctx.beginPath(); ctx.moveTo(pad, zy); ctx.lineTo(W - pad, zy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(zx, H - pad); ctx.lineTo(zx, pad); ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.moveTo(W - pad, zy); ctx.lineTo(W - pad - 8, zy - 4); ctx.lineTo(W - pad - 8, zy + 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(zx, pad); ctx.lineTo(zx - 4, pad + 8); ctx.lineTo(zx + 4, pad + 8); ctx.fill();

    ctx.fillStyle = '#6b7280'; ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (let x = Math.ceil(data.xMin); x <= data.xMax; x++) {
      if (x === 0) continue;
      ctx.fillText(String(x), toX(x), zy + 16);
    }
    ctx.textAlign = 'right';
    for (let y = Math.ceil(data.yMin); y <= data.yMax; y++) {
      if (y === 0) continue;
      ctx.fillText(String(y), zx - 6, toY(y) + 4);
    }

    ctx.fillStyle = '#374151'; ctx.font = 'italic 13px serif';
    ctx.textAlign = 'center';
    ctx.fillText('x', W - pad + 16, zy + 4);
    ctx.fillText('y', zx + 4, pad - 12);

    (data.equations ?? []).forEach(eq => {
      if (!eq.expr) return;
      drawEquation(ctx, { expr: eq.expr, color: eq.color }, toX, toY, data.xMin, data.xMax, data.yMin, data.yMax, W, pad);
    });

    if (data.xLabel) {
      ctx.fillStyle = '#374151'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(data.xLabel, W / 2, H - 4);
    }
    if (data.yLabel) {
      ctx.save();
      ctx.fillStyle = '#374151'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.translate(12, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(data.yLabel, 0, 0);
      ctx.restore();
    }

    const usedForDots = new Set<number>();
    studentAnswers.forEach(sa => {
      const sx = parseFloat(sa.x), sy = parseFloat(sa.y);
      if (isNaN(sx) || isNaN(sy)) return;
      let colour = '#3b82f6';
      if (submitted) {
        const matchIdx = data.features.findIndex((f, i) =>
          !usedForDots.has(i) && sx === Number(f.x) && sy === Number(f.y)
        );
        if (matchIdx !== -1) { usedForDots.add(matchIdx); colour = '#22c55e'; }
        else colour = '#ef4444';
      }
      ctx.beginPath(); ctx.arc(toX(sx), toY(sy), 6, 0, Math.PI * 2);
      ctx.fillStyle = colour; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });

    if (showSolution) {
      data.features.forEach((f, i) => {
        if (f.x === '' || f.y === '') return;
        if (usedForDots.has(i)) return;
        ctx.beginPath(); ctx.arc(toX(Number(f.x)), toY(Number(f.y)), 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 2]); ctx.stroke(); ctx.setLineDash([]);
      });
    }
  }, [data, studentAnswers, submitted, showSolution]);

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={380}
      className="rounded-xl border border-gray-200 w-full shadow-sm"
    />
  );
}

function GraphFeatureQuestionView({
  question,
  questionState,
  onAnswerChange,
}: {
  question: GraphFeatureQuestion;
  questionState: QuestionState | undefined;
  onAnswerChange: (answers: GraphStudentAnswer[]) => void;
}) {
  const graphData: GraphFeatureData | null = (() => {
    const ca = question.correct_answer;
    return normaliseGraphFeatureData(typeof ca === 'string' ? (() => { try { return JSON.parse(ca); } catch { return null; } })() : ca);
  })();

  const submitted = questionState?.isSubmitted ?? false;
  const showSol = questionState?.showSolution ?? false;

  const studentAnswers: GraphStudentAnswer[] = (() => {
    if (questionState?.answerState.type === 'graph_feature') {
      return questionState.answerState.userAnswer ?? (graphData?.features.map(f => ({ id: f.id, x: '', y: '' })) ?? []);
    }
    return graphData?.features.map(f => ({ id: f.id, x: '', y: '' })) ?? [];
  })();

  if (!graphData) {
    return <div className="bg-red-100 text-red-800 p-4 rounded-lg">⚠️ Graph configuration missing.</div>;
  }

  const updateAnswer = (id: string, field: 'x' | 'y', val: string) => {
    const updated = studentAnswers.map(a => a.id === id ? { ...a, [field]: val } : a);
    onAnswerChange(updated);
  };

  const matchedCorrectIndices = (() => {
    const used = new Set<number>();
    const result: (number | null)[] = [];
    for (const sa of studentAnswers) {
      const sx = parseFloat(sa.x), sy = parseFloat(sa.y);
      if (isNaN(sx) || isNaN(sy)) { result.push(null); continue; }
      const idx = graphData.features.findIndex((f, i) =>
        !used.has(i) && sx === Number(f.x) && sy === Number(f.y)
      );
      if (idx !== -1) { used.add(idx); result.push(idx); }
      else result.push(null);
    }
    return result;
  })();

  const getResult = (saIndex: number): boolean | null => {
    if (!submitted) return null;
    return matchedCorrectIndices[saIndex] !== null;
  };

  const unmatchedCorrect = graphData.features.filter((_, i) =>
    !matchedCorrectIndices.includes(i)
  );

  return (
    <div className="space-y-5">
      <GraphCanvas
        data={graphData}
        studentAnswers={studentAnswers}
        submitted={submitted}
        showSolution={showSol}
      />
      <p className="text-xs text-gray-400 italic">
        Enter the coordinates for each feature below.
        {!submitted && ' Your answers will appear as blue dots on the graph.'}
      </p>
      <div className="space-y-3">
        {studentAnswers.map((sa, idx) => {
          const result = getResult(idx);
          return (
            <div
              key={sa.id}
              className={`rounded-xl border p-4 transition-all ${
                result === true  ? 'border-green-300 bg-green-50' :
                result === false ? 'border-red-300 bg-red-50' :
                'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Answer {idx + 1}</span>
                {result !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    result ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                  }`}>
                    {result ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                )}
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">x =</label>
                  <input
                    type="number"
                    disabled={submitted}
                    value={sa.x}
                    onChange={e => updateAnswer(sa.id, 'x', e.target.value)}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">y =</label>
                  <input
                    type="number"
                    disabled={submitted}
                    value={sa.y}
                    onChange={e => updateAnswer(sa.id, 'y', e.target.value)}
                    placeholder="e.g. 0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
          );
        })}
        {showSol && unmatchedCorrect.length > 0 && (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4">
            <p className="text-xs font-semibold text-green-800 mb-2">Missing answers:</p>
            {unmatchedCorrect.map((f, i) => (
              <p key={i} className="text-xs text-green-700">x = {f.x}, y = {f.y}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============== MAIN COMPONENT ===============

export default function QuizPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { id } = useParams();
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── AI feedback state ────────────────────────────────────────────────────────
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
  const [aiFeedbackRequested, setAiFeedbackRequested] = useState(false);
  const [aiFeedbackError, setAiFeedbackError] = useState<string | null>(null);

  const { user, role, username, loading: authLoading } = useAuth();

  const questions = quizData?.questions || [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionState = questionStates[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const hasUserAnswer = (state: QuestionState | undefined): boolean => {
    if (!state?.answerState) return false;
    const { answerState } = state;
    if (answerState.type === 'text') return !!answerState.userAnswer?.trim();
    if (answerState.type === 'multiple-choice' || answerState.type === 'checkbox')
      return Array.isArray(answerState.userAnswer) && answerState.userAnswer.length > 0;
    if (answerState.type === 'hotspot')
      return Array.isArray(answerState.userAnswer) && answerState.userAnswer.length > 0;
    if (answerState.type === 'graph_feature')
      return Array.isArray(answerState.userAnswer) &&
        answerState.userAnswer.length > 0 &&
        answerState.userAnswer.every(a => a.x.trim() !== '' && a.y.trim() !== '');
    return false;
  };

  const calculateScore = () => {
    const correct = questionStates.filter(s => s.isCorrect).length;
    return { correct, total: totalQuestions, percentage: totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0 };
  };

  const saveAnalytics = async (questionAssignmentId: string, isCorrect: boolean, timeSpent: number) => {
    if (!user || role === 'guest') return;
    if (!questionAssignmentId) { console.warn('Missing question_assignment_id'); return; }
    try {
      await fetch('/api/quiz-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_assignment_id: questionAssignmentId, correct: isCorrect, time_spent: Math.round(timeSpent / 1000) }),
      });
    } catch (err) { console.error('Error saving analytics:', err); }
  };

  // ── AI feedback fetch ────────────────────────────────────────────────────────
  const fetchAiFeedback = async () => {
    setAiFeedbackLoading(true);
    setAiFeedbackRequested(true);
    setAiFeedbackError(null);
    setAiFeedback('');

    try {
      const score = calculateScore();
      const payload = {
        quizTitle: quizData!.title,
        score: score.percentage,
        questions: questions.map((q, i) => ({
          questionText: q.question_text,
          questionType: q.question_type,
          correct: questionStates[i]?.isCorrect ?? false,
          userAnswer: formatAnswerForFeedback(q, questionStates[i]),
          correctAnswer: formatCorrectAnswerForFeedback(q),
          timeSpent: questionStates[i]?.endTime
            ? Math.round((questionStates[i].endTime! - questionStates[i].startTime) / 1000)
            : 0,
        })),
      };

      const response = await fetch('/api/quiz-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        setAiFeedbackError(err.error || 'Failed to generate feedback.');
        setAiFeedbackLoading(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiFeedback(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setAiFeedbackError('Something went wrong. Please try again.');
    } finally {
      setAiFeedbackLoading(false);
    }
  };

  // Access check
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push("/");
  }, [user, role, authLoading, router]);

  // Init question states
  useEffect(() => {
    if (questions.length === 0) return;
    const initialStates: QuestionState[] = questions.map(q => {
      let answerState: AnswerState;
      switch (q.question_type) {
        case 'text':
          answerState = { type: 'text', userAnswer: null };
          break;
        case 'multiple-choice':
          answerState = { type: 'multiple-choice', userAnswer: null };
          break;
        case 'checkbox':
          // ✅ Fixed: was incorrectly typed as 'multiple-choice'
          answerState = { type: 'checkbox', userAnswer: null };
          break;
        case 'hotspot':
          answerState = { type: 'hotspot', userAnswer: null };
          break;
        case 'graph_feature': {
          const ca = (q as GraphFeatureQuestion).correct_answer;
          const gf = normaliseGraphFeatureData(typeof ca === 'string' ? (() => { try { return JSON.parse(ca); } catch { return null; } })() : ca);
          answerState = {
            type: 'graph_feature',
            userAnswer: gf ? gf.features.map(f => ({ id: f.id, x: '', y: '' })) : [],
          };
          break;
        }
        default:
          answerState = { type: 'text', userAnswer: null };
      }
      return { answerState, isSubmitted: false, isCorrect: null, showSolution: false, startTime: Date.now(), endTime: null };
    });
    setQuestionStates(initialStates);
  }, [questions.length]);

  // Fetch quiz
  useEffect(() => {
    if (!id) return;
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/quizzes/${id}`);
        if (!response.ok) throw new Error('Failed to fetch quiz');
        const data = await response.json();
        setQuizData(data);
      } catch (err) {
        setError('Failed to load quiz. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  // =============== HANDLERS ===============

  const handleTextAnswerChange = (text: string) => {
    if (currentQuestionState?.isSubmitted) return;
    const newStates = [...questionStates];
    const as = newStates[currentQuestionIndex].answerState;
    if (as.type === 'text') {
      newStates[currentQuestionIndex] = { ...newStates[currentQuestionIndex], answerState: { ...as, userAnswer: text } };
      setQuestionStates(newStates);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (currentQuestionState?.isSubmitted) return;
    const newStates = [...questionStates];
    const as = newStates[currentQuestionIndex].answerState;
    if (as.type === 'multiple-choice' || as.type === 'checkbox') {
      const cur = as.userAnswer || [];
      const next = cur.includes(answer) ? cur.filter(a => a !== answer) : [...cur, answer];
      newStates[currentQuestionIndex] = { ...newStates[currentQuestionIndex], answerState: { ...as, userAnswer: next } };
      setQuestionStates(newStates);
    }
  };

  const handleCheckboxAnswerSelect = (option: string, checked: boolean) => {
    if (currentQuestionState?.isSubmitted) return;
    const newStates = [...questionStates];
    const as = newStates[currentQuestionIndex].answerState;
    if (as.type === 'checkbox' || as.type === 'multiple-choice') {
      const cur = as.userAnswer || [];
      const next = checked ? [...cur, option] : cur.filter(a => a !== option);
      newStates[currentQuestionIndex] = { ...newStates[currentQuestionIndex], answerState: { ...as, userAnswer: next } };
      setQuestionStates(newStates);
    }
  };

  const handleHotspotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentQuestionState?.isSubmitted) return;
    if (!currentQuestion?.image_url || currentQuestion.question_type !== 'hotspot') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const as = currentQuestionState?.answerState;
    if (as?.type !== 'hotspot') return;
    const cur = as.userAnswer || [];
    const existingIdx = cur.findIndex(s => Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2) < 3);
    const next = existingIdx !== -1 ? cur.filter((_, i) => i !== existingIdx) : [...cur, { x, y }];
    const newStates = [...questionStates];
    newStates[currentQuestionIndex] = { ...newStates[currentQuestionIndex], answerState: { ...as, userAnswer: next } };
    setQuestionStates(newStates);
  };

  const handleGraphFeatureAnswerChange = (answers: GraphStudentAnswer[]) => {
    if (currentQuestionState?.isSubmitted) return;
    const newStates = [...questionStates];
    const as = newStates[currentQuestionIndex].answerState;
    if (as.type === 'graph_feature') {
      newStates[currentQuestionIndex] = { ...newStates[currentQuestionIndex], answerState: { ...as, userAnswer: answers } };
      setQuestionStates(newStates);
    }
  };

  const gradeQuestion = (question: QuizQuestion, state: QuestionState): boolean => {
    if (question.question_type === 'graph_feature' && state.answerState.type === 'graph_feature') {
      const ca = question.correct_answer;
      const gf = normaliseGraphFeatureData(typeof ca === 'string' ? (() => { try { return JSON.parse(ca); } catch { return null; } })() : ca);
      if (!gf) return false;
      const answers = state.answerState.userAnswer || [];
      if (answers.length !== gf.features.length) return false;
      const usedCorrect = new Set<number>();
      for (const sa of answers) {
        const sx = parseFloat(sa.x), sy = parseFloat(sa.y);
        if (isNaN(sx) || isNaN(sy)) return false;
        const matchIdx = gf.features.findIndex((f, i) =>
          !usedCorrect.has(i) && sx === Number(f.x) && sy === Number(f.y)
        );
        if (matchIdx === -1) return false;
        usedCorrect.add(matchIdx);
      }
      return true;
    }
    if (question.question_type === 'hotspot' && state.answerState.type === 'hotspot') {
      const userSpots = state.answerState.userAnswer || [];
      const correctSpots = question.correct_answer || [];
      const toleranceRadius = 8;
      const matches: { userIdx: number; correctIdx: number; distance: number }[] = [];
      for (let i = 0; i < userSpots.length; i++) {
        for (let j = 0; j < correctSpots.length; j++) {
          const d = Math.sqrt((userSpots[i].x - correctSpots[j].x) ** 2 + (userSpots[i].y - correctSpots[j].y) ** 2);
          if (d <= toleranceRadius) matches.push({ userIdx: i, correctIdx: j, distance: d });
        }
      }
      matches.sort((a, b) => a.distance - b.distance);
      const usedUser = new Set<number>(), usedCorrect = new Set<number>();
      let matchCount = 0;
      for (const m of matches) {
        if (!usedUser.has(m.userIdx) && !usedCorrect.has(m.correctIdx)) {
          usedUser.add(m.userIdx); usedCorrect.add(m.correctIdx); matchCount++;
        }
      }
      return matchCount === correctSpots.length && matchCount === userSpots.length;
    }
    if ((question.question_type === 'multiple-choice' || question.question_type === 'checkbox') &&
        (state.answerState.type === 'multiple-choice' || state.answerState.type === 'checkbox')) {
      const ua = [...(state.answerState.userAnswer || [])].sort();
      const ca = [...(question.correct_answer || [])].sort();
      return ua.length === ca.length && ua.every((a, i) => a === ca[i]);
    }
    if (question.question_type === 'text' && state.answerState.type === 'text') {
      return (state.answerState.userAnswer || '').toLowerCase().trim() === (question.correct_answer || '').toLowerCase().trim();
    }
    return false;
  };

  const submitAnswer = async () => {
    if (!currentQuestion || !currentQuestionState || !hasUserAnswer(currentQuestionState)) return;
    const isCorrect = gradeQuestion(currentQuestion, currentQuestionState);
    const now = Date.now();
    const timeSpent = now - currentQuestionState.startTime;
    await saveAnalytics(currentQuestion.question_assignment_id, isCorrect, timeSpent);
    const newStates = [...questionStates];
    // ✅ Record endTime on submit
    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      isSubmitted: true,
      isCorrect,
      showSolution: false,
      endTime: now,
    };
    setQuestionStates(newStates);
  };

  const retryQuestion = () => {
    const newStates = [...questionStates];
    const q = questions[currentQuestionIndex];
    let freshAnswer: AnswerState;

    // ✅ Fixed: all question types get a fresh answer on retry, not just graph_feature
    switch (q.question_type) {
      case 'text':
        freshAnswer = { type: 'text', userAnswer: null };
        break;
      case 'multiple-choice':
        freshAnswer = { type: 'multiple-choice', userAnswer: null };
        break;
      case 'checkbox':
        freshAnswer = { type: 'checkbox', userAnswer: null };
        break;
      case 'hotspot':
        freshAnswer = { type: 'hotspot', userAnswer: null };
        break;
      case 'graph_feature': {
        const ca = (q as GraphFeatureQuestion).correct_answer;
        const gf = normaliseGraphFeatureData(typeof ca === 'string' ? (() => { try { return JSON.parse(ca); } catch { return null; } })() : ca);
        freshAnswer = { type: 'graph_feature', userAnswer: gf ? gf.features.map(f => ({ id: f.id, x: '', y: '' })) : [] };
        break;
      }
      default:
        freshAnswer = { type: 'text', userAnswer: null };
    }

    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      answerState: freshAnswer,
      isSubmitted: false,
      isCorrect: null,
      showSolution: false,
      startTime: Date.now(),
      endTime: null,
    };
    setQuestionStates(newStates);
  };

  const showSolutionFn = () => {
    const newStates = [...questionStates];
    newStates[currentQuestionIndex] = { ...newStates[currentQuestionIndex], showSolution: true };
    setQuestionStates(newStates);
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentQuestionIndex(index);
      setQuestionStates(prev => {
        const s = [...prev];
        if (!s[index].isSubmitted) s[index] = { ...s[index], startTime: Date.now() };
        return s;
      });
    }
  };
  const goToNextQuestion = () => goToQuestion(currentQuestionIndex + 1);
  const goToPreviousQuestion = () => goToQuestion(currentQuestionIndex - 1);

  const finishQuiz = async () => {
    const newStates = [...questionStates];
    const now = Date.now();
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const state = newStates[i];
      if (!question.question_assignment_id) continue;
      if (!state.isSubmitted) {
        const isCorrect = hasUserAnswer(state) ? gradeQuestion(question, state) : false;
        await saveAnalytics(question.question_assignment_id, isCorrect, now - state.startTime);
        newStates[i] = { ...state, isSubmitted: true, isCorrect, showSolution: false, endTime: now };
      }
    }
    setQuestionStates(newStates);
    setShowResults(true);
  };

  const restartQuiz = () => {
    setAiFeedback('');
    setAiFeedbackRequested(false);
    setAiFeedbackError(null);
    setQuestionStates(questions.map(q => {
      let answerState: AnswerState = { type: 'text', userAnswer: null };
      if (q.question_type === 'multiple-choice')
        answerState = { type: 'multiple-choice', userAnswer: null };
      else if (q.question_type === 'checkbox')
        answerState = { type: 'checkbox', userAnswer: null };
      else if (q.question_type === 'hotspot')
        answerState = { type: 'hotspot', userAnswer: null };
      else if (q.question_type === 'graph_feature') {
        const ca = (q as GraphFeatureQuestion).correct_answer;
        const gf = normaliseGraphFeatureData(typeof ca === 'string' ? (() => { try { return JSON.parse(ca); } catch { return null; } })() : ca);
        answerState = { type: 'graph_feature', userAnswer: gf ? gf.features.map(f => ({ id: f.id, x: '', y: '' })) : [] };
      }
      return { answerState, isSubmitted: false, isCorrect: null, showSolution: false, startTime: Date.now(), endTime: null };
    }));
    setCurrentQuestionIndex(0);
    setShowResults(false);
  };

  // =============== UI ===============

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading quiz...</div>
        </div>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error || 'Quiz not found'}</div>
          <Link href="/home" className="text-blue-600 hover:text-blue-800 underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  // =============== RESULTS SCREEN ===============

  if (showResults) {
    const score = calculateScore();
    const feedback = computeStandardFeedback(questions, questionStates);

    return (
      <div className="min-h-screen bg-gray-50">
        <main className="flex flex-col items-center mt-8 px-6 pb-16">

          {/* ── Score hero ── */}
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-8 text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Quiz Complete</h2>
            <div className={`text-7xl font-bold mb-3 ${
              score.percentage >= 80 ? 'text-green-600' :
              score.percentage >= 60 ? 'text-yellow-600' : 'text-red-500'
            }`}>
              {score.percentage}%
            </div>
            <p className="text-gray-500 mb-1">{score.correct} / {score.total} correct</p>
            <p className="text-lg font-medium text-gray-700">
              {feedback.scoreEmoji} {feedback.scoreMessage}
            </p>
          </div>

          {/* ── Standard feedback panels ── */}
          <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

            {/* Performance by question type */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">By Question Type</h3>
              <div className="space-y-2">
                {feedback.byType.map(({ type, correct, total }) => {
                  const pct = Math.round((correct / total) * 100);
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-gray-600 capitalize">{type.replace('-', ' ')}</span>
                        <span className={`font-medium ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {correct}/{total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timing insights */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Time Insights</h3>
              {feedback.slowQuestions.length === 0 ? (
                <p className="text-sm text-gray-500">You answered all questions promptly. ⚡</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-2">Questions that took over 45 seconds:</p>
                  {feedback.slowQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-orange-400 text-xs mt-0.5">⏱</span>
                      <div>
                        <p className="text-xs text-gray-700 line-clamp-2">{q.text}</p>
                        <p className="text-xs text-orange-500 font-medium">{q.seconds}s</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── AI Feedback section ── */}
          <div className="w-full max-w-2xl mb-6">
            {!aiFeedbackRequested ? (
              <button
                onClick={fetchAiFeedback}
                className="w-full py-4 rounded-2xl font-semibold text-white text-base
                  bg-gradient-to-r from-violet-600 to-indigo-600
                  hover:from-violet-700 hover:to-indigo-700
                  shadow-md hover:shadow-lg transition-all active:scale-[0.98]
                  flex items-center justify-center gap-2"
              >
                <span className="text-xl">✨</span>
                Get personalised AI feedback
              </button>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-indigo-100">
                  <span className="text-lg">✨</span>
                  <h3 className="text-sm font-semibold text-indigo-800">AI Feedback</h3>
                  {aiFeedbackLoading && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-indigo-400">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
                <div className="p-5 min-h-[80px]">
                  {aiFeedbackError ? (
                    <div className="flex items-start gap-2 text-red-600">
                      <span>⚠️</span>
                      <p className="text-sm">{aiFeedbackError}</p>
                    </div>
                  ) : aiFeedback ? (
                    <div className="prose-sm">{renderMarkdown(aiFeedback)}</div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Generating your personalised feedback…</p>
                  )}
                  {/* Blinking cursor while streaming */}
                  {aiFeedbackLoading && aiFeedback && (
                    <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 flex-wrap justify-center mb-8">
            <button onClick={restartQuiz} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-sm">
              Retry Quiz
            </button>
            <Link href="/home" className="px-6 py-3 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 shadow-sm">
              Back to Home
            </Link>
          </div>

          {/* ── Detailed answer review ── */}
          <div className="w-full max-w-2xl">
            <details className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <summary className="cursor-pointer px-6 py-4 font-semibold text-gray-700 text-base select-none hover:bg-gray-50 rounded-2xl">
                Review Your Answers
              </summary>
              <div className="px-6 pb-6 pt-2 space-y-3">
                {questions.map((question, index) => {
                  const state = questionStates[index];
                  let userAnswerDisplay = 'No answer';
                  let correctAnswerDisplay = '';

                  if (question.question_type === 'graph_feature') {
                    const answers = state.answerState.type === 'graph_feature' ? state.answerState.userAnswer || [] : [];
                    userAnswerDisplay = answers.length > 0
                      ? answers.map(a => `(${a.x || '?'}, ${a.y || '?'})`).join(' | ')
                      : 'No answer';
                    const gfCa = question.correct_answer;
                    const gf = normaliseGraphFeatureData(typeof gfCa === 'string' ? (() => { try { return JSON.parse(gfCa); } catch { return null; } })() : gfCa);
                    correctAnswerDisplay = gf ? gf.features.map(f => `(${f.x}, ${f.y})`).join(' | ') : '—';
                  } else if (question.question_type === 'hotspot') {
                    const spots = state.answerState.type === 'hotspot' ? state.answerState.userAnswer || [] : [];
                    userAnswerDisplay = spots.length > 0 ? spots.map(s => `(${Math.round(s.x)}%,${Math.round(s.y)}%)`).join(', ') : 'No answer';
                    correctAnswerDisplay = question.correct_answer.map(s => `(${Math.round(s.x)}%,${Math.round(s.y)}%)`).join(', ');
                  } else if (question.question_type === 'multiple-choice' || question.question_type === 'checkbox') {
                    userAnswerDisplay = state.answerState.type === 'multiple-choice' || state.answerState.type === 'checkbox'
                      ? (state.answerState.userAnswer?.join(', ') || 'No answer') : 'No answer';
                    correctAnswerDisplay = question.correct_answer.join(', ');
                  } else if (question.question_type === 'text') {
                    userAnswerDisplay = state.answerState.type === 'text' ? (state.answerState.userAnswer || 'No answer') : 'No answer';
                    correctAnswerDisplay = question.correct_answer;
                  }

                  const timeSpent = state.endTime
                    ? Math.round((state.endTime - state.startTime) / 1000)
                    : null;

                  return (
                    <div key={index} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 mt-0.5 ${state.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                          {state.isCorrect ? '✓' : '✗'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-800">Q{index + 1}: {question.question_text}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Your answer: <span className={state.isCorrect ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{userAnswerDisplay}</span>
                          </p>
                          {!state.isCorrect && (
                            <p className="text-xs text-gray-500">
                              Correct: <span className="text-green-600 font-medium">{correctAnswerDisplay}</span>
                            </p>
                          )}
                          {timeSpent !== null && (
                            <p className="text-xs text-gray-400 mt-1">⏱ {timeSpent}s</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>

        </main>
      </div>
    );
  }

  // =============== QUIZ TAKING SCREEN ===============

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="flex flex-col items-center mt-8 px-6 pb-8">
        <h2 className="text-3xl font-semibold mb-2 text-gray-800 text-center">{quizData.title}</h2>
        {quizData.description && <p className="text-gray-600 mb-6 text-center max-w-2xl">{quizData.description}</p>}

        <div className="mb-6 text-lg text-gray-700 font-medium">Question {currentQuestionIndex + 1} of {totalQuestions}</div>

        {totalQuestions > 1 && (
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => goToQuestion(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index === currentQuestionIndex ? 'bg-blue-600 text-white' :
                  questionStates[index]?.isSubmitted
                    ? questionStates[index]?.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}

        <div className="w-full max-w-4xl mb-8">
          {currentQuestion ? (
            <div className="bg-white rounded-lg shadow-md p-6 border">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">{currentQuestion.question_text}</h3>

              {/* Multiple Choice */}
              {currentQuestion.question_type === 'multiple-choice' && (
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option, index) => {
                    const isUserAnswer = currentQuestionState?.answerState.type === 'multiple-choice'
                      ? currentQuestionState.answerState.userAnswer?.includes(option) : false;
                    const isCorrectAnswer = currentQuestion.correct_answer.includes(option);
                    return (
                      <label key={index} className={`flex items-center p-4 rounded-lg border transition-colors ${
                        currentQuestionState?.isSubmitted
                          ? isUserAnswer ? isCorrectAnswer ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800'
                          : currentQuestionState?.showSolution && isCorrectAnswer ? 'bg-green-100 border-green-500 text-green-800' : 'bg-gray-50 border-gray-300'
                          : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                      } ${currentQuestionState?.isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={!!isUserAnswer} onChange={() => handleAnswerSelect(option)} disabled={currentQuestionState?.isSubmitted} className="w-5 h-5 text-blue-600 rounded" />
                        <span className="ml-3 flex-1">{option}</span>
                        {currentQuestionState?.showSolution && isCorrectAnswer && <span className="ml-auto text-green-600 font-medium">Correct</span>}
                        {currentQuestionState?.isSubmitted && isUserAnswer && !isCorrectAnswer && <span className="ml-auto text-red-600 font-medium">Incorrect</span>}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Checkbox */}
              {currentQuestion.question_type === 'checkbox' && (
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option, index) => {
                    const isUserAnswer = currentQuestionState?.answerState.type === 'checkbox' || currentQuestionState?.answerState.type === 'multiple-choice'
                      ? currentQuestionState.answerState.userAnswer?.includes(option) : false;
                    const isCorrectAnswer = currentQuestion.correct_answer.includes(option);
                    return (
                      <label key={index} className={`flex items-center p-4 rounded-lg border transition-colors ${
                        currentQuestionState?.isSubmitted
                          ? isUserAnswer ? isCorrectAnswer ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800'
                          : currentQuestionState?.showSolution && isCorrectAnswer ? 'bg-green-100 border-green-500 text-green-800' : 'bg-gray-50 border-gray-300'
                          : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                      } ${currentQuestionState?.isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={!!isUserAnswer} onChange={e => handleCheckboxAnswerSelect(option, e.target.checked)} disabled={currentQuestionState?.isSubmitted} className="w-5 h-5 text-blue-600 rounded" />
                        <span className="ml-3 flex-1">{option}</span>
                        {currentQuestionState?.showSolution && isCorrectAnswer && <span className="ml-auto text-green-600 font-medium">Correct</span>}
                        {currentQuestionState?.isSubmitted && isUserAnswer && !isCorrectAnswer && <span className="ml-auto text-red-600 font-medium">Incorrect</span>}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Text */}
              {currentQuestion.question_type === 'text' && (
                <div className="mb-6">
                  <input
                    type="text"
                    value={currentQuestionState?.answerState.type === 'text' ? currentQuestionState.answerState.userAnswer || '' : ''}
                    onChange={e => handleTextAnswerChange(e.target.value)}
                    disabled={currentQuestionState?.isSubmitted}
                    placeholder="Type your answer here..."
                    className={`w-full p-4 border rounded-lg focus:outline-none focus:ring-2 ${
                      currentQuestionState?.isSubmitted
                        ? currentQuestionState?.isCorrect ? 'bg-green-50 border-green-500 text-green-800'
                        : currentQuestionState?.showSolution ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'
                        : 'bg-white border-gray-300 focus:ring-blue-500'
                    }`}
                  />
                  {currentQuestionState?.showSolution && (
                    <div className="mt-2 text-green-600"><strong>Correct answer:</strong> {currentQuestion.correct_answer}</div>
                  )}
                </div>
              )}

              {/* Hotspot */}
              {currentQuestion.question_type === 'hotspot' && (
                <div className="mb-6">
                  {currentQuestion.image_url ? (
                    <div className="relative inline-block border rounded-lg bg-gray-100 overflow-hidden cursor-crosshair" onClick={handleHotspotClick}>
                      <img src={currentQuestion.image_url} alt="Hotspot question" className="max-w-full h-auto" onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png'; }} />
                      {currentQuestionState?.answerState.type === 'hotspot' &&
                        Array.isArray(currentQuestionState.answerState.userAnswer) &&
                        currentQuestionState.answerState.userAnswer.map((spot, idx) =>
                          isHotspotAnswer(spot) ? (
                            <div key={idx} className="absolute w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow"
                              style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: 'translate(-50%, -50%)' }} />
                          ) : null
                        )}
                      {currentQuestionState?.showSolution &&
                        currentQuestion.correct_answer.map((spot, idx) => (
                          <div key={`c-${idx}`} className="absolute w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow"
                            style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: 'translate(-50%, -50%)' }} title="Correct" />
                        ))}
                    </div>
                  ) : (
                    <div className="bg-red-100 text-red-800 p-4 rounded-lg">⚠️ No image provided for hotspot question.</div>
                  )}
                  <div className="mt-3 text-sm text-gray-600">
                    {!currentQuestionState?.isSubmitted ? 'Click the image to add hotspots. Click an existing hotspot to remove it.'
                      : currentQuestionState.isCorrect ? '✅ Perfect!' : '❌ Not quite.'}
                  </div>
                </div>
              )}

              {/* Graph Feature */}
              {currentQuestion.question_type === 'graph_feature' && (
                <div className="mb-6">
                  <GraphFeatureQuestionView
                    question={currentQuestion as GraphFeatureQuestion}
                    questionState={currentQuestionState}
                    onAnswerChange={handleGraphFeatureAnswerChange}
                  />
                </div>
              )}

              {/* Submit feedback banner */}
              {currentQuestionState?.isSubmitted && (
                <div className={`p-4 rounded-lg mb-4 ${currentQuestionState.isCorrect ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                  {currentQuestionState.isCorrect
                    ? <div className="flex items-center gap-2"><span>🎉</span><span className="font-medium">Correct! Well done!</span></div>
                    : <div className="flex items-center gap-2"><span>❌</span><span className="font-medium">Incorrect. Try again or show solution!</span></div>}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 bg-white rounded-lg border">No question available</div>
          )}
        </div>

        {/* Prev / Next */}
        {totalQuestions > 1 && (
          <div className="flex justify-between w-full max-w-4xl gap-4">
            <button onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${currentQuestionIndex === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              ← Previous
            </button>
            <button onClick={goToNextQuestion} disabled={isLastQuestion}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${isLastQuestion ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              Next →
            </button>
          </div>
        )}

        {/* Check / Retry / Solution / Finish */}
        <div className="flex gap-3 flex-wrap justify-center mt-4">
          {!currentQuestionState?.isSubmitted ? (
            <>
              <button
                onClick={submitAnswer}
                disabled={!hasUserAnswer(currentQuestionState)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${hasUserAnswer(currentQuestionState) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                Check Answer
              </button>
              <button onClick={finishQuiz} className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                Finish Quiz
              </button>
            </>
          ) : (
            <>
              {!currentQuestionState.showSolution && (
                <button onClick={retryQuestion} className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700">Retry</button>
              )}
              {!currentQuestionState.isCorrect && !currentQuestionState.showSolution && (
                <button onClick={showSolutionFn} className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">Show Solution</button>
              )}
              <button onClick={finishQuiz} className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">Finish Quiz</button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}