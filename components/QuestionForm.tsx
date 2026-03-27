// components/QuestionForm.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import AIFeedbackSuggester from '@/components/AIFeedbackSuggester';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionInput {
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[] | Hotspot[] | GraphFeatureData;
  image_path?: string;
  question_topic?: string;
  question_feedback?: string;
}

interface Hotspot {
  x: number;
  y: number;
}

// ── Graph Feature ─────────────────────────────────────────────────────────────
interface FeatureAnswer {
  id: string;
  x: number | '';
  y: number | '';
}

interface EquationEntry {
  id: string;
  expr: string;
  color: string;
}

interface GraphFeatureData {
  equations: EquationEntry[];
  xLabel?: string;
  yLabel?: string;
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  features: FeatureAnswer[];
}

const EQUATION_COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#06b6d4'];

const newEquationEntry = (index = 0): EquationEntry => ({
  id: Math.random().toString(36).slice(2),
  expr: '',
  color: EQUATION_COLORS[index % EQUATION_COLORS.length],
});

const DEFAULT_GRAPH_DATA: GraphFeatureData = {
  equations: [{ id: 'eq0', expr: '', color: '#6366f1' }],
  xLabel: '',
  yLabel: '',
  xMin: -10, xMax: 10,
  yMin: -10, yMax: 10,
  features: [],
};

const newFeatureRow = (): FeatureAnswer => ({
  id: Math.random().toString(36).slice(2),
  x: '',
  y: '',
});

// ─────────────────────────────────────────────────────────────────────────────

interface QuestionFormProps {
  onFormSubmit?: (formData: { title: string; questions: QuestionInput[]; description?: string; module: string }) => void;
  initialData?: {
    id?: string;
    title: string;
    module: string;
    description: string;
    questions: any[];
  };
  isEditing?: boolean;
}

interface LocalQuestion {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[] | Hotspot[] | GraphFeatureData;
  image_url?: string;
  imageFile?: File | null;
  filePath?: string;
  graphFeatureData?: GraphFeatureData;
  question_topic?: string;
  question_feedback?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

const isStringArray = (arr: any[]): arr is string[] =>
  Array.isArray(arr) && arr.every(item => typeof item === 'string');

const isHotspotArray = (arr: any[]): arr is Hotspot[] =>
  Array.isArray(arr) && arr.every(
    item => typeof item === 'object' && item !== null && 'x' in item && 'y' in item &&
      typeof item.x === 'number' && typeof item.y === 'number'
  );

const isGraphFeatureData = (val: any): val is GraphFeatureData =>
  val !== null && typeof val === 'object' && 'equations' in val && 'features' in val;

// Migrate quizzes saved with old single-equation shape
function normaliseGF(raw: any): GraphFeatureData {
  if (!raw) return DEFAULT_GRAPH_DATA;
  if (!raw.equations && raw.equation !== undefined) {
    return { ...raw, equations: [{ id: 'eq0', expr: raw.equation ?? '', color: raw.equationColor ?? '#6366f1' }] };
  }
  if (!raw.equations) return { ...raw, equations: [{ id: 'eq0', expr: '', color: '#6366f1' }] };
  const { graphType, imageUrl, equationColor, equation, ...rest } = raw;
  return rest as GraphFeatureData;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
  } catch {
    return null;
  }
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
    ctx.beginPath();
    ctx.moveTo(cx, toY(yMax));
    ctx.lineTo(cx, toY(yMin));
    ctx.stroke();
    return;
  }

  if (parsed.type === 'horizontal') {
    ctx.beginPath();
    ctx.moveTo(toX(xMin), toY(parsed.yVal));
    ctx.lineTo(toX(xMax), toY(parsed.yVal));
    ctx.stroke();
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

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH PREVIEW CANVAS (teacher side)
// ─────────────────────────────────────────────────────────────────────────────

function GraphPreview({ data }: { data: GraphFeatureData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width, H = canvas.height, pad = 36;
    const toX = (x: number) => pad + ((x - data.xMin) / (data.xMax - data.xMin)) * (W - 2 * pad);
    const toY = (y: number) => H - pad - ((y - data.yMin) / (data.yMax - data.yMin)) * (H - 2 * pad);

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    for (let x = Math.ceil(data.xMin); x <= data.xMax; x++) {
      ctx.beginPath(); ctx.moveTo(toX(x), pad); ctx.lineTo(toX(x), H - pad); ctx.stroke();
    }
    for (let y = Math.ceil(data.yMin); y <= data.yMax; y++) {
      ctx.beginPath(); ctx.moveTo(pad, toY(y)); ctx.lineTo(W - pad, toY(y)); ctx.stroke();
    }

    ctx.strokeStyle = '#374151'; ctx.lineWidth = 2;
    if (data.yMin <= 0 && data.yMax >= 0) {
      ctx.beginPath(); ctx.moveTo(pad, toY(0)); ctx.lineTo(W - pad, toY(0)); ctx.stroke();
    }
    if (data.xMin <= 0 && data.xMax >= 0) {
      ctx.beginPath(); ctx.moveTo(toX(0), pad); ctx.lineTo(toX(0), H - pad); ctx.stroke();
    }

    const zy = (data.yMin <= 0 && data.yMax >= 0) ? toY(0) : H - pad;
    const zx = (data.xMin <= 0 && data.xMax >= 0) ? toX(0) : pad;
    ctx.fillStyle = '#9ca3af'; ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let x = Math.ceil(data.xMin); x <= data.xMax; x++) {
      if (x === 0) continue;
      ctx.fillText(String(x), toX(x), zy + 13);
    }
    ctx.textAlign = 'right';
    for (let y = Math.ceil(data.yMin); y <= data.yMax; y++) {
      if (y === 0) continue;
      ctx.fillText(String(y), zx - 5, toY(y) + 3);
    }

    if (data.xLabel) {
      ctx.fillStyle = '#374151'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(data.xLabel, W / 2, H - 2);
    }
    if (data.yLabel) {
      ctx.save();
      ctx.fillStyle = '#374151'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.translate(10, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(data.yLabel, 0, 0);
      ctx.restore();
    }

    (data.equations ?? []).forEach(eq => {
      if (!eq.expr) return;
      drawEquation(ctx, { expr: eq.expr, color: eq.color }, toX, toY, data.xMin, data.xMax, data.yMin, data.yMax, W, pad);
    });

    data.features.forEach(f => {
      if (f.x === '' || f.y === '') return;
      ctx.beginPath(); ctx.arc(toX(Number(f.x)), toY(Number(f.y)), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={400} height={280}
      className="rounded-lg border border-gray-200 w-full"
      style={{ maxWidth: 400 }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH FEATURE CREATOR (teacher-facing builder)
// ─────────────────────────────────────────────────────────────────────────────

function GraphFeatureCreator({
  value,
  onChange,
}: {
  value: GraphFeatureData;
  onChange: (d: GraphFeatureData) => void;
}) {
  const data = value ?? DEFAULT_GRAPH_DATA;
  const set = (p: Partial<GraphFeatureData>) => onChange({ ...data, ...p });

  const addFeature = () => set({ features: [...data.features, newFeatureRow()] });

  const removeFeature = (id: string) =>
    set({ features: data.features.filter(f => f.id !== id) });

  const updateFeature = (id: string, field: keyof FeatureAnswer, val: string | number) =>
    set({ features: data.features.map(f => f.id === id ? { ...f, [field]: val } : f) });

  return (
    <div className="space-y-5 mt-3">
      {/* Equation list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">
            Equations{' '}
            <span className="text-gray-400 font-normal text-xs">
              (use <code>x</code> as variable — e.g. <code>x^2 - 4</code>)
            </span>
          </label>
          <button
            type="button"
            onClick={() => set({ equations: [...(data.equations ?? []), newEquationEntry((data.equations ?? []).length)] })}
            className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700"
          >
            + Add Equation
          </button>
        </div>
        {(data.equations ?? []).map((eq, idx) => (
          <div key={eq.id} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-4 shrink-0">{idx + 1}</span>
            <input
              type="text"
              value={eq.expr}
              onChange={e => set({ equations: data.equations.map(en => en.id === eq.id ? { ...en, expr: e.target.value } : en) })}
              placeholder="e.g. x^2 - 4"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="color"
              value={eq.color}
              onChange={e => set({ equations: data.equations.map(en => en.id === eq.id ? { ...en, color: e.target.value } : en) })}
              className="w-9 h-9 rounded cursor-pointer border border-gray-300 shrink-0"
              title="Line colour"
            />
            {(data.equations ?? []).length > 1 && (
              <button
                type="button"
                onClick={() => set({ equations: data.equations.filter(en => en.id !== eq.id) })}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                title="Remove"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Axis range */}
      <div>
        <label className="block text-sm font-medium mb-2">Axis Range</label>
        <div className="grid grid-cols-2 gap-3">
          {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map(k => (
            <div key={k}>
              <label className="block text-xs text-gray-500 mb-1">{k}</label>
              <input
                type="number"
                value={data[k]}
                onChange={e => set({ [k]: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Axis Labels */}
      <div>
        <label className="block text-sm font-medium mb-2">Axis Labels</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">X-axis</label>
            <input
              type="text"
              value={data.xLabel ?? ''}
              onChange={e => set({ xLabel: e.target.value })}
              placeholder='e.g. "Time (s)"'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Y-axis</label>
            <input
              type="text"
              value={data.yLabel ?? ''}
              onChange={e => set({ yLabel: e.target.value })}
              placeholder='e.g. "Distance (m)"'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <label className="block text-sm font-medium mb-2">Preview</label>
        <GraphPreview data={data} />
      </div>

      {/* Correct answer rows */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium">Correct Answers</label>
          <button
            type="button"
            onClick={addFeature}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-all"
          >
            + Add Answer
          </button>
        </div>

        {data.features.length === 0 && (
          <p className="text-sm text-gray-400 italic">
            No answers yet — click "Add Answer" to add a coordinate students must identify.
          </p>
        )}

        {data.features.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-[80px_80px_32px] gap-2 px-1">
              <span className="text-xs text-gray-500 font-medium text-center">x</span>
              <span className="text-xs text-gray-500 font-medium text-center">y</span>
              <span />
            </div>

            {data.features.map(f => (
              <div key={f.id} className="grid grid-cols-[80px_80px_32px] gap-2 items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <input
                  type="number"
                  value={f.x}
                  onChange={e => updateFeature(f.id, 'x', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  type="number"
                  value={f.y}
                  onChange={e => updateFeature(f.id, 'y', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="button"
                  onClick={() => removeFeature(f.id)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN QuestionForm COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const QuestionForm: React.FC<QuestionFormProps> = ({ onFormSubmit, initialData, isEditing = false }) => {
  const [formTitle, setFormTitle] = useState('');
  const [formModule, setFormModule] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [uploadingImages, setUploadingImages] = useState<{ [key: string]: boolean }>({});
  const [imageLoadedStates, setImageLoadedStates] = useState<{ [key: string]: boolean }>({});

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const hotspotFileInputRef = useRef<HTMLInputElement>(null);

  // Question Bank Modal State
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [questionBank, setQuestionBank] = useState<any[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBankQuestion, setSelectedBankQuestion] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTopic, setFilterTopic] = useState<string>('all');

  // ── Init from initialData ──────────────────────────────────────────────────
  useEffect(() => {
    if (initialData) {
      setFormTitle(initialData.title);
      setFormModule(initialData.module);
      setFormDescription(initialData.description || '');

      const convertedQuestions: LocalQuestion[] = initialData.questions.map((q, index) => {
        const base: LocalQuestion = {
          id: `question-${index}`,
          type: q.type,
          question: q.question,
          options: q.options || [],
          correctAnswer: q.correctAnswer || [],
          image_url: q.image_url || undefined,
          filePath: q.image_path || undefined,
          question_topic: q.question_topic || undefined,
          question_feedback: q.question_feedback || undefined,
        };

        if (q.type === 'graph_feature') {
          let gfData: GraphFeatureData = DEFAULT_GRAPH_DATA;
          if (typeof q.correctAnswer === 'string') {
            try { gfData = normaliseGF(JSON.parse(q.correctAnswer)); } catch {}
          } else if (isGraphFeatureData(q.correctAnswer)) {
            gfData = normaliseGF(q.correctAnswer);
          }
          base.graphFeatureData = gfData;
          base.correctAnswer = gfData;
        }

        return base;
      });

      setQuestions(convertedQuestions);

      const initialImageStates: { [key: string]: boolean } = {};
      initialData.questions.forEach((q, index) => {
        initialImageStates[`question-${index}`] = false;
      });
      setImageLoadedStates(initialImageStates);
    }
  }, [initialData]);

  // ── Question types ─────────────────────────────────────────────────────────
  const questionTypes = [
    { value: 'text',            label: 'Text' },
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'hotspot',         label: 'Hotspot' },
    { value: 'graph_feature',   label: 'Graph' },
  ];

  // ── Add / remove questions ─────────────────────────────────────────────────
  const addQuestion = () => {
    const newQ: LocalQuestion = {
      id: Date.now().toString(),
      type: 'text',
      question: '',
      options: [''],
      correctAnswer: [],
    };
    setQuestions([...questions, newQ]);
    setCurrentQuestionIndex(questions.length);
  };

  const removeQuestion = (id: string) => {
    const newQs = questions.filter(q => q.id !== id);
    setQuestions(newQs);
    if (currentQuestionIndex >= newQs.length) {
      setCurrentQuestionIndex(Math.max(0, newQs.length - 1));
    }
  };

  const updateQuestion = (id: string, field: keyof LocalQuestion, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  // ── Question type change — reset state cleanly ─────────────────────────────
  const handleTypeChange = (id: string, newType: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== id) return q;
      const updated: LocalQuestion = {
        ...q,
        type: newType,
        options: newType === 'multiple-choice' ? [''] : [],
        correctAnswer: newType === 'graph_feature' ? DEFAULT_GRAPH_DATA : [],
        graphFeatureData: newType === 'graph_feature' ? DEFAULT_GRAPH_DATA : undefined,
        image_url: newType === 'hotspot' ? undefined : q.image_url,
        filePath: newType === 'hotspot' ? undefined : q.filePath,
      };
      return updated;
    }));
  };

  // ── Options ────────────────────────────────────────────────────────────────
  const addOption = (questionId: string) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? { ...q, options: [...q.options, ''] } : q
    ));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q =>
      q.id === questionId
        ? { ...q, options: q.options.map((opt, idx) => idx === optionIndex ? value : opt) }
        : q
    ));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q =>
      q.id === questionId
        ? { ...q, options: q.options.filter((_, idx) => idx !== optionIndex) }
        : q
    ));
  };

  // ── Answer handlers ────────────────────────────────────────────────────────
  const handleMultipleChoiceAnswerChange = (questionId: string, selected: string[]) => {
    setQuestions(questions.map(q => q.id === questionId ? { ...q, correctAnswer: selected } : q));
  };

  const handleTextAnswerChange = (questionId: string, value: string) => {
    setQuestions(questions.map(q => q.id === questionId ? { ...q, correctAnswer: value } : q));
  };

  const handleHotspotAnswerChange = (questionId: string, hotspots: Hotspot[]) => {
    setQuestions(questions.map(q => q.id === questionId ? { ...q, correctAnswer: hotspots } : q));
  };

  const handleGraphFeatureChange = (questionId: string, gfData: GraphFeatureData) => {
    setQuestions(questions.map(q =>
      q.id === questionId
        ? { ...q, graphFeatureData: gfData, correctAnswer: gfData }
        : q
    ));
  };

  // ── Shared image upload ────────────────────────────────────────────────────
  const handleImageUpload = async (questionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please upload an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image size must be less than 5MB'); return; }

    try {
      setUploadingImages(prev => ({ ...prev, [questionId]: true }));
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Upload failed: ${response.status}`);
      setQuestions(qs => qs.map(q =>
        q.id === questionId ? { ...q, image_url: result.imageUrl, imageFile: null, filePath: result.filePath } : q
      ));
      setImageLoadedStates(prev => ({ ...prev, [questionId]: false }));
    } catch (error) {
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingImages(prev => ({ ...prev, [questionId]: false }));
      if (fileInputRefs.current[questionId]) fileInputRefs.current[questionId]!.value = '';
      if (hotspotFileInputRef.current) hotspotFileInputRef.current.value = '';
    }
  };

  const handleImageError = async (questionId: string) => {
    try {
      const question = questions.find(q => q.id === questionId);
      if (!question?.filePath) return;
      const response = await fetch('/api/refresh-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: question.filePath }),
      });
      const result = await response.json();
      if (response.ok && result.imageUrl) {
        updateQuestion(questionId, 'image_url', result.imageUrl);
        setImageLoadedStates(prev => ({ ...prev, [questionId]: false }));
      } else {
        alert('Image failed to load. Please re-upload.');
      }
    } catch {
      alert('Image failed to load. Please re-upload.');
    }
  };

  const handleImageLoad = (id: string) => setImageLoadedStates(prev => ({ ...prev, [id]: true }));
  const handleImageLoadStart = (id: string) => setImageLoadedStates(prev => ({ ...prev, [id]: false }));

  // ── Hotspot click handler ──────────────────────────────────────────────────
  const handleImageClick = (questionId: string, event: React.MouseEvent<HTMLDivElement>) => {
    const question = questions.find(q => q.id === questionId);
    if (!question?.image_url) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const currentHotspots = Array.isArray(question.correctAnswer) && isHotspotArray(question.correctAnswer as any[])
      ? (question.correctAnswer as Hotspot[]) : [];
    const existingIdx = currentHotspots.findIndex(
      h => Math.sqrt(Math.pow(h.x - x, 2) + Math.pow(h.y - y, 2)) < 3
    );
    const newHotspots = existingIdx !== -1
      ? currentHotspots.filter((_, i) => i !== existingIdx)
      : [...currentHotspots, { x, y }];
    handleHotspotAnswerChange(questionId, newHotspots);
  };

  // ── Remove image ──────────────────────────────────────────────────────────
  const removeImage = (questionId: string) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== questionId) return q;
      return {
        ...q,
        image_url: undefined,
        imageFile: null,
        filePath: undefined,
        ...(q.type === 'hotspot' ? { correctAnswer: [] } : {}),
      };
    }));
    setImageLoadedStates(prev => ({ ...prev, [questionId]: false }));
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(c => c + 1);
  };
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(c => c - 1);
  };
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) setCurrentQuestionIndex(index);
  };

  // ── Question Bank ──────────────────────────────────────────────────────────
  const addQuestionFromBank = () => {
    setIsBankModalOpen(true);
    fetchQuestionBank();
  };

  const fetchQuestionBank = async () => {
    setLoadingBank(true);
    try {
      const response = await fetch('/api/question-bank', { headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed: ${response.status}`);
      }
      const data = await response.json();
      setQuestionBank(data.questions || []);
    } catch (error) {
      alert(`Failed to load question bank: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingBank(false);
    }
  };

  const handleSelectFromBank = () => {
    if (!selectedBankQuestion) { alert('Please select a question first'); return; }
    const selected = questionBank.find(q => q.id === selectedBankQuestion);
    if (!selected) return;

    console.log('Bank question fields:', JSON.stringify(selected, null, 2));

    const newQ: LocalQuestion = {
      id: Date.now().toString(),
      type: selected.type,
      question: selected.question,
      options: Array.isArray(selected.options) ? [...selected.options] : [],
      correctAnswer: Array.isArray(selected.correctAnswer)
        ? [...selected.correctAnswer]
        : selected.correctAnswer || '',
      image_url: selected.image_url || undefined,
      filePath: selected.image_path || undefined,
      question_topic: selected.topic || undefined,
      question_feedback: selected.feedback || undefined,
    };

    if (selected.type === 'graph_feature') {
      let gf: GraphFeatureData = DEFAULT_GRAPH_DATA;
      if (typeof selected.correctAnswer === 'string') {
        try { gf = normaliseGF(JSON.parse(selected.correctAnswer)); } catch {}
      } else if (isGraphFeatureData(selected.correctAnswer)) {
        gf = normaliseGF(selected.correctAnswer);
      }
      newQ.graphFeatureData = gf;
      newQ.correctAnswer = gf;
    }

    const newIndex = questions.length;

    setQuestions(prev => [...prev, newQ]);

    if (newQ.image_url) {
      setImageLoadedStates(prev => ({ ...prev, [newQ.id]: false }));
    }

    setCurrentQuestionIndex(newIndex);
    setIsBankModalOpen(false);
    setSelectedBankQuestion(null);
    setSearchTerm('');
  };

  const filteredBankQuestions = React.useMemo(() =>
    questionBank.filter(q => {
      const matchSearch = searchTerm === '' ||
        q.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.options?.some((o: string) => o.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = filterType === 'all' || q.type === filterType;
      const matchTopic = filterTopic === 'all' ||
        (filterTopic === 'uncategorised' ? !q.topic : q.topic === filterTopic);
      return matchSearch && matchType && matchTopic;
    }),
    [questionBank, searchTerm, filterType, filterTopic]
  );

  const availableTopics = React.useMemo(() =>
    Array.from(new Set(questionBank.map(q => q.topic).filter(Boolean))) as string[],
    [questionBank]
  );

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateQuestion = (question: LocalQuestion): string | null => {
    if (!question.question.trim()) return 'Question text is required';

    switch (question.type) {
      case 'text':
        if (!question.correctAnswer || (question.correctAnswer as string).trim() === '')
          return 'Correct answer is required for text questions';
        break;
      case 'multiple-choice':
        if (question.options.length < 2) return 'Multiple choice needs at least 2 options';
        if (question.options.some(o => !o.trim())) return 'All options must have text';
        if (!Array.isArray(question.correctAnswer) || (question.correctAnswer as string[]).length === 0)
          return 'Please select at least one correct answer';
        break;
      case 'hotspot':
        if (!question.image_url) return 'Image is required for hotspot questions';
        if (!Array.isArray(question.correctAnswer) || (question.correctAnswer as Hotspot[]).length === 0)
          return 'Please add at least one hotspot';
        break;
      case 'graph_feature': {
        const gf = question.graphFeatureData;
        if (!gf) return 'Graph configuration is missing';
        if (!gf.equations?.some(e => e.expr.trim()))
          return 'Please enter at least one equation';
        if (gf.features.length === 0)
          return 'Please add at least one correct answer';
        if (gf.features.some(f => f.x === '' || f.y === ''))
          return 'Please enter x and y values for all answers';
        break;
      }
    }
    return null;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { alert('Please enter a quiz title'); return; }
    if (!formModule.trim()) { alert('Please enter a quiz module'); return; }
    if (questions.length === 0) { alert('Please add at least one question'); return; }

    const errors = questions.map(q => validateQuestion(q)).filter(Boolean);
    if (errors.length > 0) { alert(`Please fix:\n\n${errors.join('\n')}`); return; }

    if (Object.values(uploadingImages).some(s => s)) {
      alert('Please wait for images to finish uploading'); return;
    }

    const buildQuestion = (q: LocalQuestion): QuestionInput => {
      if (q.type === 'graph_feature') {
        return {
          type: q.type,
          question: q.question,
          options: [],
          correctAnswer: q.graphFeatureData ?? DEFAULT_GRAPH_DATA,
          image_path: q.filePath,
          question_topic: q.question_topic || undefined,
          question_feedback: q.question_feedback || undefined,
        };
      }
      return {
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer as string | string[] | Hotspot[],
        image_path: q.filePath,
        question_topic: q.question_topic || undefined,
        question_feedback: q.question_feedback || undefined,
      };
    };

    try {
      if (onFormSubmit) {
        onFormSubmit({
          title: formTitle,
          description: formDescription,
          questions: questions.map(buildQuestion),
          module: formModule,
        });
      } else {
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing && initialData?.id ? `/api/quizzes/${initialData.id}` : '/api/quizzes';
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle,
            module: formModule,
            description: formDescription,
            questions: questions.map(buildQuestion),
          }),
        });
        if (response.ok) {
          alert(isEditing ? 'Quiz updated!' : 'Quiz created!');
          if (!isEditing) {
            setFormTitle(''); setFormModule(''); setFormDescription(''); setQuestions([]);
            setCurrentQuestionIndex(0); setImageLoadedStates({});
          }
        } else {
          const err = await response.json();
          throw new Error(err.error || 'Failed to save quiz');
        }
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderQuestionOptions = (question: LocalQuestion) => {
    if (question.type !== 'multiple-choice') return null;
    return (
      <div className="options-section mt-3 p-3 bg-gray-50 rounded">
        <label className="block text-sm font-medium mb-2">Options:</label>
        {question.options.map((option, index) => (
          <div key={index} className="flex items-center mb-2">
            <input
              type="text"
              value={option}
              onChange={e => updateOption(question.id, index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 border p-2 rounded mr-2"
            />
            {question.options.length > 1 && (
              <button
                type="button"
                onClick={() => removeOption(question.id, index)}
                className="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addOption(question.id)}
          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
        >
          Add Option
        </button>
      </div>
    );
  };

  const renderOptionalImage = (question: LocalQuestion) => {
    if (question.type === 'hotspot') return null;

    const isUploading = uploadingImages[question.id];
    const isImageLoaded = imageLoadedStates[question.id] || false;

    return (
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Question Image{' '}
            <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          {question.image_url && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRefs.current[question.id]?.click()}
                disabled={isUploading}
                className={`px-3 py-1 rounded text-sm ${
                  isUploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isUploading ? 'Uploading…' : 'Change'}
              </button>
              <button
                type="button"
                onClick={() => removeImage(question.id)}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={el => { fileInputRefs.current[question.id] = el; }}
          onChange={e => handleImageUpload(question.id, e)}
          disabled={isUploading}
        />

        {!question.image_url ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => !isUploading && fileInputRefs.current[question.id]?.click()}
          >
            {isUploading ? (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-sm">Uploading…</span>
              </div>
            ) : (
              <>
                <svg className="mx-auto mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">Click to upload an image</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF, WEBP — max 5 MB</p>
              </>
            )}
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-w-lg">
            {!isImageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <span className="text-sm text-gray-400">Loading image…</span>
              </div>
            )}
            <img
              src={question.image_url}
              alt="Question illustration"
              className="w-full h-auto object-contain max-h-64"
              onError={() => handleImageError(question.id)}
              onLoad={() => handleImageLoad(question.id)}
              onLoadStart={() => handleImageLoadStart(question.id)}
            />
          </div>
        )}
      </div>
    );
  };

  const renderHotspotQuestion = (question: LocalQuestion) => {
    const hotspots = Array.isArray(question.correctAnswer) && isHotspotArray(question.correctAnswer as any[])
      ? (question.correctAnswer as Hotspot[]) : [];
    const isUploading = uploadingImages[question.id];
    const isImageLoaded = imageLoadedStates[question.id] || false;

    return (
      <div className="hotspot-section mt-3">
        <label className="block text-sm font-medium mb-2">Image Upload:</label>
        {!question.image_url ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={hotspotFileInputRef}
              type="file"
              accept="image/*"
              onChange={e => handleImageUpload(question.id, e)}
              className="hidden"
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={() => hotspotFileInputRef.current?.click()}
              disabled={isUploading}
              className={`px-4 py-2 rounded text-white ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {isUploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <p className="text-sm text-gray-500 mt-2">JPG, PNG, GIF, WEBP — max 5MB</p>
          </div>
        ) : (
          <div className="relative">
            <div
              className="border-2 border-gray-300 rounded-lg cursor-crosshair bg-gray-50 max-w-2xl mx-auto relative"
              style={{ aspectRatio: '16/9' }}
              onClick={e => handleImageClick(question.id, e)}
            >
              {!isImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
                  <div className="text-gray-500">Loading image...</div>
                </div>
              )}
              <img
                src={question.image_url}
                alt="Hotspot background"
                className="w-full h-full object-contain rounded-lg"
                onError={() => handleImageError(question.id)}
                onLoad={() => handleImageLoad(question.id)}
                onLoadStart={() => handleImageLoadStart(question.id)}
              />
              {isImageLoaded && hotspots.map((hotspot, index) => (
                <div
                  key={index}
                  className="absolute w-6 h-6 bg-red-500 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 animate-pulse z-20"
                  style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                  title={`Hotspot ${index + 1}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{index + 1}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => removeImage(question.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Remove Image</button>
              <button type="button" onClick={() => hotspotFileInputRef.current?.click()} disabled={isUploading} className={`px-3 py-1 rounded text-sm ${isUploading ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>Change Image</button>
            </div>
          </div>
        )}
        <div className="mt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">• Click the image to add hotspots<br />• Click existing hotspots to remove them</p>
          </div>
        </div>
      </div>
    );
  };

  const renderCorrectAnswerField = (question: LocalQuestion) => {
    switch (question.type) {
      case 'text':
        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">Correct Answer:</label>
            <input
              type="text"
              value={question.correctAnswer as string}
              onChange={e => handleTextAnswerChange(question.id, e.target.value)}
              placeholder="Enter the correct answer"
              className="w-full border p-2 rounded"
              required
            />
          </div>
        );

      case 'multiple-choice': {
        const selectedOptions = Array.isArray(question.correctAnswer) && isStringArray(question.correctAnswer as any[])
          ? (question.correctAnswer as string[]) : [];
        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">Select Correct Answer(s) — click to toggle:</label>
            <div className="border border-gray-300 rounded-lg p-3 bg-white min-h-[120px] max-h-60 overflow-y-auto">
              {question.options.map((option, index) => {
                const isSelected = selectedOptions.includes(option);
                return (
                  <div
                    key={index}
                    onClick={() => {
                      const newAns = isSelected
                        ? selectedOptions.filter(a => a !== option)
                        : [...selectedOptions, option];
                      handleMultipleChoiceAnswerChange(question.id, newAns);
                    }}
                    className={`m-1 px-3 py-2 rounded-full text-sm font-medium transition-all inline-block cursor-pointer ${
                      isSelected ? 'bg-blue-500 text-white border border-blue-600' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {option || `Option ${index + 1}`}{isSelected && ' ✓'}
                  </div>
                );
              })}
            </div>
            {selectedOptions.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <strong>Selected:</strong> {selectedOptions.join(', ')}
              </div>
            )}
          </div>
        );
      }

      case 'hotspot':
        return renderHotspotQuestion(question);

      case 'graph_feature':
        return (
          <GraphFeatureCreator
            value={question.graphFeatureData ?? DEFAULT_GRAPH_DATA}
            onChange={gfData => handleGraphFeatureChange(question.id, gfData)}
          />
        );

      default:
        return null;
    }
  };

  // ── Helper: derive a serialisable correctAnswer string for the suggester ───
  const getCorrectAnswerForSuggester = (question: LocalQuestion): string | string[] => {
    if (question.type === 'graph_feature') {
      const gf = question.graphFeatureData;
      if (!gf) return '';
      const eqs = (gf.equations ?? []).filter(e => e.expr).map(e => e.expr).join(', ');
      const pts = gf.features
        .filter(f => f.x !== '' && f.y !== '')
        .map(f => `(${f.x}, ${f.y})`)
        .join(', ');
      return `Equations: ${eqs || 'none'}. Key points: ${pts || 'none'}`;
    }
    if (question.type === 'hotspot') {
      const hs = Array.isArray(question.correctAnswer) && isHotspotArray(question.correctAnswer as any[])
        ? (question.correctAnswer as Hotspot[]) : [];
      return hs.length > 0
        ? hs.map((h, i) => `Hotspot ${i + 1} at (${h.x.toFixed(1)}%, ${h.y.toFixed(1)}%)`).join(', ')
        : '';
    }
    return question.correctAnswer as string | string[];
  };

  const currentQuestion = questions[currentQuestionIndex];

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="form-container bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isEditing ? 'Edit Quiz' : 'Create Quiz Form'}
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="form-group mb-4">
          <label htmlFor="formTitle" className="block text-sm font-medium mb-2">Quiz Title:</label>
          <input
            type="text"
            id="formTitle"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Enter quiz title"
            className="w-full border p-2 rounded"
            required
          />
        </div>

        {/* Module */}
        <div className="form-group mb-4">
          <label htmlFor="formModule" className="block text-sm font-medium mb-2">Quiz Module:</label>
          <input
            type="text"
            id="formModule"
            value={formModule}
            onChange={e => setFormModule(e.target.value)}
            placeholder="Enter quiz module"
            className="w-full border p-2 rounded"
            required
          />
        </div>

        {/* Description */}
        <div className="form-group mb-4">
          <label htmlFor="formDescription" className="block text-sm font-medium mb-2">Quiz Description (Optional):</label>
          <textarea
            id="formDescription"
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Enter quiz description"
            className="w-full border p-2 rounded"
            rows={3}
          />
        </div>

        {/* Navigation dots */}
        {questions.length > 0 && (
          <div className="navigation-section mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Question {currentQuestionIndex + 1} of {questions.length}</h3>
              <div className="flex space-x-2">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${index === currentQuestionIndex ? 'bg-blue-500' : 'bg-gray-300 hover:bg-gray-400'}`}
                    title={`Go to question ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between mb-4">
              <button
                type="button"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Current question card */}
        <div className="questions-section mb-6">
          {currentQuestion ? (
            <div key={currentQuestion.id} className="question-card border border-gray-200 rounded-lg p-4 mb-4 bg-white">
              <div className="question-header flex justify-between items-center mb-4 pb-2 border-b">
                <h4 className="text-lg font-medium">Question {currentQuestionIndex + 1}</h4>
                <button
                  type="button"
                  onClick={() => removeQuestion(currentQuestion.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>

              <div className="question-controls space-y-3">
                {/* Type selector */}
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Question Type:</label>
                  <select
                    value={currentQuestion.type}
                    onChange={e => handleTypeChange(currentQuestion.id, e.target.value)}
                    className="w-full border p-2 rounded"
                  >
                    {questionTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Question text */}
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Question Text:</label>
                  <input
                    type="text"
                    value={currentQuestion.question}
                    onChange={e => updateQuestion(currentQuestion.id, 'question', e.target.value)}
                    placeholder="Enter your question"
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>

                {/* Topic */}
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Topic:</label>
                  <input
                    type="text"
                    value={currentQuestion.question_topic ?? ''}
                    onChange={e => updateQuestion(currentQuestion.id, 'question_topic', e.target.value)}
                    placeholder="Enter question's topic"
                    className="w-full border p-2 rounded"
                  />
                </div>

                {renderQuestionOptions(currentQuestion)}
                {renderCorrectAnswerField(currentQuestion)}

                {/* ── Feedback + AI Suggester ───────────────────────────────── */}
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Feedback:</label>
                  <input
                    type="text"
                    value={currentQuestion.question_feedback ?? ''}
                    onChange={e => updateQuestion(currentQuestion.id, 'question_feedback', e.target.value)}
                    placeholder="Enter question's feedback"
                    className="w-full border p-2 rounded"
                  />
                  <AIFeedbackSuggester
                    questionText={currentQuestion.question}
                    questionType={currentQuestion.type}
                    options={currentQuestion.options.length > 0 ? currentQuestion.options : undefined}
                    correctAnswer={getCorrectAnswerForSuggester(currentQuestion)}
                    quizTitle={formTitle || undefined}
                    questionTopic={currentQuestion.question_topic || undefined}
                    currentFeedback={currentQuestion.question_feedback || undefined}
                    onAccept={(feedback) => updateQuestion(currentQuestion.id, 'question_feedback', feedback)}
                  />
                </div>

                {/* Optional image — shown for all non-hotspot types */}
                {renderOptionalImage(currentQuestion)}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No questions yet. Click "Add Question" to get started.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="form-actions flex justify-between">
          <button type="button" onClick={addQuestion} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Add New Question
          </button>
          <button type="button" onClick={addQuestionFromBank} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Add From Question Bank
          </button>
          {questions.length > 0 && (
            <button type="submit" className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
              {isEditing ? 'Update Quiz' : 'Save Quiz'}
            </button>
          )}
        </div>

        {/* ── Question Bank Modal ──────────────────────────────────────────── */}
        {isBankModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold">Question Bank</h3>
                <button type="button" onClick={() => { setIsBankModalOpen(false); setSelectedBankQuestion(null); setSearchTerm(''); }} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
              </div>

              <div className="p-4 border-b space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Search Questions</label>
                    <input
                      type="text"
                      placeholder="Search by question text..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-52">
                    <label className="block text-sm font-medium mb-1">Filter by Topic</label>
                    <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className="w-full border rounded px-3 py-2">
                      <option value="all">All Topics</option>
                      {availableTopics.map(topic => (
                        <option key={topic} value={topic}>{topic}</option>
                      ))}
                      <option value="uncategorised">Uncategorised</option>
                    </select>
                  </div>
                  <div className="w-52">
                    <label className="block text-sm font-medium mb-1">Filter by Type</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full border rounded px-3 py-2">
                      <option value="all">All Types</option>
                      <option value="text">Text</option>
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="hotspot">Hotspot</option>
                      <option value="graph_feature">Graph Feature</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {loadingBank ? (
                  <div className="text-center py-8 text-gray-500">Loading questions...</div>
                ) : questionBank.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No questions in the bank yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left text-sm font-medium">Select</th>
                          <th className="p-3 text-left text-sm font-medium">Type</th>
                          <th className="p-3 text-left text-sm font-medium">Topic</th>
                          <th className="p-3 text-left text-sm font-medium">Question</th>
                          <th className="p-3 text-left text-sm font-medium">Options</th>
                          <th className="p-3 text-left text-sm font-medium">Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBankQuestions.map(q => {
                          const isSelected = selectedBankQuestion === q.id;
                          const typeColors: Record<string, string> = {
                            text: 'bg-blue-100 text-blue-800',
                            'multiple-choice': 'bg-green-100 text-green-800',
                            hotspot: 'bg-purple-100 text-purple-800',
                            graph_feature: 'bg-indigo-100 text-indigo-800',
                          };
                          return (
                            <tr
                              key={q.id}
                              className={`border-b hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                              onClick={() => setSelectedBankQuestion(q.id)}
                            >
                              <td className="p-3">
                                <input type="radio" checked={isSelected} onChange={() => setSelectedBankQuestion(q.id)} className="w-4 h-4" />
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[q.type] ?? 'bg-gray-100 text-gray-800'}`}>
                                  {q.type === 'multiple-choice' ? 'MCQ' : q.type === 'graph_feature' ? 'Graph' : q.type}
                                </span>
                              </td>
                              <td className="p-3 text-sm text-gray-600">
                                {q.topic || <span className="text-gray-400 italic">Uncategorised</span>}
                              </td>
                              <td className="p-3 max-w-md truncate">{q.question || <span className="text-gray-400">No text</span>}</td>
                              <td className="p-3 text-sm text-gray-600">
                                {q.options?.length > 0 ? `${q.options.length} option${q.options.length !== 1 ? 's' : ''}` : '—'}
                              </td>
                              <td className="p-3 text-sm text-gray-600 truncate max-w-xs">
                                {q.feedback
                                  ? q.feedback.substring(0, 40) + (q.feedback.length > 40 ? '...' : '')
                                  : <span className="text-gray-400 italic">No feedback</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex justify-between items-center">
                <div className="text-sm text-gray-600">{filteredBankQuestions.length} of {questionBank.length} shown</div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setIsBankModalOpen(false); setSelectedBankQuestion(null); setSearchTerm(''); }} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                  <button
                    type="button"
                    onClick={handleSelectFromBank}
                    disabled={!selectedBankQuestion}
                    className={`px-4 py-2 rounded font-medium ${selectedBankQuestion ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  >
                    Add Selected Question
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default QuestionForm;