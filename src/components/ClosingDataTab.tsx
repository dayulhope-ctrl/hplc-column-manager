'use client';

import { useEffect, useState } from 'react';
import { FileText, CheckCircle, Calendar, Download, Trash2 } from 'lucide-react';
import { ReceivingRecord, MonthlyClosing } from '@/types';

interface Props {
  adminName?: string;
  isAdmin?: boolean;
}

export default function ClosingDataTab({ adminName, isAdmin = true }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [receivings, setReceivings] = useState<ReceivingRecord[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedClosing, setSelectedClosing] = useState<MonthlyClosing | null>(null);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, closingRes] = await Promise.all([
        fetch(`/api/receivings?month=${currentMonth}`),
        fetch('/api/closings'),
      ]);
      setReceivings((await recRes.json()).records || []);
      setClosings((await closingRes.json()).closings || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentMonth]);

  const isAlreadyClosed = closings.some(c => c.month === currentMonth);

  const handleClose = async () => {
    if (isAlreadyClosed) return;
    if (!confirm(`${currentMonth} 월을 마감하시겠습니까?`)) return;
    setClosing(true);
    const res = await fetch('/api/closings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: currentMonth }),
    });
    setClosing(false);
    if (res.ok) {
      setMessage({ type: 'success', text: `${currentMonth} 마감 완료` });
      fetchData();
    } else {
      const err = await res.json();
      setMessage({ type: 'error', text: err.error || '마감 실패' });
    }
  };

  const totalQty = receivings.reduce((s, r) => s + r.quantity, 0);
  const totalAmt = receivings.reduce((s, r) => s + (r.total_price || 0), 0);

  const handleCancelReceive = async (id: string) => {
    if (!confirm('이 입고 기록을 취소하시겠습니까?\n재고가 원복되고 입고 대기 상태로 돌아갑니다.')) return;
    const res = await fetch(`/api/receivings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: '입고 기록이 취소되었습니다' });
      fetchData();
    } else {
      const err = await res.json();
      setMessage({ type: 'error', text: err.error || '취소 실패' });
    }
  };

  const handleDeleteClosing = async (month: string) => {
    if (!confirm(`${month} 마감 기록을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) return;
    const res = await fetch(`/api/closings/${month}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: `${month} 마감 기록이 삭제되었습니다` });
      fetchData();
    } else {
      setMessage({ type: 'error', text: '삭제 실패' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          마감자료
        </h2>
        <div className="flex items-center gap-2">
          <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm" />
          {isAdmin && (
            <a href={`/api/export/closings?year=${currentMonth.slice(0, 4)}`} download
              className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-xs">
              <Download className="w-3.5 h-3.5" /> 엑셀
            </a>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* 현재 월 현황 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-sm">{currentMonth} 입고 현황</span>
            <span className="text-xs text-gray-500">총 {receivings.length}건</span>
            {isAlreadyClosed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" /> 마감 완료
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              월 입고 합계 <span className="text-blue-700">₩{totalAmt.toLocaleString()}</span>
            </span>
            {isAdmin && !isAlreadyClosed && (
              <button onClick={handleClose} disabled={closing || receivings.length === 0}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                {closing ? '마감 중...' : '마감완료'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">로딩 중...</div>
        ) : receivings.length === 0 ? (
          <div className="text-center py-10 text-gray-400">해당 월 입고 내역이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">발주일</th>
                  <th className="px-3 py-2 text-left">KEP 코드</th>
                  <th className="px-3 py-2 text-left">모델명</th>
                  <th className="px-3 py-2 text-left">Cat. No</th>
                  <th className="px-3 py-2 text-left">사이즈</th>
                  <th className="px-3 py-2 text-center">입자크기</th>
                  <th className="px-3 py-2 text-center">구매수량</th>
                  <th className="px-3 py-2 text-right">단가</th>
                  <th className="px-3 py-2 text-right">입고금액</th>
                  <th className="px-3 py-2 text-left">입고일</th>
                  {isAdmin && !isAlreadyClosed && <th className="px-3 py-2 text-center">취소</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {receivings.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs">{rec.order_date || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{rec.kep_code || '-'}</td>
                    <td className="px-3 py-2 font-medium">{rec.model_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{rec.cat_no}</td>
                    <td className="px-3 py-2 text-xs">{rec.size || '-'}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {rec.particle_size ? `${rec.particle_size} µm` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">{rec.quantity}</td>
                    <td className="px-3 py-2 text-right text-xs">₩{rec.unit_price?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-right font-semibold">₩{rec.total_price?.toLocaleString() || '-'}</td>
                    <td className="px-3 py-2 text-xs">{rec.receiving_date}</td>
                    {isAdmin && !isAlreadyClosed && (
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleCancelReceive(rec.id)}
                          className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                        >
                          취소
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-blue-50 font-semibold text-sm">
                  <td colSpan={6} className="px-3 py-2">소계</td>
                  <td className="px-3 py-2 text-center">{totalQty}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right text-blue-700">₩{totalAmt.toLocaleString()}</td>
                  <td className="px-3 py-2"></td>
                  {isAdmin && !isAlreadyClosed && <td className="px-3 py-2"></td>}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 마감 이력 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-sm text-gray-900">마감 이력</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-600 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">마감 월</th>
                <th className="px-4 py-2 text-center">입고 건수</th>
                <th className="px-4 py-2 text-center">총 수량</th>
                <th className="px-4 py-2 text-right">총 금액</th>
                <th className="px-4 py-2 text-left">마감일</th>
                <th className="px-4 py-2 text-left">담당자</th>
                <th className="px-4 py-2 text-center">상세</th>
                {isAdmin && <th className="px-4 py-2 text-center">삭제</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {closings.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-400">마감 이력이 없습니다</td></tr>
              ) : closings.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{c.month}</td>
                  <td className="px-4 py-2 text-center">{Array.isArray(c.records) ? c.records.length : 0}건</td>
                  <td className="px-4 py-2 text-center font-semibold">{c.total_quantity}</td>
                  <td className="px-4 py-2 text-right font-semibold">₩{c.total_price?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs">{c.closing_date}</td>
                  <td className="px-4 py-2 text-xs">{c.closed_by || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => setSelectedClosing(c)}
                      className="px-2 py-0.5 border rounded text-xs hover:bg-gray-100">보기</button>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => handleDeleteClosing(c.month)}
                        className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 마감 상세 모달 */}
      {selectedClosing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold">{selectedClosing.month} 마감 상세</h3>
              <button onClick={() => setSelectedClosing(null)} className="p-1 hover:bg-gray-100 rounded">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">총 수량</p>
                  <p className="text-xl font-bold">{selectedClosing.total_quantity}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">총 금액</p>
                  <p className="text-xl font-bold text-blue-700">₩{selectedClosing.total_price?.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">마감자</p>
                  <p className="text-xl font-bold">{selectedClosing.closed_by || '-'}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">발주일</th>
                    <th className="px-3 py-2 text-left">KEP 코드</th>
                    <th className="px-3 py-2 text-left">모델명</th>
                    <th className="px-3 py-2 text-left">Cat. No</th>
                    <th className="px-3 py-2 text-left">사이즈</th>
                    <th className="px-3 py-2 text-center">입자크기</th>
                    <th className="px-3 py-2 text-center">구매수량</th>
                    <th className="px-3 py-2 text-right">단가</th>
                    <th className="px-3 py-2 text-right">입고금액</th>
                    <th className="px-3 py-2 text-left">입고일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(Array.isArray(selectedClosing.records) ? selectedClosing.records : []).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs">{r.order_date || '-'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.kep_code || '-'}</td>
                      <td className="px-3 py-2 text-sm">{r.model_name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.cat_no}</td>
                      <td className="px-3 py-2 text-xs">{r.size || '-'}</td>
                      <td className="px-3 py-2 text-center text-xs">{r.particle_size ? `${r.particle_size} µm` : '-'}</td>
                      <td className="px-3 py-2 text-center">{r.quantity}</td>
                      <td className="px-3 py-2 text-right text-xs">₩{r.unit_price?.toLocaleString() || '-'}</td>
                      <td className="px-3 py-2 text-right">₩{r.total_price?.toLocaleString() || '-'}</td>
                      <td className="px-3 py-2 text-xs">{r.receiving_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
