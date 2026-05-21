'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Play, X, ChevronDown } from 'lucide-react';
import { MonthlyClosing } from '@/types';

export default function ClosingTab({ adminName }: { adminName: string }) {
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [detail, setDetail] = useState<MonthlyClosing | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchClosings = async () => {
    setLoading(true);
    const res = await fetch('/api/closings');
    const data = await res.json();
    setClosings(data.closings || []);
    setLoading(false);
  };

  useEffect(() => { fetchClosings(); }, []);
  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(t); }
  }, [message]);

  const handleRun = async () => {
    if (!confirm(`${selectedMonth} 월 결산을 실행하시겠습니까?`)) return;
    setRunning(true);
    const res = await fetch('/api/closings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: selectedMonth, notes }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: `${selectedMonth} 결산 완료 (입고 ${data.closing.total_quantity}개, ₩${data.closing.total_price.toLocaleString()})` });
      setNotes('');
      fetchClosings();
    } else {
      setMessage({ type: 'error', text: data.error || '결산 실패' });
    }
    setRunning(false);
  };

  const alreadyClosed = closings.some(c => c.month === selectedMonth);

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart2 className="w-5 h-5" />
        월별 결산
      </h2>

      {message && (
        <div className={`mb-3 p-2.5 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* 결산 실행 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">결산 실행</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="메모 (선택)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            onClick={handleRun}
            disabled={running || alreadyClosed}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 text-sm whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            {running ? '처리 중...' : alreadyClosed ? '이미 결산됨' : '결산 실행'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          선택한 월의 입고 기록을 집계하여 결산합니다. 결산 후에는 재실행할 수 없습니다.
        </p>
      </div>

      {/* 결산 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">결산 월</th>
                <th className="px-4 py-3 text-right">총 입고 수량</th>
                <th className="px-4 py-3 text-right">총 금액</th>
                <th className="px-4 py-3 text-left">결산일</th>
                <th className="px-4 py-3 text-left">담당자</th>
                <th className="px-4 py-3 text-left">메모</th>
                <th className="px-4 py-3 text-center">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">로딩 중...</td></tr>
              ) : closings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">결산 내역이 없습니다</td></tr>
              ) : closings.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold">{c.month}</td>
                  <td className="px-4 py-3 text-right">{c.total_quantity.toLocaleString()}개</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">₩{c.total_price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.closing_date}</td>
                  <td className="px-4 py-3 text-xs">{c.closed_by || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.notes || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDetail(c)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1 mx-auto">
                      <ChevronDown className="w-3 h-3" /> 상세
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <ClosingDetailDialog closing={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ClosingDetailDialog({ closing, onClose }: { closing: MonthlyClosing; onClose: () => void }) {
  const records: any[] = Array.isArray(closing.records) ? closing.records : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">{closing.month} 결산 상세</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              총 {closing.total_quantity}개 · ₩{closing.total_price.toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {records.length === 0 ? (
            <p className="text-center text-gray-400 py-8">입고 기록이 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">입고일</th>
                  <th className="px-3 py-2 text-left">모델명</th>
                  <th className="px-3 py-2 text-left">Cat. No</th>
                  <th className="px-3 py-2 text-center">수량</th>
                  <th className="px-3 py-2 text-right">총액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600">{r.receiving_date}</td>
                    <td className="px-3 py-2 font-medium text-xs">{r.model_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.cat_no}</td>
                    <td className="px-3 py-2 text-center font-semibold">{r.quantity}</td>
                    <td className="px-3 py-2 text-right">₩{(r.total_price || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-sm">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right">합계</td>
                  <td className="px-3 py-2 text-center">{closing.total_quantity}</td>
                  <td className="px-3 py-2 text-right text-blue-700">₩{closing.total_price.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
