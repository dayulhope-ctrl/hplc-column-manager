'use client';

import { useState } from 'react';
import { X, Search } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  defaultRequester?: string;
}

export default function PurchaseRequestAddDialog({ onClose, onSaved, defaultRequester = '' }: Props) {
  const [form, setForm] = useState({
    cat_no: '',
    model_name: '',
    size: '',
    particle_size: '',
    quantity: 1,
    requester_name: defaultRequester,
    reason: '',
    urgency: 'normal',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lookupMsg, setLookupMsg] = useState('');

  const handleLookup = async () => {
    if (!form.cat_no.trim()) return;
    setLookupMsg('조회 중...');
    const res = await fetch(`/api/columns?search=${encodeURIComponent(form.cat_no.trim())}`);
    const data = await res.json();
    const match = (data.columns || []).find((c: any) => c.cat_no === form.cat_no.trim());
    if (match) {
      setForm(prev => ({
        ...prev,
        model_name: match.model_name,
        size: match.size || '',
        particle_size: match.particle_size?.toString() || '',
      }));
      setLookupMsg('기존 칼럼을 찾았습니다');
    } else {
      setLookupMsg('등록되지 않은 Cat. No — 신규 칼럼으로 등록됩니다');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cat_no: form.cat_no.trim(),
        model_name: form.model_name.trim(),
        size: form.size || null,
        particle_size: form.particle_size ? parseFloat(form.particle_size) : null,
        quantity: form.quantity,
        requester_name: form.requester_name.trim(),
        reason: form.reason.trim(),
        urgency: form.urgency,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || '추가 실패');
      setLoading(false);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">구매요청 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Cat. No */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cat. No *{' '}
              <span className="text-red-500 text-xs font-normal">매우 중요! 정확히 작성부탁드립니다</span>
            </label>
            <div className="flex gap-2">
              <input
                value={form.cat_no}
                onChange={e => { setForm({ ...form, cat_no: e.target.value }); setLookupMsg(''); }}
                onBlur={handleLookup}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="예: ACE-122-2546"
                required
              />
              <button type="button" onClick={handleLookup}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> 조회
              </button>
            </div>
            {lookupMsg && (
              <p className={`text-xs mt-1 ${lookupMsg.includes('찾았') ? 'text-green-600' : 'text-amber-600'}`}>
                {lookupMsg}
              </p>
            )}
          </div>

          {/* 모델명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">모델명 *</label>
            <input value={form.model_name} onChange={e => setForm({ ...form, model_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="예: ACE 5 C8" required />
          </div>

          {/* 사이즈 / 입자크기 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사이즈</label>
              <input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="예: 4.6mm × 250mm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">입자크기 (µm)</label>
              <input value={form.particle_size} onChange={e => setForm({ ...form, particle_size: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="예: 5" />
            </div>
          </div>

          {/* 요청수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요청수량 *</label>
            <input type="number" min={1} value={form.quantity}
              onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>

          {/* 요청자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요청자 *</label>
            <input value={form.requester_name} onChange={e => setForm({ ...form, requester_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="예: 홍길동" required />
          </div>

          {/* 요청사유 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요청사유 *</label>
            <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="예: 제품명, 시험항목" required />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border rounded-lg text-sm">취소</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
