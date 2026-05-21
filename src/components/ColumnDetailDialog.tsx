'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Pencil, Minus } from 'lucide-react';
import { ColumnModel, IndividualColumn } from '@/types';

interface RecordWithModel extends IndividualColumn {
  created_at?: string;
}

interface Props {
  column: ColumnModel;
  onClose: () => void;
  onStockChanged?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  '사용 중':   { label: '사용 중',   className: 'bg-blue-100 text-blue-800' },
  '재고 대기': { label: '재고 대기', className: 'bg-gray-100 text-gray-600' },
  '폐기 완료': { label: '폐기 완료', className: 'bg-red-100 text-red-700' },
  '입고 예정': { label: '입고 예정', className: 'bg-amber-100 text-amber-800' },
};

export default function ColumnDetailDialog({ column, onClose, onStockChanged }: Props) {
  const [records, setRecords] = useState<RecordWithModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockDelta, setStockDelta] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    const res = await fetch(`/api/individual-columns?model_id=${column.id}`);
    const data = await res.json();
    setRecords(data.records || []);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [column.id]);
  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }
  }, [message]);

  const handleStockSave = async () => {
    if (stockDelta === 0) return;
    const newStock = Math.max(0, column.total_stock + stockDelta);
    const res = await fetch(`/api/columns/${column.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_stock: newStock }),
    });
    if (res.ok) {
      setMessage({ type: 'success', text: `재고가 ${newStock}개로 업데이트되었습니다` });
      setStockDelta(0);
      onStockChanged?.();
    } else {
      setMessage({ type: 'error', text: '재고 업데이트 실패' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 이력을 삭제하시겠습니까?')) return;
    setDeleting(id);
    const res = await fetch(`/api/individual-columns/${id}`, { method: 'DELETE' });
    if (res.ok) { fetchRecords(); setMessage({ type: 'success', text: '삭제되었습니다' }); }
    else setMessage({ type: 'error', text: '삭제 실패' });
    setDeleting(null);
  };

  const currentStock = column.total_stock + stockDelta;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{column.model_name} 사용 이력</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {message && (
            <div className={`p-2.5 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message.text}
            </div>
          )}

          {/* 칼럼 기본 정보 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Cat. No</p>
              <p className="font-mono text-sm font-medium">{column.cat_no}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">현재 재고</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setStockDelta(d => d - 1)} disabled={currentStock <= 0}
                  className="w-6 h-6 rounded-full border flex items-center justify-center hover:bg-gray-200 disabled:opacity-30">
                  <Minus className="w-3 h-3" />
                </button>
                <span className={`text-sm font-bold ${stockDelta !== 0 ? 'text-blue-600' : ''}`}>
                  {currentStock} / {column.total_stock}
                </span>
                <button onClick={() => setStockDelta(d => d + 1)}
                  className="w-6 h-6 rounded-full border flex items-center justify-center hover:bg-gray-200">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {stockDelta !== 0 && (
                <button onClick={handleStockSave}
                  className="mt-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                  저장
                </button>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">사이즈</p>
              <p className="text-sm">{column.size || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">입자 크기</p>
              <p className="text-sm">{column.particle_size ? `${column.particle_size} µm` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">KEP 코드</p>
              <p className="text-sm font-mono">{column.kep_code || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">단가</p>
              <p className="text-sm font-semibold">₩{column.unit_price?.toLocaleString()}</p>
            </div>
          </div>

          {/* 이력 추가 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" /> 이력 추가
            </button>
          </div>

          {/* 이력 추가 폼 */}
          {showAddForm && (
            <AddRecordForm
              modelId={column.id}
              onSaved={() => {
                setShowAddForm(false);
                fetchRecords();
                setMessage({ type: 'success', text: '이력이 추가되었습니다 (재고 1개 차감)' });
                onStockChanged?.();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* 이력 테이블 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">칼럼 코드</th>
                  <th className="px-3 py-2 text-left">요청일</th>
                  <th className="px-3 py-2 text-left">요청자</th>
                  <th className="px-3 py-2 text-left">제품명</th>
                  <th className="px-3 py-2 text-left">시험항목</th>
                  <th className="px-3 py-2 text-left">교체사유</th>
                  <th className="px-3 py-2 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">로딩 중...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">사용 이력이 없습니다</td></tr>
                ) : records.map(rec => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{rec.column_code || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {rec.start_date || (rec.created_at ? new Date(rec.created_at).toLocaleDateString('ko-KR') : '-')}
                      </td>
                      <td className="px-3 py-2 text-xs">{rec.user_name || '-'}</td>
                      <td className="px-3 py-2 text-xs">{rec.product_name || '-'}</td>
                      <td className="px-3 py-2 text-xs">{rec.test_item || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{rec.replacement_reason || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleDelete(rec.id)}
                          disabled={deleting === rec.id}
                          className="p-1 hover:bg-red-50 rounded text-red-500 disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// 이력 추가 인라인 폼
function AddRecordForm({ modelId, onSaved, onCancel }: { modelId: string; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    column_code: '',
    start_date: new Date().toISOString().slice(0, 10),
    user_name: '', product_name: '', test_item: '',
    usage_reason: '', replacement_reason: '', usage_count: 1, notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/individual-columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, status: '사용 중', ...form }),
    });
    setSaving(false);
    if (res.ok) onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">칼럼 코드</label>
          <input value={form.column_code} onChange={e => setForm({ ...form, column_code: e.target.value })}
            className="w-full px-2 py-1.5 border rounded text-sm" placeholder="COL-001" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">시작일</label>
          <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
            className="w-full px-2 py-1.5 border rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">요청자</label>
          <input value={form.user_name} onChange={e => setForm({ ...form, user_name: e.target.value })}
            className="w-full px-2 py-1.5 border rounded text-sm" placeholder="홍길동" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">제품명</label>
          <input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })}
            className="w-full px-2 py-1.5 border rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">시험항목</label>
          <input value={form.test_item} onChange={e => setForm({ ...form, test_item: e.target.value })}
            className="w-full px-2 py-1.5 border rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">교체/폐기 사유</label>
          <input value={form.replacement_reason} onChange={e => setForm({ ...form, replacement_reason: e.target.value })}
            className="w-full px-2 py-1.5 border rounded text-sm" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border rounded-lg text-sm">취소</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
          {saving ? '추가 중...' : '추가'}
        </button>
      </div>
    </form>
  );
}
