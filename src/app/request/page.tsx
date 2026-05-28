'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Search, Plus, CheckCircle } from 'lucide-react';
import { PurchaseRequest } from '@/types';
import RequestsPanel from '@/components/RequestsPanel';

// ── 인라인 구매요청 폼 ──
function InlineRequestForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    cat_no: '',
    model_name: '',
    size: '',
    particle_size: '',
    quantity: 1,
    requester_name: '',
    reason: '',
    urgency: 'normal',
  });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [lookupMsg, setLookupMsg] = useState('');

  const handleLookup = async () => {
    if (!form.cat_no.trim()) return;
    setLookupMsg('조회 중...');
    const res  = await fetch(`/api/columns?search=${encodeURIComponent(form.cat_no.trim())}`);
    const data = await res.json();
    const match = (data.columns || []).find((c: any) => c.cat_no === form.cat_no.trim());
    if (match) {
      setForm(prev => ({
        ...prev,
        model_name:    match.model_name,
        size:          match.size || '',
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
        cat_no:        form.cat_no.trim(),
        model_name:    form.model_name.trim(),
        size:          form.size || null,
        particle_size: form.particle_size ? parseFloat(form.particle_size) : null,
        quantity:      form.quantity,
        requester_name: form.requester_name.trim(),
        reason:        form.reason.trim(),
        urgency:       form.urgency,
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-lg mx-auto">
      <div className="px-6 py-5 border-b">
        <h2 className="text-lg font-bold text-gray-900">구매요청 작성</h2>
        <p className="text-sm text-gray-500 mt-0.5">필요한 칼럼 정보를 입력해주세요</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              className="flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="예: ACE-122-2546"
              required
            />
            <button
              type="button"
              onClick={handleLookup}
              className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm flex items-center gap-1 transition-colors"
            >
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
          <input
            value={form.model_name}
            onChange={e => setForm({ ...form, model_name: e.target.value })}
            className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="예: ACE 5 C8"
            required
          />
        </div>

        {/* 사이즈 / 입자크기 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사이즈</label>
            <input
              value={form.size}
              onChange={e => setForm({ ...form, size: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="예: 4.6mm × 250mm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">입자크기 (µm)</label>
            <input
              value={form.particle_size}
              onChange={e => setForm({ ...form, particle_size: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="예: 5"
            />
          </div>
        </div>

        {/* 요청수량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">요청수량 *</label>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            required
          />
        </div>

        {/* 요청자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">요청자 *</label>
          <input
            value={form.requester_name}
            onChange={e => setForm({ ...form, requester_name: e.target.value })}
            className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="예: 홍길동"
            required
          />
        </div>

        {/* 요청사유 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">요청사유 *</label>
          <input
            value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })}
            className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="예: 제품명, 시험항목"
            required
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '처리 중...' : '추가'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 메인 페이지 ──
export default function RequestPage() {
  const router = useRouter();
  const [view, setView]         = useState<'form' | 'history'>('form');
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loadingReq, setLoadingReq] = useState(false);

  const fetchRequests = async () => {
    setLoadingReq(true);
    try {
      const res  = await fetch('/api/requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { /* 무시 */ }
    finally { setLoadingReq(false); }
  };

  // 폼 제출 성공 시 내역 화면으로 전환
  const handleSaved = async () => {
    await fetchRequests();
    setView('history');
  };

  // 내역 화면으로 초기 진입 시 데이터 로딩
  useEffect(() => {
    if (view === 'history') fetchRequests();
  }, [view]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            <h1 className="font-bold text-gray-900">
              {view === 'form' ? '구매 요청' : '구매요청 내역'}
            </h1>
          </div>

          {/* 내역 화면에서: 추가 요청 버튼 */}
          {view === 'history' && (
            <button
              onClick={() => setView('form')}
              className="ml-auto px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 추가 요청
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {view === 'form' ? (
          <>
            {/* 성공 배너는 없음 - 제출 즉시 내역으로 전환 */}
            <InlineRequestForm
              onSaved={handleSaved}
              onCancel={() => router.push('/')}
            />
          </>
        ) : (
          <>
            {/* 제출 직후 안내 배너 */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3 mb-6">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">구매요청이 접수되었습니다</p>
                <p className="text-xs text-green-600 mt-0.5">관리자 검토 후 승인 처리됩니다. 아래에서 요청 현황을 확인하세요.</p>
              </div>
            </div>

            {loadingReq ? (
              <div className="text-center py-16 text-gray-400">데이터를 불러오는 중...</div>
            ) : (
              <RequestsPanel
                requests={requests}
                onAction={async () => {}}
                onRefresh={fetchRequests}
                isAdmin={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
