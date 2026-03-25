'use client';

import { useRouter } from "next/navigation";
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────
interface StatEntry {
  average_score: number;
  error_rate: number;
  correct: number;
  incorrect: number;
  total_attempts: number;
  avg_time: number;
}
interface QuizEntry extends StatEntry { quiz_id: string; title: string; }
interface ModuleEntry extends StatEntry { module: string; }
interface TopicEntry extends StatEntry { topic: string; }
interface QuestionEntry extends StatEntry { question_id: string; text: string; }
interface StudentEntry extends StatEntry { user_id: string; username: string; }

interface AnalyticsData {
  by_quiz: QuizEntry[];
  by_module: ModuleEntry[];
  by_topic: TopicEntry[];
  by_question: QuestionEntry[];
  by_student: StudentEntry[];
}

type SortKey = 'average_score' | 'error_rate' | 'total_attempts' | 'avg_time';
type SortDir = 'asc' | 'desc';

const ALL_VIEW_MODES = [
  { key: 'quiz',     label: 'By Quiz' },
  { key: 'module',   label: 'By Module' },
  { key: 'topic',    label: 'By Topic' },
  { key: 'question', label: 'By Question' },
  { key: 'student',  label: 'By Student' },
] as const;

const STUDENT_VIEW_MODES = [
  { key: 'quiz',     label: 'By Quiz' },
  { key: 'module',   label: 'By Module' },
  { key: 'topic',    label: 'By Topic' },
  { key: 'question', label: 'By Question' },
] as const;

type ViewMode = 'quiz' | 'module' | 'topic' | 'question' | 'student';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'average_score',  label: 'Avg Score' },
  { key: 'error_rate',     label: 'Error Rate' },
  { key: 'total_attempts', label: 'Attempts' },
  { key: 'avg_time',       label: 'Avg Time' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function applyFilterAndSort(
  data: any[], xKey: string, search: string,
  sortKey: SortKey, sortDir: SortDir,
): any[] {
  return [...data]
    .filter(d => String(d[xKey]).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);
}

// ── Subcomponents ──────────────────────────────────────────────────────────
function ChartControls({
  search, onSearch, sortKey, onSortKey, sortDir, onSortDir,
}: {
  search: string; onSearch: (v: string) => void;
  sortKey: SortKey; onSortKey: (k: SortKey) => void;
  sortDir: SortDir; onSortDir: (d: SortDir) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <input
        type="text"
        placeholder="Filter..."
        value={search}
        onChange={e => onSearch(e.target.value)}
        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2 flex-wrap">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => {
              if (sortKey === opt.key) onSortDir(sortDir === 'asc' ? 'desc' : 'asc');
              else { onSortKey(opt.key); onSortDir('desc'); }
            }}
            className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
              sortKey === opt.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
            }`}
          >
            {opt.label} {sortKey === opt.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScrollableBarChart({
  data, xKey, dataKey, title, color, tickFormatter, tooltipFormatter,
}: {
  data: any[]; xKey: string; dataKey: string; title: string; color: string;
  tickFormatter?: (v: any) => string; tooltipFormatter?: (v: any) => string;
}) {
  const minWidth = Math.max(500, data.length * 70);

  if (!data.length) return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-center text-gray-400 py-8 text-sm">No data</p>
    </div>
  );

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                tickFormatter={v => String(v).length > 18 ? `${String(v).slice(0, 18)}…` : String(v)}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={tickFormatter} />
              <Tooltip formatter={(value) => [tooltipFormatter ? tooltipFormatter(value) : value, title]} />
              <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ScrollableAttemptsChart({ data, xKey }: { data: any[]; xKey: string }) {
  const minWidth = Math.max(500, data.length * 70);

  if (!data.length) return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Total Attempts</h3>
      <p className="text-center text-gray-400 py-8 text-sm">No data</p>
    </div>
  );

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Total Attempts (Correct vs Incorrect)</h3>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                tickFormatter={v => String(v).length > 18 ? `${String(v).slice(0, 18)}…` : String(v)}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label, payload) => {
                  if (!payload || payload.length === 0) return label;

                  const data = payload[0].payload;
                  const total = data.correct + data.incorrect;

                  return `${label}: Total: ${total}`;
                }}
                formatter={(value, name, props) => {
                  const data = props.payload;
                  const total = data.correct + data.incorrect;

                  const percent = total > 0
                    ? ((value as number / total) * 100).toFixed(1)
                    : 0;

                  return [`${value} (${percent}%)`, name];
                }}
              />
              <Bar dataKey="correct" stackId="a" fill="#22c55e" name="Correct" />
              <Bar dataKey="incorrect" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Incorrect" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ChartGroup({
  data, xKey, search, onSearch, sortKey, onSortKey, sortDir, onSortDir,
}: {
  data: any[]; xKey: string;
  search: string; onSearch: (v: string) => void;
  sortKey: SortKey; onSortKey: (k: SortKey) => void;
  sortDir: SortDir; onSortDir: (d: SortDir) => void;
}) {
  const filtered = applyFilterAndSort(data, xKey, search, sortKey, sortDir);

  return (
    <div>
      <ChartControls
        search={search} onSearch={onSearch}
        sortKey={sortKey} onSortKey={onSortKey}
        sortDir={sortDir} onSortDir={onSortDir}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScrollableBarChart
          data={filtered} xKey={xKey} dataKey="average_score"
          title="Average Score" color="#3b82f6"
          tickFormatter={v => `${v}%`} tooltipFormatter={v => `${v}%`}
        />
        <ScrollableAttemptsChart data={filtered} xKey={xKey} />
        <ScrollableBarChart
          data={filtered} xKey={xKey} dataKey="avg_time"
          title="Avg. Time (sec)" color="#10b981"
          tooltipFormatter={v => `${v}s`}
        />
      </div>
    </div>
  );
}

// ── Per-group state hook ───────────────────────────────────────────────────
function useGroupState() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('average_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  return { search, setSearch, sortKey, setSortKey, sortDir, setSortDir };
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();
  const { user, role } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('quiz');
  const [loading, setLoading] = useState(false);

  const quiz     = useGroupState();
  const module   = useGroupState();
  const topic    = useGroupState();
  const question = useGroupState();
  const student  = useGroupState();

  const isPrivileged = role === 'teacher' || role === 'admin';
  const viewModes = isPrivileged ? ALL_VIEW_MODES : STUDENT_VIEW_MODES;

  useEffect(() => {
    if (!user) router.push("/");
  }, [user, router]);

  useEffect(() => {
    if (!isPrivileged && viewMode === 'student') setViewMode('quiz');
  }, [role]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch('/api/quiz-statistics')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [user]);

  const renderContent = () => {
    if (loading) return <div className="text-center py-12 text-gray-500">Loading analytics...</div>;
    if (!data) return null;

    const groups: Record<ViewMode, React.ReactNode> = {
      quiz: (
        <ChartGroup data={data.by_quiz} xKey="title"
          search={quiz.search} onSearch={quiz.setSearch}
          sortKey={quiz.sortKey} onSortKey={quiz.setSortKey}
          sortDir={quiz.sortDir} onSortDir={quiz.setSortDir}
        />
      ),
      module: (
        <ChartGroup data={data.by_module} xKey="module"
          search={module.search} onSearch={module.setSearch}
          sortKey={module.sortKey} onSortKey={module.setSortKey}
          sortDir={module.sortDir} onSortDir={module.setSortDir}
        />
      ),
      topic: (
        <ChartGroup data={data.by_topic} xKey="topic"
          search={topic.search} onSearch={topic.setSearch}
          sortKey={topic.sortKey} onSortKey={topic.setSortKey}
          sortDir={topic.sortDir} onSortDir={topic.setSortDir}
        />
      ),
      question: (
        <ChartGroup data={data.by_question} xKey="text"
          search={question.search} onSearch={question.setSearch}
          sortKey={question.sortKey} onSortKey={question.setSortKey}
          sortDir={question.sortDir} onSortDir={question.setSortDir}
        />
      ),
      student: isPrivileged ? (
        <ChartGroup data={data.by_student} xKey="username"
          search={student.search} onSearch={student.setSearch}
          sortKey={student.sortKey} onSortKey={student.setSortKey}
          sortDir={student.sortDir} onSortDir={student.setSortDir}
        />
      ) : null,
    };

    return groups[viewMode] ?? null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="max-w-6xl mx-auto mt-6 px-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
            <button onClick={() => setError(null)} className="absolute top-0 right-0 px-4 py-3">×</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">
            {isPrivileged ? 'Analyze student performance' : 'View your performance'}
          </p>
        </div>

        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          {viewModes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key as ViewMode)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                viewMode === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}