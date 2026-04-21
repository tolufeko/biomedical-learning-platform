// app/analytics/page.tsx
'use client';

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { SortKey, RawRecord, SortDir, ViewMode } from "@/lib/types/analytics";

const ALL_VIEW_MODES = [
  { key: 'student',  label: 'By Student' },
  { key: 'module',   label: 'By Module' },
  { key: 'quiz',     label: 'By Quiz' },
  { key: 'topic',    label: 'By Topic' },
  { key: 'question', label: 'By Question' },
] as const;

const STUDENT_VIEW_MODES = [
  { key: 'module',   label: 'By Module' },
  { key: 'quiz',     label: 'By Quiz' },
  { key: 'topic',    label: 'By Topic' },
  { key: 'question', label: 'By Question' },
] as const;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'average_score',  label: 'Avg Score' },
  { key: 'error_rate',     label: 'Error Rate' },
  { key: 'total_attempts', label: 'Attempts' },
  { key: 'avg_time',       label: 'Avg Time' },
];

function aggregate(
  records: RawRecord[],
  keyFn: (r: RawRecord) => string,
  extraFn: (r: RawRecord) => Record<string, any>,
): any[] {
  const map: Record<string, { total: number; correct: number; incorrect: number; time: number; extra: Record<string, any> }> = {};
  records.forEach(r => {
    const key = keyFn(r);
    if (!key) return;
    if (!map[key]) map[key] = { total: 0, correct: 0, incorrect: 0, time: 0, extra: extraFn(r) };
    map[key].total++;
    if (r.correct) map[key].correct++;
    else map[key].incorrect++;
    map[key].time += r.time_spent;
  });

  return Object.entries(map).map(([key, s]) => ({
    ...s.extra,
    average_score: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
    error_rate: parseFloat(((s.incorrect / s.total) * 100).toFixed(1)),
    correct: s.correct,
    incorrect: s.incorrect,
    total_attempts: s.total,
    avg_time: Math.round(s.time / s.total),
  }));
}

function applySort(data: any[], sortKey: SortKey, sortDir: SortDir): any[] {
  return [...data].sort((a, b) => sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const filtered = useMemo(() => 
    options.filter(o => o.toLowerCase().includes(value.toLowerCase())),
    [options, value]
  );

  if (!options.length) return null;

  return (
    <div className="flex flex-col gap-1 min-w-48">
      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type="text"
          placeholder={`Filter ${label}...`}
          value={value}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-xl">
            <button
              onClick={() => { onChange(''); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!value ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
            >
              All {label}s
            </button>
            {filtered.map(o => (
              <button
                key={o}
                onClick={() => { onChange(o); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${value === o ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartControls({
  search, onSearch, sortKey, onSortKey, sortDir, onSortDir,
  filters, hideSort = false, onClearAll
}: {
  search: string; onSearch: (v: string) => void;
  sortKey: SortKey; onSortKey: (k: SortKey) => void;
  sortDir: SortDir; onSortDir: (d: SortDir) => void;
  filters?: React.ReactNode;
  hideSort?: boolean;
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Filter & Sort</h4>
        <button 
          onClick={onClearAll}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          ✕ Clear All
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Search Name</label>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        
        {!hideSort && (
          <div className="flex-none">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block">Sort By</label>
            <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-200">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (sortKey === opt.key) onSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else { onSortKey(opt.key); onSortDir('desc'); }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    sortKey === opt.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {opt.label} {sortKey === opt.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filters && (
        <div className="pt-2 flex flex-wrap gap-4 items-end">
          {filters}
        </div>
      )}
    </div>
  );
}

function ScrollableBarChart({
  data, xKey, dataKey, title, color, tickFormatter, tooltipFormatter, onBarClick,
}: {
  data: any[]; xKey: string; dataKey: string; title: string; color: string;
  tickFormatter?: (v: any) => string; tooltipFormatter?: (v: any) => string;
  onBarClick?: (entry: any) => void;
}) {
  const minWidth = Math.max(500, data.length * 70);
  if (!data.length) return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm h-[320px] flex flex-col justify-center items-center">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">No data</p>
    </div>
  );
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 64 }}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0}
                tickFormatter={v => String(v).length > 18 ? `${String(v).slice(0, 18)}…` : String(v)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={tickFormatter} />
              <Tooltip formatter={(value) => [tooltipFormatter ? tooltipFormatter(value) : value, title]} />
              <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]}
                onClick={onBarClick ? (entry) => onBarClick(entry) : undefined} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ScrollableAttemptsChart({ data, xKey, onBarClick }: {
  data: any[]; xKey: string; onBarClick?: (entry: any) => void;
}) {
  const minWidth = Math.max(500, data.length * 70);
  if (!data.length) return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm h-[320px] flex flex-col justify-center items-center">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Total Attempts</h3>
      <div className="text-gray-400 text-sm">No data</div>
    </div>
  );
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Total Attempts</h3>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 64 }}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0}
                tickFormatter={v => String(v).length > 18 ? `${String(v).slice(0, 18)}…` : String(v)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', padding: '10px' }}
                labelFormatter={(label, payload) => {
                  if (!payload?.length) return label;
                  const d = payload[0].payload;
                  const total = d.correct + d.incorrect;
                  const cPct = total > 0 ? ((d.correct / total) * 100).toFixed(1) : 0;
                  const iPct = total > 0 ? ((d.incorrect / total) * 100).toFixed(1) : 0;

                  // FIXED: Changed p tag to div to prevent hydration error
                  return (
                    <div className="flex flex-col gap-1">
                      <div className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1">{label}</div>
                      <div className="text-gray-600 font-medium text-xs">Total: {total}</div>
                      <div className="text-green-600 text-xs">Correct: {d.correct} ({cPct}%)</div>
                      <div className="text-red-600 text-xs">Incorrect: {d.incorrect} ({iPct}%)</div>
                    </div>
                  );
                }}
                formatter={() => null} 
              />
              <Bar dataKey="correct" stackId="a" fill="#22c55e"
                onClick={onBarClick ? (entry) => onBarClick(entry) : undefined} />
              <Bar dataKey="incorrect" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]}
                onClick={onBarClick ? (entry) => onBarClick(entry) : undefined} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ChartGroup({
  data, xKey, search, onSearch, sortKey, onSortKey, sortDir, onSortDir, onBarClick, filters, hideSort, onClearAll
}: {
  data: any[]; xKey: string;
  search: string; onSearch: (v: string) => void;
  sortKey: SortKey; onSortKey: (k: SortKey) => void;
  sortDir: SortDir; onSortDir: (d: SortDir) => void;
  onBarClick?: (entry: any) => void;
  filters?: React.ReactNode;
  hideSort?: boolean;
  onClearAll: () => void;
}) {
  const filtered = applySort(
    data.filter(d => String(d[xKey]).toLowerCase().includes(search.toLowerCase())),
    sortKey, sortDir
  );

  return (
    <div>
      <ChartControls
        search={search} onSearch={onSearch}
        sortKey={sortKey} onSortKey={onSortKey}
        sortDir={sortDir} onSortDir={onSortDir}
        filters={filters}
        hideSort={hideSort}
        onClearAll={onClearAll}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScrollableBarChart data={filtered} xKey={xKey} dataKey="average_score"
          title="Average Score" color="#3b82f6"
          tickFormatter={v => `${v}%`} tooltipFormatter={v => `${v}%`}
          onBarClick={onBarClick} />
        
        <ScrollableAttemptsChart data={filtered} xKey={xKey} onBarClick={onBarClick} />
        
        <div className="md:col-span-2 lg:col-span-1">
          <ScrollableBarChart data={filtered} xKey={xKey} dataKey="avg_time"
            title="Avg. Time (sec)" color="#10b981"
            tooltipFormatter={v => `${v}s`} onBarClick={onBarClick} />
        </div>
      </div>
    </div>
  );
}

function useGroupState() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('average_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  return { search, setSearch, sortKey, setSortKey, sortDir, setSortDir };
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, role } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<RawRecord[]>([]);
  const [isPrivilegedData, setIsPrivilegedData] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('student');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ module: '', quiz: '', topic: '' });

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
    if (!isPrivileged && viewMode === 'student') setViewMode('module');
  }, [role, isPrivileged, viewMode]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch('/api/quiz-statistics')
      .then(r => r.json())
      .then(d => { setRecords(d.records || []); setIsPrivilegedData(d.is_privileged); })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [user]);

  const allModules = useMemo(() => [...new Set(records.map(r => r.module))].sort(), [records]);
  const allQuizzes = useMemo(() => [...new Set(records.map(r => r.quiz_title))].sort(), [records]);
  const allTopics  = useMemo(() => [...new Set(records.map(r => r.question_topic))].sort(), [records]);

  const filteredRecords = useMemo(() => records.filter(r => {
    if (filters.module && r.module !== filters.module) return false;
    if (filters.quiz   && r.quiz_title !== filters.quiz) return false;
    if (filters.topic  && r.question_topic !== filters.topic) return false;
    return true;
  }), [records, filters]);

  const by_quiz = useMemo(() => aggregate(filteredRecords, r => r.quiz_id, r => ({ quiz_id: r.quiz_id, title: r.quiz_title })), [filteredRecords]);
  const by_module = useMemo(() => aggregate(filteredRecords, r => r.module, r => ({ module: r.module })), [filteredRecords]);
  const by_topic = useMemo(() => aggregate(filteredRecords, r => r.question_topic, r => ({ topic: r.question_topic })), [filteredRecords]);
  const by_question = useMemo(() => aggregate(filteredRecords, r => r.question_id, r => ({ question_id: r.question_id, text: r.question_text })), [filteredRecords]);
  const by_student = useMemo(() => isPrivilegedData ? aggregate(filteredRecords, r => r.user_id, r => ({ user_id: r.user_id, username: r.username })) : [], [filteredRecords, isPrivilegedData]);
  
  const handleClearAll = () => {
    setFilters({ module: '', quiz: '', topic: '' });
    [module, quiz, topic, question, student].forEach(s => {
      s.setSearch('');
      s.setSortKey('average_score');
      s.setSortDir('desc');
    });
  };

  const renderContent = () => {
    if (loading) return <div className="text-center py-12 text-gray-500 font-medium">Loading analytics...</div>;
    if (!records.length && !loading) return <div className="text-center py-12 text-gray-400">No data available.</div>;

    const moduleFilter = <FilterSelect label="Module" value={filters.module} onChange={v => setFilters(f => ({ ...f, module: v }))} options={allModules} />;
    const quizFilter   = <FilterSelect label="Quiz"   value={filters.quiz}   onChange={v => setFilters(f => ({ ...f, quiz: v }))}   options={allQuizzes} />;
    const topicFilter  = <FilterSelect label="Topic"  value={filters.topic}  onChange={v => setFilters(f => ({ ...f, topic: v }))}  options={allTopics} />;
    const commonProps = { onClearAll: handleClearAll };

    const groups: Record<ViewMode, React.ReactNode> = {
      student: (
        <ChartGroup data={by_student} xKey="username" {...commonProps}
          search={student.search} onSearch={student.setSearch}
          sortKey={student.sortKey} onSortKey={student.setSortKey}
          sortDir={student.sortDir} onSortDir={student.setSortDir}
          filters={null}
          hideSort={true}
        />
      ),
      module: (
        <ChartGroup data={by_module} xKey="module" {...commonProps}
          search={module.search} onSearch={module.setSearch}
          sortKey={module.sortKey} onSortKey={module.setSortKey}
          sortDir={module.sortDir} onSortDir={module.setSortDir}
          onBarClick={(entry) => router.push(`/home?module=${encodeURIComponent(entry.module)}`)}
        />
      ),
      quiz: (
        <ChartGroup data={by_quiz} xKey="title" {...commonProps}
          search={quiz.search} onSearch={quiz.setSearch}
          sortKey={quiz.sortKey} onSortKey={quiz.setSortKey}
          sortDir={quiz.sortDir} onSortDir={quiz.setSortDir}
          onBarClick={(entry) => router.push(`/quiz/${entry.quiz_id}`)}
          filters={<>{moduleFilter}</>}
        />
      ),
      topic: (
        <ChartGroup data={by_topic} xKey="topic" {...commonProps}
          search={topic.search} onSearch={topic.setSearch}
          sortKey={topic.sortKey} onSortKey={topic.setSortKey}
          sortDir={topic.sortDir} onSortDir={topic.setSortDir}
          filters={<>{moduleFilter}{quizFilter}</>}
        />
      ),
      question: (
        <ChartGroup data={by_question} xKey="text" {...commonProps}
          search={question.search} onSearch={question.setSearch}
          sortKey={question.sortKey} onSortKey={question.setSortKey}
          sortDir={question.sortDir} onSortDir={question.setSortDir}
          filters={<>{moduleFilter}{quizFilter}{topicFilter}</>}
        />
      ),
    };

    return groups[viewMode] ?? null;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {error && (
        <div className="max-w-6xl mx-auto mb-6 px-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xl">×</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">
            {isPrivileged ? 'Student performance breakdown' : 'Personal progress tracking'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Navigation Tab Bar */}
          <div className="border-b border-gray-100 bg-gray-50/50 p-4">
            <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit mx-auto">
              {viewModes.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key as ViewMode)}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                    viewMode === key 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {renderContent()}
          </div>
          
        </div>
      </div>
    </div>
  );
}