'use client';

import { useEffect, useState } from 'react';
import { History, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { IndividualColumn, ColumnModel } from '@/types';

interface RecordWithModel extends IndividualColumn {
  column_models?: { model_name: string; cat_no: string };
  created_at?: string;
}

interface ColumnUsage {
  modelId: string;
  usageCount: number; // individual_columns 건수 = 사용량
}

interface Props {
  columns: ColumnModel[];
}

const START_YEAR = 2026;

export default function IndividualColumnTab({ columns }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(Math.max(START_YEAR, currentYear));
  const [allRecords, setAllRecords] = useState<RecordWithModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<RecordWithModel[]>([]);
  const [expandLoading, setExpandLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addModelId, setAddModelId] = useState<string>('');
  const [editing, setEditing] = useState<RecordWithModel | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAllRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/individual-columns');
      const data = await res.json();
      setAllRecords(data.records || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (columns.length > 0) fetchAllRecords();
  }, [columns]);

  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }
  }, [message]);

  // 선택 연도에 해당하는 레코드만 필터
  const yearRecords = allRecords.filter(r => {
    const dateStr = r.start_date || r.created_at;
    if (!dateStr) return false;
    return new Date(dateStr).getFullYear() === selectedYear;
  });

  // 모델별 사용량 집계
  const usageMap: Record<string, number> = {};
  for (const rec of yearRecords) {
    usageMap[rec.model_id] = (usageMap[rec.model_id] || 0) + 1;
  }

  // 해당 연도에 사용량이 있는 칼럼만, 사용량 많은 순 정렬
  const displayColumns = [...columns]
    .filter(c => (usageMap[c.id] || 0) > 0)
    .sort((a, b) => (usageMap[b.id] || 0) - (usageMap[a.id] || 0));

  const totalUsage = Object.values(usageMap).reduce((s, v) => s + v, 0);

  const handleExpand = async (modelId: string) => {
    if (expandedId === modelId) {
      setExpandedId(null);
      setExpandedRecords([]);
      return;
    }
    setExpandedId(modelId);
    setExpandLoading(true);
    try {
      const res = await fetch(`/api/individual-columns?model_id=${modelId}`);
      const data = await res.json();
      // 선택 연도 필터
      const filtered = (data.records || []).filter((r: RecordWithModel) => {
        const dateStr = r.start_date || r.created_at;
        if (!dateStr) return false;
        return new Date(dateStr).getFullYear() === selectedYear;
      });
      setExpandedRecords(filtered);
    } finally {
      setExpandLoading(false);
    }
  };

  // 연도가 바뀌면 확장 닫기
  useEffect(() => {
    setExpandedId(null);
    setExpandedRecords([]);
  }, [selectedYear]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 사용 이력을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/individual-columns/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: '삭제되었습니다' });
      await fetchAllRecords();
      if (expandedId) {
        const res2 = await fetch(`/api/individual-columns?model_id=${expandedId}`);
        const data = await res2.json();
        const filtered = (data.records || []).filter((r: RecordWithModel) => {
          const dateStr = r.start_date || r.created_at;
          if (!dateStr) return false;
          return new Date(dateStr).getFullYear() === selectedYear;
        });
        setExpandedRecords(filtered);
      }
    } else {
      setMessage({ type: 'error', text: '삭제 실패' });
    }
  };

  // 연도 목록 생성 (2026 ~ 현재년도+1)
  const years: number[] = [];
  for (let y = START_YEAR; y <= Math.max(currentYear + 1, START_YEAR); y++) {
    years.push(y);
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5" />
          칼럼 이력 관리
        </h2>
        <div className="flex items-center gap-2">
          {/* 연도 선택 */}
          <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedYear === y
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {y}년
              </button>
            ))}
          </div>
          <button
            onClick={() => { setAddModelId(''); setShowAdd(true); }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> 이력 추가
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-3 p-2.5 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* 요약 통계 */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">등록된 칼럼 모델</p>
            <p className="text-xl font-bold text-blue-700">{displayColumns.length}종</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{selectedYear}년 총 사용량</p>
            <p className="text-xl font-bold text-green-700">{totalUsage}건</p>
          </div>
        </div>
      )}

      {/* 칼럼별 아코디언 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
          <div className="col-span-1"></div>
          <div className="col-span-5">모델명</div>
          <div className="col-span-3">Cat. No</div>
          <div className="col-span-3 text-center flex items-center justify-center gap-1">
            <FlaskConical className="w-3 h-3" /> 사용량
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">로딩 중...</div>
        ) : displayColumns.length === 0 ? (
          <div className="py-12 text-center text-gray-400">칼럼 모델이 없습니다</div>
        ) : displayColumns.map(col => {
          const usage = usageMap[col.id] || 0;
          const isExpanded = expandedId === col.id;

          return (
            <div key={col.id} className="border-b last:border-b-0">
              <button
                onClick={() => handleExpand(col.id)}
                className={`w-full grid grid-cols-12 gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50' : ''}`}
              >
                <div className="col-span-1 flex items-center">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-blue-500" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                </div>
                <div className="col-span-5">
                  <div className="font-medium text-gray-900 text-sm">{col.model_name}</div>
                  {col.size && <div className="text-xs text-gray-400">{col.size}</div>}
                </div>
                <div className="col-span-3 text-xs text-gray-500 font-mono self-center">{col.cat_no}</div>
                <div className="col-span-3 text-center self-center">
                  {usage > 0 ? (
                    <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      {usage}건
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </div>
              </button>

              {/* 확장 영역 */}
              {isExpanded && (
                <div className="border-t border-blue-100 bg-blue-50/40">
                  {expandLoading ? (
                    <div className="py-6 text-center text-gray-400 text-sm">로딩 중...</div>
                  ) : (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600">
                          {selectedYear}년 사용 이력 ({expandedRecords.length}건)
                        </span>
                        <button
                          onClick={() => { setAddModelId(col.id); setShowAdd(true); }}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> 이력 추가
                        </button>
                      </div>

                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {expandedRecords.length === 0 ? (
                          <div className="py-6 text-center text-gray-400 text-sm">
                            {selectedYear}년 사용 이력이 없습니다
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">칼럼 코드</th>
                                <th className="px-3 py-2 text-left">사용일</th>
                                <th className="px-3 py-2 text-left">사용자</th>
                                <th className="px-3 py-2 text-left">제품명</th>
                                <th className="px-3 py-2 text-left">시험항목</th>
                                <th className="px-3 py-2 text-left">교체사유</th>
                                <th className="px-3 py-2 text-center">작업</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {expandedRecords.map(rec => (
                                <tr key={rec.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono">{rec.column_code || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600">
                                    {rec.start_date || (rec.created_at ? new Date(rec.created_at).toLocaleDateString('ko-KR') : '-')}
                                  </td>
                                  <td className="px-3 py-2">{rec.user_name || '-'}</td>
                                  <td className="px-3 py-2">{rec.product_name || '-'}</td>
                                  <td className="px-3 py-2">{rec.test_item || '-'}</td>
                                  <td className="px-3 py-2 text-gray-500">{rec.replacement_reason || '-'}</td>
                                  <td className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => setEditing(rec)} className="p-1 hover:bg-blue-50 rounded text-blue-600">
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => handleDelete(rec.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 이력 추가 다이얼로그 */}
      {showAdd && (
        <IndividualColumnDialog
          columns={columns}
          initialModelId={addModelId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            fetchAllRecords();
            if (expandedId) handleExpand(expandedId);
            setMessage({ type: 'success', text: '이력이 추가되었습니다' });
          }}
        />
      )}

      {/* 수정 다이얼로그 */}
      {editing && (
        <IndividualColumnDialog
          columns={columns}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchAllRecords();
            if (expandedId) handleExpand(expandedId);
            setMessage({ type: 'success', text: '수정되었습니다' });
          }}
        />
      )}
    </div>
  );
}

// ===================================
// 이력 추가/수정 다이얼로그
// ===================================
function IndividualColumnDialog({
  columns, record, initialModelId, onClose, onSaved,
}: {
  columns: ColumnModel[];
  record?: RecordWithModel;
  initialModelId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    model_id: record?.model_id || initialModelId || '',
    column_code: record?.column_code || '',
    status: record?.status || '사용 중',
    start_date: record?.start_date || new Date().toISOString().slice(0, 10),
    user_name: record?.user_name || '',
    product_name: record?.product_name || '',
    test_item: record?.test_item || '',
    replacement_reason: record?.replacement_reason || '',
    notes: record?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const url = record ? `/api/individual-columns/${record.id}` : '/api/individual-columns';
    const method = record ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || '처리 실패');
      setLoading(false);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">{record ? '이력 수정' : '사용 이력 추가'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {!record && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">칼럼 모델 *</label>
              <select
                value={form.model_id}
                onChange={e => setForm({ ...form, model_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              >
                <option value="">선택하세요</option>
                {columns.map(c => (
                  <option key={c.id} value={c.id}>{c.model_name} ({c.cat_no})</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">칼럼 코드</label>
              <input value={form.column_code} onChange={e => setForm({ ...form, column_code: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="COL-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사용일 *</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사용자</label>
            <input value={form.user_name} onChange={e => setForm({ ...form, user_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="홍길동" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제품명</label>
              <input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시험항목</label>
              <input value={form.test_item} onChange={e => setForm({ ...form, test_item: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">교체/폐기 사유</label>
            <input value={form.replacement_reason} onChange={e => setForm({ ...form, replacement_reason: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none" rows={2} />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border rounded-lg text-sm">취소</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {loading ? '저장 중...' : record ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
